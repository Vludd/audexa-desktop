using System.Diagnostics;
using System.IO.Compression;
using System.Security.Cryptography;

string Arg(string name)
{
    var i = Array.FindIndex(args, a => a.Equals(name, StringComparison.OrdinalIgnoreCase));
    if (i < 0 || i + 1 >= args.Length) throw new ArgumentException($"Missing argument {name}");
    return args[i + 1].Trim('"');
}
string url = Arg("--url"), expectedHash = Arg("--sha256"), target = Path.GetFullPath(Arg("--target"));
int pid = int.TryParse(Arg("--pid"), out var parsed) ? parsed : -1;
if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
    throw new InvalidDataException("Update URL must use HTTPS.");
if (expectedHash.Length != 64 || !expectedHash.All(Uri.IsHexDigit))
    throw new InvalidDataException("Invalid SHA-256 in manifest.");

var temp = Path.Combine(Path.GetTempPath(), "AudexaUpdate-" + Guid.NewGuid().ToString("N"));
var zipPath = Path.Combine(temp, "update.zip");
var staged = Path.Combine(temp, "staged");
var backup = Path.Combine(temp, "backup");
Directory.CreateDirectory(staged);
try
{
    if (pid > 0)
    {
        try { using var process = Process.GetProcessById(pid); if (!process.WaitForExit(30000)) { process.Kill(true); process.WaitForExit(); } } catch { }
    }

    using (var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) })
    {
        http.DefaultRequestHeaders.UserAgent.ParseAdd("Audexa-Updater/1.0");
        using var response = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        await using var output = File.Create(zipPath);
        await response.Content.CopyToAsync(output);
    }

    await using (var file = File.OpenRead(zipPath))
    {
        var actual = Convert.ToHexString(await SHA256.HashDataAsync(file));
        if (!CryptographicOperations.FixedTimeEquals(
            Convert.FromHexString(actual), Convert.FromHexString(expectedHash)))
            throw new CryptographicException("SHA-256 mismatch; update rejected.");
    }

    // Validate every entry BEFORE writing any extracted file (zip-slip protection).
    using (var archive = ZipFile.OpenRead(zipPath))
    {
        var root = Path.GetFullPath(staged) + Path.DirectorySeparatorChar;
        foreach (var entry in archive.Entries)
        {
            var normalized = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
            if (Path.IsPathRooted(normalized)) throw new InvalidDataException("Archive contains an absolute path.");
            var destination = Path.GetFullPath(Path.Combine(staged, normalized));
            if (!destination.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("Archive contains a path traversal entry.");
        }
        archive.ExtractToDirectory(staged, overwriteFiles: false);
    }

    Directory.CreateDirectory(backup);
    foreach (var file in Directory.EnumerateFiles(target, "*", SearchOption.AllDirectories))
    {
        var relative = Path.GetRelativePath(target, file);
        if (relative.StartsWith("data" + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) continue;
        var backupFile = Path.Combine(backup, relative);
        Directory.CreateDirectory(Path.GetDirectoryName(backupFile)!);
        File.Copy(file, backupFile, true);
    }

    try
    {
        foreach (var dir in Directory.EnumerateDirectories(staged, "*", SearchOption.AllDirectories)
                     .OrderBy(d => d.Length))
            Directory.CreateDirectory(Path.Combine(target, Path.GetRelativePath(staged, dir)));
        foreach (var file in Directory.EnumerateFiles(staged, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(staged, file);
            var destination = Path.Combine(target, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(file, destination, true);
        }
    }
    catch
    {
        foreach (var file in Directory.EnumerateFiles(backup, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(backup, file);
            var destination = Path.Combine(target, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(file, destination, true);
        }
        throw;
    }

    var app = Path.Combine(target, "Audexa.Desktop.exe");
    if (File.Exists(app)) Process.Start(new ProcessStartInfo(app) { UseShellExecute = true, WorkingDirectory = target });
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Не удалось установить обновление Audexa: {ex.Message}");
    Environment.ExitCode = 1;
}
finally
{
    try { Directory.Delete(temp, true); } catch { }
}
