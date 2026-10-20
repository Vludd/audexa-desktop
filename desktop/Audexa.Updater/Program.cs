
using System.Diagnostics;
using System.IO.Compression;
using System.Security.Cryptography;

const long MaxArchiveSize = 1024L * 1024 * 1024;
const long MaxExtractedSize = 2L * 1024 * 1024 * 1024;

string Arg(string name)
{
    var i = Array.FindIndex(args, a =>
        a.Equals(name, StringComparison.OrdinalIgnoreCase));

    if (i < 0 || i + 1 >= args.Length)
        throw new ArgumentException($"Required argument is missing: {name}.");

    return args[i + 1].Trim('"');
}

string? OptionalArg(string name)
{
    var i = Array.FindIndex(args, a =>
        a.Equals(name, StringComparison.OrdinalIgnoreCase));

    return i < 0 || i + 1 >= args.Length
        ? null
        : args[i + 1].Trim('"');
}

bool HasFlag(string name) =>
    args.Any(a => a.Equals(name, StringComparison.OrdinalIgnoreCase));

string target = Path.GetFullPath(Arg("--target"));
string url = Arg("--url");
string expectedHash = Arg("--sha256");
string? optionalPid = OptionalArg("--pid");
int pid = int.TryParse(optionalPid, out var parsed) && parsed > 0
    ? parsed
    : -1;

if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
    uri.Scheme != Uri.UriSchemeHttps)
{
    throw new InvalidDataException(
        "Update URL must use HTTPS.");
}

if (expectedHash.Length != 64 || !expectedHash.All(Uri.IsHexDigit))
{
    throw new InvalidDataException(
        "The manifest contains an invalid SHA-256 hash.");
}

string appPath = Path.Combine(target, "Audexa.Desktop.exe");

if (!File.Exists(appPath))
{
    throw new DirectoryNotFoundException(
        $"Application executable not found for update: {appPath}");
}

if (!HasFlag("--bootstrap-copy"))
{
    string sourceDirectory = AppContext.BaseDirectory;
    string bootstrapDirectory = Path.Combine(
        Path.GetTempPath(),
        "AudexaUpdater-" + Guid.NewGuid().ToString("N"));

    Directory.CreateDirectory(bootstrapDirectory);

    foreach (string file in Directory.EnumerateFiles(sourceDirectory))
    {
        string destination = Path.Combine(
            bootstrapDirectory, Path.GetFileName(file));

        File.Copy(file, destination, overwrite: true);
    }

    string processPath = Environment.ProcessPath
        ?? throw new InvalidOperationException(
            "Could not determine the updater executable path.");

    string executable = Path.Combine(
        bootstrapDirectory, Path.GetFileName(processPath));

    var startInfo = new ProcessStartInfo
    {
        FileName = executable,
        WorkingDirectory = bootstrapDirectory,
        UseShellExecute = false
    };

    foreach (string argument in args)
        startInfo.ArgumentList.Add(argument);

    startInfo.ArgumentList.Add("--bootstrap-copy");

    var bootstrapProcess = Process.Start(startInfo);

    if (bootstrapProcess is null)
    {
        throw new InvalidOperationException(
            "Could not start the updater bootstrap process.");
    }

    bootstrapProcess.Dispose();
    return;
}

string temp = Path.Combine(
    Path.GetTempPath(),
    "AudexaUpdate-" + Guid.NewGuid().ToString("N"));

string zipPath = Path.Combine(temp, "update.zip");
string staged = Path.Combine(temp, "staged");
string backup = Path.Combine(temp, "backup");
string originalFilesList = Path.Combine(temp, "original-files.txt");

bool snapshotComplete = false;
bool updateStarted = false;

try
{
    Directory.CreateDirectory(temp);
    Directory.CreateDirectory(staged);
    Directory.CreateDirectory(backup);

    if (pid > 0)
    {
        try
        {
            using var process = Process.GetProcessById(pid);

            if (!process.WaitForExit(30000))
            {
                process.Kill(entireProcessTree: true);

                if (!process.WaitForExit(10000))
                {
                    throw new TimeoutException(
                        "Could not stop Audexa before applying the update.");
                }
            }
        }
        catch (ArgumentException)
        {

        }
    }

    using (var http = new HttpClient
    {
        Timeout = TimeSpan.FromMinutes(10)
    })
    {
        http.DefaultRequestHeaders.UserAgent.ParseAdd(
            "Audexa-Updater/1.0");

        using var response = await http.GetAsync(
            uri, HttpCompletionOption.ResponseHeadersRead);

        response.EnsureSuccessStatusCode();

        if (response.Content.Headers.ContentLength is long length &&
            length > MaxArchiveSize)
        {
            throw new InvalidDataException(
                "Update archive exceeds the maximum allowed size.");
        }

        await using var input = await response.Content.ReadAsStreamAsync();
        await using var output = new FileStream(
            zipPath, FileMode.CreateNew,
            FileAccess.Write, FileShare.None);

        byte[] buffer = new byte[81920];
        long total = 0;

        while (true)
        {
            int read = await input.ReadAsync(buffer);

            if (read == 0)
                break;

            total += read;

            if (total > MaxArchiveSize)
            {
                throw new InvalidDataException(
                    "Update archive exceeds the maximum allowed size.");
            }

            await output.WriteAsync(buffer.AsMemory(0, read));
        }
    }

    await using (var file = File.OpenRead(zipPath))
    {
        byte[] actual = await SHA256.HashDataAsync(file);
        byte[] expected = Convert.FromHexString(expectedHash);

        if (!CryptographicOperations.FixedTimeEquals(actual, expected))
        {
            throw new CryptographicException(
                "SHA-256 mismatch. Update cancelled.");
        }
    }

    using (var archive = ZipFile.OpenRead(zipPath))
    {
        string root = Path.GetFullPath(staged)
            + Path.DirectorySeparatorChar;

        long extractedSize = 0;

        foreach (var entry in archive.Entries)
        {
            string normalized = entry.FullName.Replace(
                '/', Path.DirectorySeparatorChar);

            if (Path.IsPathRooted(normalized) ||
                normalized.Contains(':'))
            {
                throw new InvalidDataException(
                    "Archive contains an invalid path.");
            }

            string destination = Path.GetFullPath(
                Path.Combine(staged, normalized));

            if (!destination.StartsWith(
                root, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException(
                    "Archive entry resolves outside the extraction directory.");
            }

            int unixType = (entry.ExternalAttributes >> 16) & 0xF000;

            if (unixType == 0xA000)
            {
                throw new InvalidDataException(
                    "Archive contains a symbolic link.");
            }

            extractedSize += entry.Length;

            if (extractedSize > MaxExtractedSize)
            {
                throw new InvalidDataException(
                    "Extracted archive exceeds the maximum allowed size.");
            }
        }

        archive.ExtractToDirectory(staged, overwriteFiles: false);
    }

    if (!File.Exists(Path.Combine(staged, "Audexa.Desktop.exe")) ||
        !File.Exists(Path.Combine(staged, "backend", "audexa-backend.exe")) ||
        !File.Exists(Path.Combine(staged, "updater", "Audexa.Updater.exe")) ||
        !File.Exists(Path.Combine(staged, "frontend", "index.html")))
    {
        throw new InvalidDataException(
            "Archive is missing one or more required Audexa files.");
    }

    var originalFiles = Directory.EnumerateFiles(
        target, "*", SearchOption.AllDirectories).ToArray();

    await File.WriteAllLinesAsync(
        originalFilesList,
        originalFiles.Select(f => Path.GetRelativePath(target, f)));

    foreach (string file in originalFiles)
    {
        string relative = Path.GetRelativePath(target, file);
        string backupFile = Path.Combine(backup, relative);

        Directory.CreateDirectory(
            Path.GetDirectoryName(backupFile)!);

        File.Copy(file, backupFile, overwrite: true);
    }

    snapshotComplete = true;
    updateStarted = true;

    foreach (string directory in Directory.EnumerateDirectories(
                 staged, "*", SearchOption.AllDirectories)
             .OrderBy(d => d.Length))
    {
        string relative = Path.GetRelativePath(staged, directory);

        Directory.CreateDirectory(Path.Combine(target, relative));
    }

    foreach (string file in Directory.EnumerateFiles(
                 staged, "*", SearchOption.AllDirectories))
    {
        string relative = Path.GetRelativePath(staged, file);
        string destination = Path.Combine(target, relative);

        Directory.CreateDirectory(
            Path.GetDirectoryName(destination)!);

        File.Copy(file, destination, overwrite: true);
    }

    var app = Process.Start(new ProcessStartInfo(appPath)
    {
        UseShellExecute = true,
        WorkingDirectory = target
    });

    if (app is null)
    {
        throw new InvalidOperationException(
            "Could not start the updated Audexa application.");
    }

    using (app)
    {
        if (app.WaitForExit(7000))
        {
            throw new InvalidOperationException(
                $"Audexa exited shortly after launch (exit code {app.ExitCode}).");
        }
    }

    Console.WriteLine("Audexa update installed successfully.");
}
catch (Exception ex)
{
    Console.Error.WriteLine(
        $"Failed to install the Audexa update: {ex.Message}");

    if (snapshotComplete && updateStarted)
    {
        Console.Error.WriteLine(
            "Rolling back to the previous version.");

        try
        {
            var originalFiles = (await File.ReadAllLinesAsync(originalFilesList))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            foreach (string file in Directory.EnumerateFiles(
                         target, "*", SearchOption.AllDirectories).ToArray())
            {
                string relative = Path.GetRelativePath(target, file);

                if (!originalFiles.Contains(relative))
                    File.Delete(file);
            }

            foreach (string file in Directory.EnumerateFiles(
                         backup, "*", SearchOption.AllDirectories))
            {
                string relative = Path.GetRelativePath(backup, file);
                string destination = Path.Combine(target, relative);

                Directory.CreateDirectory(
                    Path.GetDirectoryName(destination)!);

                File.Copy(file, destination, overwrite: true);
            }

            Console.Error.WriteLine(
                "Previous version restored successfully.");
        }
        catch (Exception rollbackError)
        {
            Console.Error.WriteLine(
                $"Rollback failed: {rollbackError.Message}");
        }
    }

    Environment.ExitCode = 1;
}
finally
{
    try
    {
        Directory.Delete(temp, recursive: true);
    }
    catch
    {

    }
}
