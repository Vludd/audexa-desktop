using System.IO;
using System.Security.Cryptography;

namespace Audexa.UpdateCore;

public sealed class UpdateFileTransaction
{
    public sealed record Snapshot(
        IReadOnlySet<string> OriginalFiles,
        IReadOnlySet<string> OriginalDirectories);

    public Snapshot CreateBackup(string target, string backup)
    {
        EnsurePathsDoNotOverlap(target, backup);
        EnsureNoReparsePoints(target);

        Directory.CreateDirectory(backup);
        EnsureNoReparsePoints(backup);

        var files = Directory
            .EnumerateFiles(target, "*", SearchOption.AllDirectories)
            .Select(file => Path.GetRelativePath(target, file).Replace('\\', '/'))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var directories = Directory
            .EnumerateDirectories(target, "*", SearchOption.AllDirectories)
            .Select(directory => Path.GetRelativePath(target, directory).Replace('\\', '/'))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (string relative in files)
        {
            string source = ResolveManagedPath(target, relative);
            string destination = ResolveManagedPath(backup, relative);

            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(source, destination, overwrite: false);
        }

        return new Snapshot(files, directories);
    }

    public void Rollback(
        string target,
        string backup,
        Snapshot snapshot)
    {
        EnsureNoReparsePoints(target);
        EnsureNoReparsePoints(backup);

        foreach (string file in Directory
            .EnumerateFiles(target, "*", SearchOption.AllDirectories)
            .ToArray())
        {
            string relative = Path.GetRelativePath(target, file).Replace('\\', '/');

            if (!snapshot.OriginalFiles.Contains(relative))
                File.Delete(ResolveManagedPath(target, relative));
        }

        foreach (string relative in snapshot.OriginalDirectories
            .OrderBy(path => path.Count(c => c == '/')))
        {
            string directory = ResolveManagedPath(target, relative);
            Directory.CreateDirectory(directory);
        }

        foreach (string relative in snapshot.OriginalFiles)
        {
            // The running updater cannot reliably overwrite its own executable.
            // It was deliberately excluded from the update copy operation.
            if (relative.Equals(
                "updater/Audexa.Updater.exe",
                StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            string source = ResolveManagedPath(backup, relative);
            string destination = ResolveManagedPath(target, relative);

            if (!File.Exists(source))
                throw new IOException($"Backup file is missing: {relative}");

            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(source, destination, overwrite: true);
        }

        EnsureNoReparsePoints(target);
        EnsureNoReparsePoints(backup);

        foreach (string relative in snapshot.OriginalFiles)
        {
            string restored = ResolveManagedPath(target, relative);
            string original = ResolveManagedPath(backup, relative);

            if (!File.Exists(restored))
                throw new IOException($"Restored file is missing: {relative}");

            using FileStream restoredStream = File.OpenRead(restored);
            using FileStream originalStream = File.OpenRead(original);

            byte[] restoredHash = SHA256.HashData(restoredStream);
            byte[] originalHash = SHA256.HashData(originalStream);

            if (!CryptographicOperations.FixedTimeEquals(restoredHash, originalHash))
                throw new IOException($"Restored file differs from backup: {relative}");
        }

        foreach (string directory in Directory
            .EnumerateDirectories(target, "*", SearchOption.AllDirectories)
            .OrderByDescending(path => path.Length)
            .ToArray())
        {
            string relative = Path.GetRelativePath(target, directory).Replace('\\', '/');

            if (snapshot.OriginalDirectories.Contains(relative))
                continue;

            string safeDirectory = ResolveManagedPath(target, relative);

            if (!Directory.EnumerateFileSystemEntries(safeDirectory).Any())
                Directory.Delete(safeDirectory);
        }
    }

    public static string GetSafeRelativePath(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath) ||
            Path.IsPathRooted(relativePath) ||
            relativePath.Contains('\\') ||
            relativePath.Contains(':') ||
            relativePath.Contains('\0'))
        {
            throw new InvalidDataException($"Invalid managed file path: {relativePath}");
        }

        string[] segments = relativePath.Split('/');

        if (segments.Any(segment =>
            string.IsNullOrWhiteSpace(segment) ||
            segment == "." ||
            segment == ".." ||
            segment.EndsWith('.') ||
            segment.EndsWith(' ') ||
            segment.Any(char.IsControl) ||
            IsReservedWindowsName(segment)))
        {
            throw new InvalidDataException($"Unsafe managed file path: {relativePath}");
        }

        return Path.Combine(segments);
    }

    public static string ResolveManagedPath(string root, string relativePath)
    {
        string safeRelativePath = GetSafeRelativePath(relativePath);
        string rootPath = Path.GetFullPath(root)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

        string destination = Path.GetFullPath(Path.Combine(rootPath, safeRelativePath));
        string prefix = rootPath + Path.DirectorySeparatorChar;

        if (!destination.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException(
                $"Managed path escapes the installation directory: {relativePath}");

        return destination;
    }

    public static void EnsureNoReparsePoints(string root)
    {
        string rootPath = Path.GetFullPath(root);
        var rootInfo = new DirectoryInfo(rootPath);

        if (!rootInfo.Exists)
            throw new DirectoryNotFoundException($"Installation directory does not exist: {root}");

        if ((rootInfo.Attributes & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("Installation directory cannot be a reparse point.");

        var pending = new Stack<string>();
        pending.Push(rootPath);

        while (pending.Count > 0)
        {
            string current = pending.Pop();

            foreach (string directory in Directory.EnumerateDirectories(current))
            {
                var info = new DirectoryInfo(directory);

                if ((info.Attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException($"Reparse point detected: {directory}");

                pending.Push(directory);
            }

            foreach (string file in Directory.EnumerateFiles(current))
            {
                var info = new FileInfo(file);

                if ((info.Attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException($"Reparse point detected: {file}");
            }
        }
    }

    private static void EnsurePathsDoNotOverlap(string target, string backup)
    {
        string targetPath = Path.GetFullPath(target)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

        string backupPath = Path.GetFullPath(backup)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

        static bool IsSameOrChild(string parent, string candidate)
        {
            return candidate.Equals(parent, StringComparison.OrdinalIgnoreCase) ||
                candidate.StartsWith(
                    parent + Path.DirectorySeparatorChar,
                    StringComparison.OrdinalIgnoreCase);
        }

        if (IsSameOrChild(targetPath, backupPath) ||
            IsSameOrChild(backupPath, targetPath))
        {
            throw new InvalidDataException(
                "Backup and installation directories must not overlap.");
        }
    }

    private static bool IsReservedWindowsName(string segment)
    {
        string name = segment.Split('.')[0];

        return name.Equals("CON", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("PRN", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("AUX", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("NUL", StringComparison.OrdinalIgnoreCase) ||
            Enumerable.Range(1, 9).Any(number =>
                name.Equals($"COM{number}", StringComparison.OrdinalIgnoreCase) ||
                name.Equals($"LPT{number}", StringComparison.OrdinalIgnoreCase));
    }
}
