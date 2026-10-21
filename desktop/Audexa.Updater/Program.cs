using System.Diagnostics;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using System.Text.Json;

using Audexa.UpdateCore;

internal static class Program
{
    private const string ManagedFilesManifestName = ".audexa-managed-files.json";

    private sealed record ManagedFilesManifest(
        string Version,
        List<string> Files);

    private const int MaxArchiveEntries = 20_000;
    private const long MaxArchiveSize = 1024L * 1024 * 1024;
    private const long MaxExtractedSize = 2L * 1024 * 1024 * 1024;

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (HasFlag(args, "--preview"))
            {
                ApplicationConfiguration.Initialize();

                using var previewForm = new UpdateForm(
                    target: string.Empty,
                    uri: new Uri("https://example.com/update.zip"),
                    expectedHash: string.Empty,
                    pid: -1,
                    previewMode: true);

                Application.Run(previewForm);
                return 0;
            }

            string target = Path.GetFullPath(Arg(args, "--target"));
            string url = Arg(args, "--url");
            string expectedHash = Arg(args, "--sha256");
            string? optionalPid = OptionalArg(args, "--pid");
            int pid = int.TryParse(optionalPid, out var parsed) && parsed > 0
                ? parsed
                : -1;

            var urlMatch = Uri.TryCreate(url, UriKind.Absolute, out var uri)
                ? Regex.Match(
                    uri.AbsolutePath,
                    @"^/Vludd/audexa-desktop/releases/download/v(?<tag>\d+\.\d+\.\d+)/Audexa-Update-(?<fileVersion>\d+\.\d+\.\d+)-win-x64\.zip$",
                    RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
                : Match.Empty;

            if (uri is null ||
                uri.Scheme != Uri.UriSchemeHttps ||
                !uri.IsDefaultPort ||
                !uri.Host.Equals("github.com", StringComparison.OrdinalIgnoreCase) ||
                uri.UserInfo.Length > 0 ||
                uri.Query.Length > 0 ||
                uri.Fragment.Length > 0 ||
                !urlMatch.Success ||
                !urlMatch.Groups["tag"].Value.Equals(
                    urlMatch.Groups["fileVersion"].Value,
                    StringComparison.Ordinal))
            {
                throw new InvalidDataException(
                    "Update URL must point to a versioned Audexa release ZIP on the official GitHub repository.");
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
        private readonly bool _previewMode;
        private System.Windows.Forms.Timer? _previewTimer;
        private int _previewProgress;

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

        private static readonly Color BackgroundColor =
            Color.FromArgb(22, 30, 41);

        private static readonly Color ForegroundColor =
            Color.FromArgb(230, 237, 246);

        private static readonly Color MutedColor =
            Color.FromArgb(165, 181, 202);

        private static readonly Color ButtonColor =
            Color.FromArgb(38, 52, 69);

        private static readonly Color ButtonHoverColor =
            Color.FromArgb(52, 72, 95);

        private void StartPreview()
        {
            _heading.Text = "Updating Audexa";
            _status.Text = "Downloading update";
            _detail.Text = "8.2 MB of 174.9 MB";

            _progress.Style = ProgressBarStyle.Continuous;
            _progress.Value = 5;

            _finished = true;
            SetButtonState("Close", true);

            _previewTimer = new System.Windows.Forms.Timer
            {
                Interval = 100
            };

            _previewTimer.Tick += (_, _) =>
            {
                _previewProgress = Math.Min(_previewProgress + 1, 100);

                _progress.Value = _previewProgress;
                _detail.Text =
                    $"{174.9 * _previewProgress / 100:0.1} MB of 174.9 MB";

                if (_previewProgress >= 100)
                {
                    _previewTimer.Stop();
                    _status.Text = "Download complete";
                    _detail.Text = "Preview mode - no files were changed.";
                }
            };

            _previewTimer.Start();
        }

        public UpdateForm(
            string target,
            Uri uri,
            string expectedHash,
            int pid,
            bool previewMode = false)
        {
            _target = target;
            _uri = uri;
            _expectedHash = expectedHash;
            _pid = pid;
            _previewMode = previewMode;

            Text = "Audexa Update";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = true;
            ShowInTaskbar = true;
            ClientSize = new Size(520, 250);
            Font = new Font("Segoe UI", 9F);
            BackColor = BackgroundColor;
            ForeColor = ForegroundColor;

            _heading.Text = "Updating Audexa";
            _heading.Font = new Font("Segoe UI Semibold", 15F);
            _heading.SetBounds(24, 20, 470, 32);
            _heading.ForeColor = ForegroundColor;

            _status.Text = "Preparing update...";
            _status.SetBounds(26, 70, 468, 24);
            _status.ForeColor = ForegroundColor;

            _progress.SetBounds(26, 103, 468, 18);
            _progress.Style = ProgressBarStyle.Marquee;
            _progress.MarqueeAnimationSpeed = 25;
            _progress.Minimum = 0;
            _progress.Maximum = 100;
            _progress.Value = 0;

            _detail.Text = "Keep this window open while the update is installed.";
            _detail.SetBounds(26, 132, 468, 40);
            _detail.ForeColor = MutedColor;

            _closeButton.Text = "Please wait...";
            _closeButton.SetBounds(394, 196, 100, 32);
            _closeButton.Enabled = false;
            _closeButton.FlatStyle = FlatStyle.Flat;
            _closeButton.FlatAppearance.BorderColor =
                Color.FromArgb(59, 74, 94);
            _closeButton.FlatAppearance.BorderSize = 1;
            _closeButton.FlatAppearance.MouseOverBackColor = ButtonHoverColor;
            _closeButton.BackColor = ButtonColor;
            _closeButton.ForeColor = ForegroundColor;
            _closeButton.Cursor = Cursors.Hand;
            _closeButton.UseVisualStyleBackColor = false;
            _closeButton.Click += (_, _) => Close();

            Controls.AddRange(
            [
                _heading,
                _status,
                _progress,
                _detail,
                _closeButton
            ]);

            Shown += (_, _) =>
            {
                if (_previewMode)
                    StartPreview();
                else
                    _ = RunUpdateAsync();
            };

            FormClosing += (_, e) =>
            {
                if (!_finished)
                    e.Cancel = true;
            };

            FormClosed += (_, _) =>
            {
                _previewTimer?.Stop();
                _previewTimer?.Dispose();
            };
        }

        private async Task RunUpdateAsync()
        {
            try
            {
                await Task.Run(() => InstallUpdate(
                    _target,
                    _uri,
                    _expectedHash,
                    _pid,
                    ReportProgress));

                _finished = true;

                _heading.Text = "Audexa updated successfully";
                _status.Text = "Update complete";
                _progress.Style = ProgressBarStyle.Continuous;
                _progress.Value = 100;
                _detail.Text = "The updated application has been started.";

                SetButtonState("Close", true);

                await Task.Delay(1200);

                if (!IsDisposed)
                    Close();
            }
            catch (Exception ex)
            {
                _finished = true;

                _heading.Text = "Update failed";
                _status.Text = "The update could not be completed.";
                _progress.Style = ProgressBarStyle.Continuous;
                _progress.Value = 0;
                _detail.Text = ex.Message;
                _detail.Height = 55;

                SetButtonState("Close", true);
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

            // The updater must remain open while the update is in progress.
            SetButtonState("Please wait...", false);
        }

        private void SetButtonState(string text, bool enabled)
        {
            _closeButton.Text = text;
            _closeButton.Enabled = enabled;
            _closeButton.BackColor = ButtonColor;
            _closeButton.ForeColor = enabled
                ? ForegroundColor
                : MutedColor;
            _closeButton.FlatAppearance.BorderColor =
                Color.FromArgb(59, 74, 94);
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

        bool preserveTempForRecovery = false;

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
                string root = Path.GetFullPath(staged)
                    + Path.DirectorySeparatorChar;

                long extractedSize = 0;

                if (archive.Entries.Count > MaxArchiveEntries)
                {
                    throw new InvalidDataException(
                        "Update archive contains too many entries.");
                }

                var entryPaths = new HashSet<string>(
                    StringComparer.OrdinalIgnoreCase);

                var filePaths = new HashSet<string>(
                    StringComparer.OrdinalIgnoreCase);

                var directoryPaths = new HashSet<string>(
                    StringComparer.OrdinalIgnoreCase);

                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    string rawPath = entry.FullName;

                    if (string.IsNullOrWhiteSpace(rawPath) ||
                        rawPath.Contains('\\') ||
                        rawPath.StartsWith('/') ||
                        rawPath.Contains('\0'))
                    {
                        throw new InvalidDataException(
                            "Archive contains an invalid path.");
                    }

                    string[] segments = rawPath.Split('/');

                    bool isDirectory = rawPath.EndsWith('/');

                    if (segments.Any(segment =>
                        segment.Length == 0 ||
                        segment == "." ||
                        segment == ".." ||
                        segment.Contains(':') ||
                        segment.EndsWith('.') ||
                        segment.EndsWith(' ') ||
                        segment.Any(char.IsControl) ||
                        IsReservedWindowsName(segment)))
                    {
                        // ZIP directory entries may end in a single slash.
                        // Remove that final empty segment for validation.
                        if (!(isDirectory &&
                            segments[^1].Length == 0 &&
                            segments.Length > 1 &&
                            segments.Take(segments.Length - 1).All(segment =>
                                segment.Length > 0 &&
                                segment != "." &&
                                segment != ".." &&
                                !segment.Contains(':') &&
                                !segment.EndsWith('.') &&
                                !segment.EndsWith(' ') &&
                                !segment.Any(char.IsControl) &&
                                !IsReservedWindowsName(segment))))
                        {
                            throw new InvalidDataException(
                                "Archive contains an unsafe Windows path.");
                        }
                    }

                    string normalized = string.Join(
                        Path.DirectorySeparatorChar,
                        segments.Where(segment => segment.Length > 0));

                    string destination = Path.GetFullPath(
                        Path.Combine(staged, normalized));

                    if (!destination.StartsWith(
                            root, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidDataException(
                            "Archive entry resolves outside the extraction directory.");
                    }

                    if (!entryPaths.Add(normalized))
                    {
                        throw new InvalidDataException(
                            "Archive contains duplicate or conflicting paths.");
                    }

                    int unixType = (entry.ExternalAttributes >> 16) & 0xF000;

                    if (unixType == 0xA000)
                    {
                        throw new InvalidDataException(
                            "Archive contains a symbolic link.");
                    }

                    if (isDirectory)
                    {
                        directoryPaths.Add(normalized);
                    }
                    else
                    {
                        filePaths.Add(normalized);
                    }

                    extractedSize += entry.Length;

                    if (extractedSize > MaxExtractedSize)
                    {
                        throw new InvalidDataException(
                            "Extracted archive exceeds the maximum allowed size.");
                    }
                }

                foreach (string file in filePaths)
                {
                    if (directoryPaths.Contains(file))
                    {
                        throw new InvalidDataException(
                            "Archive contains a file/directory path conflict.");
                    }

                    string? parent = Path.GetDirectoryName(file);

                    while (!string.IsNullOrEmpty(parent))
                    {
                        if (filePaths.Contains(parent))
                        {
                            throw new InvalidDataException(
                                "Archive contains a file/directory path conflict.");
                        }

                        parent = Path.GetDirectoryName(parent);
                    }
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

            // Read and validate the previous manifest before modifying installation files.
            EnsureNoReparsePoints(target);

            ManagedFilesManifest? previousManifest =
                ReadManagedFilesManifest(target);

            // The update URL was validated before InstallUpdate was called.
            Match versionMatch = Regex.Match(
                uri.AbsolutePath,
                @"^/Vludd/audexa-desktop/releases/download/v(?<tag>\d+\.\d+\.\d+)/Audexa-Update-(?<fileVersion>\d+\.\d+\.\d+)-win-x64\.zip$",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

            if (!versionMatch.Success ||
                !versionMatch.Groups["tag"].Value.Equals(
                    versionMatch.Groups["fileVersion"].Value,
                    StringComparison.Ordinal))
            {
                throw new InvalidDataException(
                    "Could not determine the update version from the release URL.");
            }

            string updateVersion = versionMatch.Groups["fileVersion"].Value;

            // Never accept a package-supplied managed-files manifest.
            string stagedManifest = Path.Combine(
                staged,
                ManagedFilesManifestName);

            if (File.Exists(stagedManifest))
            {
                throw new InvalidDataException(
                    "The update package must not contain the managed-files manifest.");
            }

            report(new(
                "Preparing installation",
                "Creating a backup of the current installation...",
                null));

            var installer = new UpdateInstaller();

            try
            {
                installer.Execute(
                    target,
                    backup,
                    _ =>
                    {
                        report(new(
                            "Installing update",
                            "Replacing application files...",
                            null));

                        string[] stagedFiles = Directory
                            .EnumerateFiles(staged, "*", SearchOption.AllDirectories)
                            .ToArray();

                        var newManagedFiles = stagedFiles
                            .Select(file => Path.GetRelativePath(staged, file)
                                .Replace('\\', '/'))
                            .Append(ManagedFilesManifestName)
                            .ToHashSet(StringComparer.OrdinalIgnoreCase);

                        foreach (string directory in Directory
                            .EnumerateDirectories(staged, "*", SearchOption.AllDirectories)
                            .OrderBy(d => d.Length))
                        {
                            string relative = Path.GetRelativePath(staged, directory);
                            Directory.CreateDirectory(Path.Combine(target, relative));
                        }

                        foreach (string file in stagedFiles)
                        {
                            string relative = Path.GetRelativePath(staged, file);
                            string destination = Path.Combine(target, relative);

                            Directory.CreateDirectory(
                                Path.GetDirectoryName(destination)!);

                            File.Copy(file, destination, overwrite: true);
                        }

                        // Write the new manifest before removing any stale files.
                        WriteManagedFilesManifest(
                            target,
                            updateVersion,
                            newManagedFiles.Where(
                                file => !file.Equals(
                                    ManagedFilesManifestName,
                                    StringComparison.OrdinalIgnoreCase)));

                        if (previousManifest is not null)
                        {
                            EnsureNoReparsePoints(target);

                            foreach (string oldFile in previousManifest.Files)
                            {
                                string safeRelative = GetSafeRelativePath(oldFile)
                                    .Replace('\\', '/');

                                if (newManagedFiles.Contains(safeRelative))
                                    continue;

                                string stalePath = ResolveManagedPath(target, oldFile);

                                if (File.Exists(stalePath))
                                {
                                    File.Delete(stalePath);
                                }
                                else if (Directory.Exists(stalePath))
                                {
                                    throw new InvalidDataException(
                                        $"A managed file path unexpectedly points to a directory: {oldFile}");
                                }
                            }
                        }

                        report(new(
                            "Restarting Audexa",
                            "Starting the updated application...",
                            null));

                        Process app = Process.Start(new ProcessStartInfo(appPath)
                        {
                            UseShellExecute = true,
                            WorkingDirectory = target
                        }) ?? throw new InvalidOperationException(
                            "Could not start the updated Audexa application.");

                        using (app)
                        {
                            if (app.WaitForExit(7000))
                            {
                                throw new InvalidOperationException(
                                    $"Audexa exited shortly after launch (exit code {app.ExitCode}).");
                            }
                        }
                    });
            }
            catch (UpdateInstaller.RollbackFailedException ex)
            {
                // Preserve the recovery copy if automatic rollback could not complete.
                preserveTempForRecovery = true;
                throw new InvalidOperationException(ex.Message, ex);
            }
        }
        finally
        {
            if (!preserveTempForRecovery)
            {
                try
                {
                    Directory.Delete(temp, recursive: true);
                }
                catch
                {
                    // Temporary files are cleaned up on a best-effort basis.
                }
            }
        }
    }

    private static readonly JsonSerializerOptions ManifestJsonOptions = new()
    {
        WriteIndented = true
    };

    private static string GetSafeRelativePath(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath) ||
            Path.IsPathRooted(relativePath) ||
            relativePath.Contains('\\') ||
            relativePath.Contains(':') ||
            relativePath.Contains('\0'))
        {
            throw new InvalidDataException(
                $"Invalid managed file path: {relativePath}");
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
            throw new InvalidDataException(
                $"Unsafe managed file path: {relativePath}");
        }

        return Path.Combine(segments);
    }

    private static string ResolveManagedPath(
        string root,
        string relativePath)
    {
        string safeRelativePath = GetSafeRelativePath(relativePath);
        string rootPath = Path.GetFullPath(root)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

        string destination = Path.GetFullPath(
            Path.Combine(rootPath, safeRelativePath));

        string prefix = rootPath + Path.DirectorySeparatorChar;

        if (!destination.StartsWith(
            prefix,
            StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException(
                $"Managed path escapes the installation directory: {relativePath}");
        }

        return destination;
    }

    private static void EnsureNoReparsePoints(string root)
    {
        string rootPath = Path.GetFullPath(root);
        var rootInfo = new DirectoryInfo(rootPath);

        if (!rootInfo.Exists)
        {
            throw new DirectoryNotFoundException(
                $"Installation directory does not exist: {root}");
        }

        if ((rootInfo.Attributes & FileAttributes.ReparsePoint) != 0)
        {
            throw new InvalidDataException(
                "Installation directory cannot be a reparse point.");
        }

        var pending = new Stack<string>();
        pending.Push(rootPath);

        while (pending.Count > 0)
        {
            string current = pending.Pop();

            foreach (string directory in Directory.EnumerateDirectories(current))
            {
                var info = new DirectoryInfo(directory);

                if ((info.Attributes & FileAttributes.ReparsePoint) != 0)
                {
                    throw new InvalidDataException(
                        $"Reparse point detected in installation: {directory}");
                }

                pending.Push(directory);
            }

            foreach (string file in Directory.EnumerateFiles(current))
            {
                var info = new FileInfo(file);

                if ((info.Attributes & FileAttributes.ReparsePoint) != 0)
                {
                    throw new InvalidDataException(
                        $"Reparse point detected in installation: {file}");
                }
            }
        }
    }


    private static ManagedFilesManifest? ReadManagedFilesManifest(
        string installationDirectory)
    {
        string path = Path.Combine(
            installationDirectory,
            ManagedFilesManifestName);

        // Legacy installations without a manifest must not have
        // untracked files deleted automatically.
        if (!File.Exists(path))
            return null;

        string json = File.ReadAllText(path);

        ManagedFilesManifest manifest =
            JsonSerializer.Deserialize<ManagedFilesManifest>(
                json,
                ManifestJsonOptions)
            ?? throw new InvalidDataException(
                "The managed-files manifest is empty or invalid.");

        if (string.IsNullOrWhiteSpace(manifest.Version) ||
            manifest.Files is null)
        {
            throw new InvalidDataException(
                "The managed-files manifest is missing required fields.");
        }

        var uniquePaths = new HashSet<string>(
            StringComparer.OrdinalIgnoreCase);

        foreach (string file in manifest.Files)
        {
            string safePath = GetSafeRelativePath(file);

            if (!uniquePaths.Add(safePath))
            {
                throw new InvalidDataException(
                    $"The managed-files manifest contains a duplicate path: {file}");
            }
        }

        if (!Version.TryParse(manifest.Version, out _))
        {
            throw new InvalidDataException(
                "The managed-files manifest contains an invalid version.");
        }

        string manifestPath = GetSafeRelativePath(
            ManagedFilesManifestName);

        if (!uniquePaths.Contains(manifestPath))
        {
            throw new InvalidDataException(
                "The managed-files manifest does not list itself.");
        }

        foreach (string managedPath in uniquePaths)
        {
            string? parent = Path.GetDirectoryName(managedPath);

            while (!string.IsNullOrEmpty(parent))
            {
                if (uniquePaths.Contains(parent))
                {
                    throw new InvalidDataException(
                        $"The managed-files manifest contains conflicting paths: {parent} and {managedPath}");
                }

                parent = Path.GetDirectoryName(parent);
            }
        }

        return manifest;
    }

    private static void WriteManagedFilesManifest(
        string installationDirectory,
        string version,
        IEnumerable<string> relativeFiles)
    {
        var files = relativeFiles
            .Select(path => path.Replace('\\', '/'))
            .Append(ManagedFilesManifestName)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (string file in files)
            GetSafeRelativePath(file);

        var manifest = new ManagedFilesManifest(version, files);

        string destination = Path.Combine(
            installationDirectory,
            ManagedFilesManifestName);

        string temporary = destination + ".tmp";

        File.WriteAllText(
            temporary,
            JsonSerializer.Serialize(manifest, ManifestJsonOptions));

        File.Move(temporary, destination, overwrite: true);
    }

    private static bool IsReservedWindowsName(string segment)
    {
        string name = segment.Split('.')[0];

        return name.Equals("CON", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("PRN", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("AUX", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("NUL", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("COM1", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("COM2", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("COM3", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("COM4", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("COM5", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("COM6", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("COM7", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("COM8", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("COM9", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("LPT1", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("LPT2", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("LPT3", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("LPT4", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("LPT5", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("LPT6", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("LPT7", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("LPT8", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("LPT9", StringComparison.OrdinalIgnoreCase);
    }

    private static string FormatBytes(long bytes) =>
        bytes >= 1024L * 1024
            ? $"{bytes / (1024d * 1024):0.0} MB"
            : $"{bytes / 1024d:0.0} KB";
}
