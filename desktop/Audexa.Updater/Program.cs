using System.Diagnostics;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Windows.Forms;

internal static class Program
{
    private const long MaxArchiveSize = 1024L * 1024 * 1024;
    private const long MaxExtractedSize = 2L * 1024 * 1024 * 1024;

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            string target = Path.GetFullPath(Arg(args, "--target"));
            string url = Arg(args, "--url");
            string expectedHash = Arg(args, "--sha256");
            string? optionalPid = OptionalArg(args, "--pid");
            int pid = int.TryParse(optionalPid, out var parsed) && parsed > 0
                ? parsed
                : -1;

            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                uri.Scheme != Uri.UriSchemeHttps)
            {
                throw new InvalidDataException("Update URL must use HTTPS.");
            }

            if (expectedHash.Length != 64 || !expectedHash.All(Uri.IsHexDigit))
            {
                throw new InvalidDataException("The manifest contains an invalid SHA-256 hash.");
            }

            string appPath = Path.Combine(target, "Audexa.Desktop.exe");
            if (!File.Exists(appPath))
            {
                throw new DirectoryNotFoundException(
                    $"Application executable not found for update: {appPath}");
            }

            if (!HasFlag(args, "--bootstrap-copy"))
            {
                StartBootstrapCopy(args);
                return 0;
            }

            ApplicationConfiguration.Initialize();
            Application.Run(new UpdateForm(target, uri, expectedHash, pid));
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                ex.Message,
                "Audexa Update",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }

    private static string Arg(string[] args, string name)
    {
        int i = Array.FindIndex(args, a =>
            a.Equals(name, StringComparison.OrdinalIgnoreCase));

        if (i < 0 || i + 1 >= args.Length)
            throw new ArgumentException($"Required argument is missing: {name}.");

        return args[i + 1].Trim('"');
    }

    private static string? OptionalArg(string[] args, string name)
    {
        int i = Array.FindIndex(args, a =>
            a.Equals(name, StringComparison.OrdinalIgnoreCase));

        return i < 0 || i + 1 >= args.Length
            ? null
            : args[i + 1].Trim('"');
    }

    private static bool HasFlag(string[] args, string name) =>
        args.Any(a => a.Equals(name, StringComparison.OrdinalIgnoreCase));

    private static void StartBootstrapCopy(string[] args)
    {
        string sourceDirectory = AppContext.BaseDirectory;
        string bootstrapDirectory = Path.Combine(
            Path.GetTempPath(),
            "AudexaUpdater-" + Guid.NewGuid().ToString("N"));

        Directory.CreateDirectory(bootstrapDirectory);

        foreach (string file in Directory.EnumerateFiles(sourceDirectory))
        {
            File.Copy(
                file,
                Path.Combine(bootstrapDirectory, Path.GetFileName(file)),
                overwrite: true);
        }

        string processPath = Environment.ProcessPath
            ?? throw new InvalidOperationException("Could not determine the updater executable path.");

        string executable = Path.Combine(
            bootstrapDirectory, Path.GetFileName(processPath));

        var startInfo = new ProcessStartInfo
        {
            FileName = executable,
            WorkingDirectory = bootstrapDirectory,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        foreach (string argument in args)
            startInfo.ArgumentList.Add(argument);

        startInfo.ArgumentList.Add("--bootstrap-copy");

        using Process bootstrapProcess = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Could not start the updater bootstrap process.");
    }

    private sealed class UpdateForm : Form
    {
        private readonly string _target;
        private readonly Uri _uri;
        private readonly string _expectedHash;
        private readonly int _pid;
        private readonly Label _heading = new();
        private readonly Label _status = new();
        private readonly Label _detail = new();
        private readonly ProgressBar _progress = new();
        private readonly Button _closeButton = new();
        private bool _finished;

        public UpdateForm(string target, Uri uri, string expectedHash, int pid)
        {
            _target = target;
            _uri = uri;
            _expectedHash = expectedHash;
            _pid = pid;

            Text = "Audexa — Update";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = true;
            ClientSize = new System.Drawing.Size(520, 250);
            Font = new System.Drawing.Font("Segoe UI", 9F);
            BackColor = System.Drawing.Color.FromArgb(22, 30, 41);
            ForeColor = System.Drawing.Color.FromArgb(230, 237, 246);

            _heading.Text = "Updating Audexa";
            _heading.Font = new System.Drawing.Font("Segoe UI Semibold", 15F);
            _heading.SetBounds(24, 20, 470, 32);

            _status.Text = "Preparing update...";
            _status.SetBounds(26, 70, 468, 24);

            _progress.SetBounds(26, 103, 468, 18);
            _progress.Style = ProgressBarStyle.Continuous;
            _progress.Minimum = 0;
            _progress.Maximum = 100;
            _progress.Value = 0;

            _detail.Text = "Keep this window open while the update is installed.";
            _detail.SetBounds(26, 132, 468, 40);
            _detail.ForeColor = System.Drawing.Color.FromArgb(165, 181, 202);

            _closeButton.Text = "Close";
            _closeButton.SetBounds(394, 196, 100, 32);
            _closeButton.Enabled = false;
            _closeButton.Click += (_, _) => Close();

            Controls.AddRange([_heading, _status, _progress, _detail, _closeButton]);
            Shown += async (_, _) => await RunUpdateAsync();
            FormClosing += (_, e) =>
            {
                if (!_finished)
                    e.Cancel = true;
            };
        }

        private async Task RunUpdateAsync()
        {
            try
            {
                await Task.Run(() => InstallUpdate(
                    _target, _uri, _expectedHash, _pid, ReportProgress));
                _finished = true;
                _heading.Text = "Audexa updated successfully";
                _status.Text = "Update complete";
                _progress.Style = ProgressBarStyle.Continuous;
                _progress.Value = 100;
                _detail.Text = "The updated application has been started.";
                _closeButton.Enabled = true;
                _closeButton.Text = "Close";
                await Task.Delay(1200);
                Close();
            }
            catch (Exception ex)
            {
                _finished = true;
                _heading.Text = "Update failed";
                _status.Text = "The update could not be completed.";
                _progress.Style = ProgressBarStyle.Continuous;
                _detail.Text = ex.Message;
                _detail.Height = 55;
                _closeButton.Enabled = true;
                _closeButton.Text = "Close";
            }
        }

        private void ReportProgress(UpdateStatus update)
        {
            if (IsDisposed)
                return;

            if (InvokeRequired)
            {
                BeginInvoke(() => ReportProgress(update));
                return;
            }

            _status.Text = update.Status;
            _detail.Text = update.Detail;

            if (update.Percent is int percent)
            {
                _progress.Style = ProgressBarStyle.Continuous;
                _progress.Value = Math.Clamp(percent, 0, 100);
            }
            else
            {
                _progress.Style = ProgressBarStyle.Marquee;
            }
        }
    }

    private sealed record UpdateStatus(string Status, string Detail, int? Percent);

    private static void InstallUpdate(
        string target,
        Uri uri,
        string expectedHash,
        int pid,
        Action<UpdateStatus> report)
    {
        string appPath = Path.Combine(target, "Audexa.Desktop.exe");
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

            report(new("Waiting for Audexa to close", "Closing the running application safely...", null));
            if (pid > 0)
            {
                try
                {
                    using Process process = Process.GetProcessById(pid);
                    if (!process.WaitForExit(30000))
                    {
                        process.Kill(entireProcessTree: true);
                        if (!process.WaitForExit(10000))
                            throw new TimeoutException("Could not stop Audexa before applying the update.");
                    }
                }
                catch (ArgumentException)
                {
                    // The process has already exited.
                }
            }

            report(new("Downloading update", "Downloading the update package...", 0));
            using (var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) })
            {
                http.DefaultRequestHeaders.UserAgent.ParseAdd("Audexa-Updater/1.0");
                using HttpResponseMessage response = http.GetAsync(
                    uri, HttpCompletionOption.ResponseHeadersRead).GetAwaiter().GetResult();
                response.EnsureSuccessStatusCode();

                long? contentLength = response.Content.Headers.ContentLength;
                if (contentLength is long length && length > MaxArchiveSize)
                    throw new InvalidDataException("Update archive exceeds the maximum allowed size.");

                using Stream input = response.Content.ReadAsStream();
                using var output = new FileStream(zipPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                byte[] buffer = new byte[81920];
                long total = 0;
                int read;

                while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                {
                    total += read;
                    if (total > MaxArchiveSize)
                        throw new InvalidDataException("Update archive exceeds the maximum allowed size.");

                    output.Write(buffer, 0, read);

                    int? percent = contentLength is > 0
                        ? (int)Math.Min(100, total * 100 / contentLength.Value)
                        : null;

                    report(new(
                        "Downloading update",
                        contentLength is > 0
                            ? $"{FormatBytes(total)} of {FormatBytes(contentLength.Value)}"
                            : $"{FormatBytes(total)} downloaded",
                        percent));
                }
            }

            report(new("Verifying package", "Checking the SHA-256 checksum...", null));
            using (FileStream file = File.OpenRead(zipPath))
            {
                byte[] actual = SHA256.HashData(file);
                byte[] expected = Convert.FromHexString(expectedHash);
                if (!CryptographicOperations.FixedTimeEquals(actual, expected))
                    throw new CryptographicException("SHA-256 mismatch. Update cancelled.");
            }

            report(new("Extracting files", "Validating archive contents...", null));
            using (ZipArchive archive = ZipFile.OpenRead(zipPath))
            {
                string root = Path.GetFullPath(staged) + Path.DirectorySeparatorChar;
                long extractedSize = 0;

                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    string normalized = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                    if (Path.IsPathRooted(normalized) || normalized.Contains(':'))
                        throw new InvalidDataException("Archive contains an invalid path.");

                    string destination = Path.GetFullPath(Path.Combine(staged, normalized));
                    if (!destination.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Archive entry resolves outside the extraction directory.");

                    int unixType = (entry.ExternalAttributes >> 16) & 0xF000;
                    if (unixType == 0xA000)
                        throw new InvalidDataException("Archive contains a symbolic link.");

                    extractedSize += entry.Length;
                    if (extractedSize > MaxExtractedSize)
                        throw new InvalidDataException("Extracted archive exceeds the maximum allowed size.");
                }

                archive.ExtractToDirectory(staged, overwriteFiles: false);
            }

            if (!File.Exists(Path.Combine(staged, "Audexa.Desktop.exe")) ||
                !File.Exists(Path.Combine(staged, "backend", "audexa-backend.exe")) ||
                !File.Exists(Path.Combine(staged, "updater", "Audexa.Updater.exe")) ||
                !File.Exists(Path.Combine(staged, "frontend", "index.html")))
            {
                throw new InvalidDataException("Archive is missing one or more required Audexa files.");
            }

            report(new("Preparing installation", "Creating a backup of the current installation...", null));
            string[] originalFiles = Directory.EnumerateFiles(target, "*", SearchOption.AllDirectories).ToArray();
            File.WriteAllLines(originalFilesList, originalFiles.Select(f => Path.GetRelativePath(target, f)));

            foreach (string file in originalFiles)
            {
                string relative = Path.GetRelativePath(target, file);
                string backupFile = Path.Combine(backup, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(backupFile)!);
                File.Copy(file, backupFile, overwrite: true);
            }

            snapshotComplete = true;
            updateStarted = true;

            report(new("Installing update", "Replacing application files...", null));
            foreach (string directory in Directory.EnumerateDirectories(staged, "*", SearchOption.AllDirectories).OrderBy(d => d.Length))
            {
                string relative = Path.GetRelativePath(staged, directory);
                Directory.CreateDirectory(Path.Combine(target, relative));
            }

            foreach (string file in Directory.EnumerateFiles(staged, "*", SearchOption.AllDirectories))
            {
                string relative = Path.GetRelativePath(staged, file);
                string destination = Path.Combine(target, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                File.Copy(file, destination, overwrite: true);
            }

            report(new("Restarting Audexa", "Starting the updated application...", null));
            Process app = Process.Start(new ProcessStartInfo(appPath)
            {
                UseShellExecute = true,
                WorkingDirectory = target
            }) ?? throw new InvalidOperationException("Could not start the updated Audexa application.");

            using (app)
            {
                if (app.WaitForExit(7000))
                    throw new InvalidOperationException($"Audexa exited shortly after launch (exit code {app.ExitCode}).");
            }
        }
        catch (Exception ex)
        {
            if (snapshotComplete && updateStarted)
            {
                report(new("Restoring previous version", "The update failed. Restoring the previous files...", null));
                try
                {
                    HashSet<string> originalFiles = File.ReadAllLines(originalFilesList)
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    foreach (string file in Directory.EnumerateFiles(target, "*", SearchOption.AllDirectories).ToArray())
                    {
                        string relative = Path.GetRelativePath(target, file);
                        if (!originalFiles.Contains(relative))
                            File.Delete(file);
                    }

                    foreach (string file in Directory.EnumerateFiles(backup, "*", SearchOption.AllDirectories))
                    {
                        string relative = Path.GetRelativePath(backup, file);
                        string destination = Path.Combine(target, relative);
                        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                        File.Copy(file, destination, overwrite: true);
                    }
                }
                catch (Exception rollbackError)
                {
                    throw new InvalidOperationException(
                        $"Update failed: {ex.Message} Rollback also failed: {rollbackError.Message}", ex);
                }
            }

            throw;
        }
        finally
        {
            try { Directory.Delete(temp, recursive: true); }
            catch { /* Temporary files are cleaned up on a best-effort basis. */ }
        }
    }

    private static string FormatBytes(long bytes) =>
        bytes >= 1024L * 1024
            ? $"{bytes / (1024d * 1024):0.0} MB"
            : $"{bytes / 1024d:0.0} KB";
}
