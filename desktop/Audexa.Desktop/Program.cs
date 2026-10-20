
using System.Diagnostics;
using System.Net.Http.Json;
using System.Reflection;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Audexa.Desktop;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}

internal sealed class MainForm : Form
{
    private readonly WebView2 _web = new() { Dock = DockStyle.Fill };
    private readonly Label _status = new()
    {
        AutoSize = true,
        Text = "Запуск Audexa…"
    };
    private readonly Button _updateButton = new()
    {
        Text = "Проверить обновления",
        AutoSize = true
    };

    private Process? _backend;

    private readonly string _installDir = ResolveInstallDir();

    private readonly string _dataDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Audexa");

    // Replace with the repository that hosts the desktop release assets.
    private const string ManifestUrl =
        "https://github.com/Vludd/audexa-desktop/releases/latest/download/latest.json";

    public MainForm()
    {
        Text = "Audexa";
        Width = 1440;
        Height = 900;
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1000, 650);

        var top = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 38,
            Padding = new Padding(8, 4, 8, 4),
            WrapContents = false
        };

        top.Controls.Add(_status);
        top.Controls.Add(_updateButton);

        Controls.Add(_web);
        Controls.Add(top);

        _updateButton.Click += async (_, _) =>
            await CheckForUpdatesAsync(showUpToDate: true);

        Shown += async (_, _) => await StartAppAsync();
        FormClosing += (_, _) => StopBackend();
    }

    private static string ResolveInstallDir()
    {
        var executableDir = AppContext.BaseDirectory;

        // Installed layout:
        // Audexa\
        //   Audexa.Desktop.exe
        //   frontend\
        //   backend\
        //   updater\
        if (HasRequiredFiles(executableDir))
            return executableDir;

        // Build/publish layout:
        // publish\
        //   frontend\
        //   backend\
        //   updater\
        //   desktop\
        //     Audexa.Desktop.exe
        var parentDir = Directory.GetParent(
            Path.TrimEndingDirectorySeparator(executableDir))?.FullName;

        if (parentDir is not null && HasRequiredFiles(parentDir))
            return parentDir;

        throw new DirectoryNotFoundException(
            "Не удалось определить каталог Audexa. " +
            $"Каталог приложения: {executableDir}");
    }

    private static bool HasRequiredFiles(string root)
    {
        return File.Exists(Path.Combine(root, "frontend", "index.html"))
            && File.Exists(Path.Combine(root, "backend", "audexa-backend.exe"))
            && File.Exists(Path.Combine(root, "updater", "Audexa.Updater.exe"));
    }

    private async Task StartAppAsync()
    {
        try
        {
            Directory.CreateDirectory(_dataDir);

            var backendExe = Path.Combine(
                _installDir,
                "backend",
                "audexa-backend.exe");

            var start = new ProcessStartInfo(backendExe)
            {
                WorkingDirectory = Path.GetDirectoryName(backendExe)!,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            // Keep the local API inaccessible from the LAN.
            start.Environment["ASPNETCORE_URLS"] =
                "http://127.0.0.1:5081";
            start.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";

            _backend = Process.Start(start)
                ?? throw new InvalidOperationException(
                    "Не удалось запустить backend.");

            using var client = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(2)
            };

            var ready = false;

            for (var i = 0; i < 40; i++)
            {
                if (_backend.HasExited)
                {
                    throw new InvalidOperationException(
                        $"Backend завершился при запуске. Код выхода: {_backend.ExitCode}");
                }

                try
                {
                    using var response = await client.GetAsync(
                        "http://127.0.0.1:5081/api/health");

                    if (response.IsSuccessStatusCode)
                    {
                        ready = true;
                        break;
                    }
                }
                catch (HttpRequestException)
                {
                    // The backend may still be starting.
                }
                catch (TaskCanceledException)
                {
                    // Retry until the startup deadline.
                }

                await Task.Delay(250);
            }

            if (!ready)
            {
                throw new InvalidOperationException(
                    "Backend не ответил на health endpoint за 10 секунд.");
            }

            await _web.EnsureCoreWebView2Async();

            _web.CoreWebView2.Settings.AreDevToolsEnabled = true;

            _web.CoreWebView2.NavigationCompleted += (_, e) =>
            {
                if (!e.IsSuccess)
                {
                    MessageBox.Show(
                        $"Ошибка загрузки интерфейса: {e.WebErrorStatus}",
                        "Audexa",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                }
            };

            _web.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "appassets.audexa",
                Path.Combine(_installDir, "frontend"),
                CoreWebView2HostResourceAccessKind.DenyCors);

            _web.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) ||
                    (uri.Host != "appassets.audexa" &&
                     uri.Host != "127.0.0.1"))
                {
                    e.Cancel = true;
                }
            };

            _web.Source = new Uri(
                "https://appassets.audexa/index.html");

            var version = Assembly.GetExecutingAssembly()
                .GetName().Version;

            _status.Text = $"Audexa {version} • Backend online";

            _ = CheckForUpdatesAsync(showUpToDate: false);
        }
        catch (Exception ex)
        {
            _status.Text = "Ошибка запуска";

            MessageBox.Show(
                ex.Message,
                "Audexa",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private async Task CheckForUpdatesAsync(bool showUpToDate)
    {
        _updateButton.Enabled = false;

        try
        {
            using var client = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(15)
            };

            var manifest = await client.GetFromJsonAsync<ReleaseManifest>(
                ManifestUrl)
                ?? throw new InvalidDataException(
                    "Пустой release manifest.");

            var current = Assembly.GetExecutingAssembly()
                .GetName().Version ?? new Version(1, 0, 0);

            if (!Version.TryParse(manifest.Version, out var available))
            {
                throw new InvalidDataException(
                    "Некорректная версия в manifest.");
            }

            if (available <= current)
            {
                if (showUpToDate)
                {
                    MessageBox.Show(
                        "Установлена актуальная версия Audexa.",
                        "Обновления");
                }

                return;
            }

            var answer = MessageBox.Show(
                $"Доступна Audexa {available} (установлена {current}).\n\n" +
                $"{manifest.ReleaseNotes}\n\n" +
                "Скачать и установить обновление?",
                "Доступно обновление",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Information);

            if (answer != DialogResult.Yes)
                return;

            var updater = Path.Combine(
                _installDir,
                "updater",
                "Audexa.Updater.exe");

            if (!File.Exists(updater))
            {
                throw new FileNotFoundException(
                    "Не найден updater.",
                    updater);
            }

            
            var startInfo = new ProcessStartInfo
            {
                FileName = updater,
                WorkingDirectory = Path.GetDirectoryName(updater)!,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            startInfo.ArgumentList.Add("--url");
            startInfo.ArgumentList.Add(manifest.PackageUrl);

            startInfo.ArgumentList.Add("--sha256");
            startInfo.ArgumentList.Add(manifest.Sha256);

            startInfo.ArgumentList.Add("--target");
            startInfo.ArgumentList.Add(_installDir);

            startInfo.ArgumentList.Add("--pid");
            startInfo.ArgumentList.Add(Environment.ProcessId.ToString());

            var updaterProcess = Process.Start(startInfo);

            if (updaterProcess is null)
            {
                throw new InvalidOperationException(
                    "Failed to start the updater.");
            }

            updaterProcess.Dispose();
            Close();

        }
        catch (Exception ex)
        {
            if (showUpToDate)
            {
                MessageBox.Show(
                    $"Не удалось проверить обновления:\n{ex.Message}",
                    "Audexa",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }

            _status.Text = "Обновления недоступны";
        }
        finally
        {
            _updateButton.Enabled = true;
        }
    }

    private void StopBackend()
    {
        try
        {
            if (_backend is { HasExited: false })
            {
                _backend.Kill(entireProcessTree: true);
                _backend.WaitForExit(3000);
            }
        }
        catch
        {
            // Best-effort shutdown.
        }
        finally
        {
            _backend?.Dispose();
            _backend = null;
        }
    }

    private sealed record ReleaseManifest(
        string Version,
        string PackageUrl,
        string Sha256,
        string ReleaseNotes);
}
