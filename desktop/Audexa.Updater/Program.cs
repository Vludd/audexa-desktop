
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
        throw new ArgumentException($"РќРµ СѓРєР°Р·Р°РЅ Р°СЂРіСѓРјРµРЅС‚ {name}.");

    return args[i + 1].Trim('"');
}

bool HasFlag(string name) =>
    args.Any(a => a.Equals(name, StringComparison.OrdinalIgnoreCase));

string target = Path.GetFullPath(Arg("--target"));
string url = Arg("--url");
string expectedHash = Arg("--sha256");
int pid = int.TryParse(Arg("--pid"), out var parsed) ? parsed : -1;

if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
    uri.Scheme != Uri.UriSchemeHttps)
{
    throw new InvalidDataException(
        "URL РѕР±РЅРѕРІР»РµРЅРёСЏ РґРѕР»Р¶РµРЅ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ HTTPS.");
}

if (expectedHash.Length != 64 || !expectedHash.All(Uri.IsHexDigit))
{
    throw new InvalidDataException(
        "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ SHA-256 РІ РјР°РЅРёС„РµСЃС‚Рµ.");
}

string appPath = Path.Combine(target, "Audexa.Desktop.exe");

if (!File.Exists(appPath))
{
    throw new DirectoryNotFoundException(
        $"РќРµ РЅР°Р№РґРµРЅРѕ РїСЂРёР»РѕР¶РµРЅРёРµ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ: {appPath}");
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
            "РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РёСЃРїРѕР»РЅСЏРµРјС‹Р№ С„Р°Р№Р» РѕР±РЅРѕРІР»СЏС‚РѕСЂР°.");

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
            "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїСѓСЃС‚РёС‚СЊ РєРѕРїРёСЋ РѕР±РЅРѕРІР»СЏС‚РѕСЂР°.");
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
                        "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РІРµСЂС€РёС‚СЊ Audexa РїРµСЂРµРґ РѕР±РЅРѕРІР»РµРЅРёРµРј.");
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
                "РђСЂС…РёРІ РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂРµРІС‹С€Р°РµС‚ РґРѕРїСѓСЃС‚РёРјС‹Р№ СЂР°Р·РјРµСЂ.");
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
                    "РђСЂС…РёРІ РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂРµРІС‹С€Р°РµС‚ РґРѕРїСѓСЃС‚РёРјС‹Р№ СЂР°Р·РјРµСЂ.");
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
                "SHA-256 РЅРµ СЃРѕРІРїР°РґР°РµС‚. РћР±РЅРѕРІР»РµРЅРёРµ РѕС‚РјРµРЅРµРЅРѕ.");
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
                    "РђСЂС…РёРІ СЃРѕРґРµСЂР¶РёС‚ РЅРµРґРѕРїСѓСЃС‚РёРјС‹Р№ РїСѓС‚СЊ.");
            }

            string destination = Path.GetFullPath(
                Path.Combine(staged, normalized));

            if (!destination.StartsWith(
                root, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException(
                    "РћР±РЅР°СЂСѓР¶РµРЅ РІС‹С…РѕРґ Р·Р° РїСЂРµРґРµР»С‹ РєР°С‚Р°Р»РѕРіР° СЂР°СЃРїР°РєРѕРІРєРё.");
            }

            int unixType = (entry.ExternalAttributes >> 16) & 0xF000;

            if (unixType == 0xA000)
            {
                throw new InvalidDataException(
                    "РђСЂС…РёРІ СЃРѕРґРµСЂР¶РёС‚ СЃРёРјРІРѕР»РёС‡РµСЃРєСѓСЋ СЃСЃС‹Р»РєСѓ.");
            }

            extractedSize += entry.Length;

            if (extractedSize > MaxExtractedSize)
            {
                throw new InvalidDataException(
                    "Р Р°СЃРїР°РєРѕРІР°РЅРЅС‹Р№ Р°СЂС…РёРІ РїСЂРµРІС‹С€Р°РµС‚ РґРѕРїСѓСЃС‚РёРјС‹Р№ СЂР°Р·РјРµСЂ.");
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
            "РђСЂС…РёРІ РЅРµ СЃРѕРґРµСЂР¶РёС‚ РІСЃРµС… РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… С„Р°Р№Р»РѕРІ Audexa.");
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
            "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїСѓСЃС‚РёС‚СЊ РѕР±РЅРѕРІР»С‘РЅРЅСѓСЋ Audexa.");
    }

    using (app)
    {
        if (app.WaitForExit(7000))
        {
            throw new InvalidOperationException(
                $"Audexa Р·Р°РІРµСЂС€РёР»Р°СЃСЊ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ Р·Р°РїСѓСЃРєР° (РєРѕРґ {app.ExitCode}).");
        }
    }

    Console.WriteLine("РћР±РЅРѕРІР»РµРЅРёРµ Audexa СѓСЃС‚Р°РЅРѕРІР»РµРЅРѕ.");
}
catch (Exception ex)
{
    Console.Error.WriteLine(
        $"РќРµ СѓРґР°Р»РѕСЃСЊ СѓСЃС‚Р°РЅРѕРІРёС‚СЊ РѕР±РЅРѕРІР»РµРЅРёРµ Audexa: {ex.Message}");

    if (snapshotComplete && updateStarted)
    {
        Console.Error.WriteLine(
            "Р’С‹РїРѕР»РЅСЏРµС‚СЃСЏ РѕС‚РєР°С‚ Рє РїСЂРµРґС‹РґСѓС‰РµР№ РІРµСЂСЃРёРё.");

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
                "РџСЂРµРґС‹РґСѓС‰Р°СЏ РІРµСЂСЃРёСЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР°.");
        }
        catch (Exception rollbackError)
        {
            Console.Error.WriteLine(
                $"РћС€РёР±РєР° РѕС‚РєР°С‚Р°: {rollbackError.Message}");
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
