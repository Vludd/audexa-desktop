using System.Diagnostics;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
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

        Controls.Add(_web);

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

            // Disable developer tools in production builds.
            _web.CoreWebView2.Settings.AreDevToolsEnabled = false;

            _web.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri))
                {
                    e.Cancel = true;
                    return;
                }

                bool isAppAsset =
                    uri.Scheme == Uri.UriSchemeHttps &&
                    uri.Host.Equals(
                        "appassets.audexa",
                        StringComparison.OrdinalIgnoreCase) &&
                    uri.Port == 443;

                bool isLocalApi =
                    uri.Scheme == Uri.UriSchemeHttp &&
                    uri.Host == "127.0.0.1" &&
                    uri.Port == 5081;

                if (!isAppAsset && !isLocalApi)
                {
                    e.Cancel = true;
                }
            };

            _web.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

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

            _web.Source = new Uri(
                "https://appassets.audexa/index.html");

        }
        catch (Exception ex)
        {
            MessageBox.Show(
                ex.Message,
                "Audexa",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private async void OnWebMessageReceived(
        object? sender,
        CoreWebView2WebMessageReceivedEventArgs e)
    {
        // Only accept commands from the bundled application UI, never arbitrary pages.
        if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var source) ||
            source.Scheme != Uri.UriSchemeHttps ||
            source.Host != "appassets.audexa")
        {
            return;
        }

        try
        {
            using var message = JsonDocument.Parse(e.WebMessageAsJson);
            if (!message.RootElement.TryGetProperty("type", out var type) ||
                type.GetString() != "install-update")
            {
                return;
            }

            await InstallUpdateAsync();
        }
        catch (Exception ex)
        {
            _web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new
            {
                type = "install-update-failed",
                message = ex.Message,
            }));
        }
    }

    private async Task InstallUpdateAsync()
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        var manifest = await client.GetFromJsonAsync<ReleaseManifest>(ManifestUrl)
            ?? throw new InvalidDataException("Пустой release manifest.");

        if (string.IsNullOrWhiteSpace(manifest.Version) ||
            string.IsNullOrWhiteSpace(manifest.PackageUrl) ||
            string.IsNullOrWhiteSpace(manifest.Sha256) ||
            !Version.TryParse(manifest.Version, out var available) ||
            !Uri.TryCreate(manifest.PackageUrl, UriKind.Absolute, out var packageUri) ||
            packageUri.Scheme != Uri.UriSchemeHttps ||
            !packageUri.IsDefaultPort ||
            !packageUri.Host.Equals("github.com", StringComparison.OrdinalIgnoreCase) ||
            packageUri.UserInfo.Length > 0 ||
            packageUri.Query.Length > 0 ||
            packageUri.Fragment.Length > 0 ||
            packageUri.AbsolutePath !=
                $"/Vludd/audexa-desktop/releases/download/v{manifest.Version}/Audexa-Update-{manifest.Version}-win-x64.zip" ||
            manifest.Sha256.Length != 64 ||
            !manifest.Sha256.All(Uri.IsHexDigit))
        {
            throw new InvalidDataException(
                "Манифест содержит некорректный URL, версию или SHA-256.");
        }

        var current = Assembly.GetExecutingAssembly().GetName().Version
            ?? new Version(1, 0, 0);

        if (available <= current)
        {
            MessageBox.Show(
                "Установлена актуальная версия Audexa.",
                "Обновления",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        var updater = Path.Combine(_installDir, "updater", "Audexa.Updater.exe");
        if (!File.Exists(updater))
        {
            throw new FileNotFoundException("Не найден updater.", updater);
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

        using var updaterProcess = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Не удалось запустить updater.");

        Close();
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
