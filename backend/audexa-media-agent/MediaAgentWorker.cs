using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Diagnostics;
using System.Security.Cryptography;

using Audexa.MediaAgent.Configuration;
using Audexa.MediaAgent.Display;
using Audexa.MediaAgent.Infrastructure;
using Audexa.MediaAgent.Playback;

using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Audexa.MediaAgent;

public sealed class MediaAgentWorker : BackgroundService
{
    private readonly ILogger<MediaAgentWorker> _logger;
    private readonly MediaAgentOptions _options;
    private readonly DisplayEnumerator _displayEnumerator;
    private readonly LibVlcPlayerManager _playerManager;
    private readonly PlaybackUiThread _playbackUiThread;
    private readonly IHostApplicationLifetime _applicationLifetime;
    private readonly HttpClient _downloadClient = new()
    {
        Timeout = Timeout.InfiniteTimeSpan
    };

    private HubConnection? _connection;
    private IReadOnlyList<MediaDisplayDto> _lastDisplays = Array.Empty<MediaDisplayDto>();

    private Guid _hostId;
    private volatile bool _revoked;

    private readonly string _version =
        Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.1.0";

    public MediaAgentWorker(
        ILogger<MediaAgentWorker> logger,
        IOptions<MediaAgentOptions> options,
        DisplayEnumerator displayEnumerator,
        LibVlcPlayerManager playerManager,
        PlaybackUiThread playbackUiThread,
        IHostApplicationLifetime applicationLifetime)
    {
        _logger = logger;
        _options = options.Value;
        _displayEnumerator = displayEnumerator;
        _playerManager = playerManager;
        _playbackUiThread = playbackUiThread;
        _applicationLifetime = applicationLifetime;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!await EnsurePairedAsync(stoppingToken))
            return;

        ValidateOptions();
        LogHostInformation();
        await _playbackUiThread.StartAsync(stoppingToken);

        var heartbeat = Stopwatch.StartNew();
        var displayRefresh = Stopwatch.StartNew();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_connection is null || _connection.State == HubConnectionState.Disconnected)
                {
                    if (_connection is not null)
                    {
                        await _connection.DisposeAsync();
                        _connection = null;
                    }

                    var backendUrl = await ResolveBackendUrlAsync(stoppingToken);
                    if (backendUrl is null)
                    {
                        await Task.Delay(
                            TimeSpan.FromSeconds(Math.Max(3, _options.DiscoveryRetryIntervalSeconds)),
                            stoppingToken);
                        continue;
                    }

                    var hubUrl = new Uri(
                        new Uri(backendUrl.TrimEnd('/') + "/"),
                        _options.HubPath.TrimStart('/'));

                    _logger.LogInformation("Connecting to {HubUrl}...", hubUrl);
                    _connection = CreateHubConnection(hubUrl, stoppingToken);
                    await _connection.StartAsync(stoppingToken);
                    _logger.LogInformation("Connected to Audexa Backend at {BackendUrl}.", backendUrl);

                    await RegisterAsync(stoppingToken);
                    heartbeat.Restart();
                    displayRefresh.Restart();
                }

                if (_revoked)
                {
                    _logger.LogCritical("This Media Agent registration was revoked by an administrator.");
                    FirstRunDialog.ShowError("Доступ этого устройства отозван администратором. Обратитесь к администратору Audexa.");
                    _applicationLifetime.StopApplication();
                    return;
                }

                if (_connection.State == HubConnectionState.Connected)
                {
                    var states = await _playerManager.GetStatesAsync(stoppingToken);
                    await _connection.InvokeAsync("ReportPlaybackStates", states, stoppingToken);
                    if (heartbeat.Elapsed >= TimeSpan.FromSeconds(
                        Math.Max(5, _options.HeartbeatIntervalSeconds)))
                    {
                        await _connection.InvokeAsync(
                            "Heartbeat",
                            cancellationToken: stoppingToken);

                        heartbeat.Restart();
                    }

                    if (displayRefresh.Elapsed >= TimeSpan.FromSeconds(
                        Math.Max(5, _options.DisplayRefreshIntervalSeconds)))
                    {
                        await RefreshDisplaysIfChangedAsync(stoppingToken);
                        displayRefresh.Restart();
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Media Agent communication failed. Will retry.");
            }

            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }

    private async Task<bool> EnsurePairedAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            var saved = AgentConfigurationStore.Load();
            if (saved is not null)
            {
                var token = CredentialStore.Load();
                if (!string.IsNullOrWhiteSpace(token) &&
                    Guid.TryParse(saved.MediaHostId, out var savedHostId))
                {
                    bool credentialIsValid;
                    try
                    {
                        credentialIsValid = await PairingClient.ValidateSavedCredentialAsync(
                            saved.BackendUrl,
                            savedHostId,
                            token,
                            cancellationToken);
                    }
                    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                    {
                        return false;
                    }
                    catch (Exception ex)
                    {
                        // A network/backend outage must not erase a valid local pairing.
                        _logger.LogWarning(ex,
                            "Could not validate saved Media Agent credentials. Will retry without clearing them.");
                        await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
                        continue;
                    }

                    if (credentialIsValid)
                    {
                        _options.MediaHostId = saved.MediaHostId;
                        _options.BackendUrl = saved.BackendUrl;
                        _options.HubPath = saved.HubPath;
                        _options.AccessToken = token;
                        return true;
                    }

                    _logger.LogWarning(
                        "Saved Media Agent credentials were revoked or the host record was deleted. Returning to first-run pairing.");
                    AgentConfigurationStore.Clear();
                }
            }

            // Keep the last known Backend URL as a fallback in the pairing dialog.
            string discoveredUrl = saved?.BackendUrl ?? string.Empty;
            if (_options.DiscoveryEnabled)
            {
                try
                {
                    var discovered = await BackendDiscoveryClient.DiscoverAsync(
                        _options.DiscoveryPort,
                        _options.DiscoveryTimeoutSeconds,
                        _logger,
                        cancellationToken);
                    if (discovered is not null)
                        discoveredUrl = discovered.BaseUri.ToString().TrimEnd('/');
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    return false;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Automatic Backend discovery failed.");
                }
            }

            FirstRunInput? input;
            try
            {
                input = FirstRunDialog.Show(discoveredUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not show the first-run pairing window.");
                await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);
                continue;
            }

            if (input is null)
            {
                _logger.LogInformation("Initial pairing was cancelled. The setup window will be shown again.");
                await Task.Delay(TimeSpan.FromSeconds(15), cancellationToken);
                continue;
            }

            try
            {
                var response = await PairingClient.PairAsync(
                    input.BackendUrl,
                    input.PairingCode,
                    _version,
                    cancellationToken);

                CredentialStore.Save(response.AccessToken);
                AgentConfigurationStore.Save(new AgentConfiguration(
                    response.MediaHostId.ToString("D"),
                    response.BackendUrl,
                    response.HubPath));

                _options.MediaHostId = response.MediaHostId.ToString("D");
                _options.BackendUrl = response.BackendUrl;
                _options.HubPath = response.HubPath;
                _options.AccessToken = response.AccessToken;

                _logger.LogInformation("Media Agent successfully paired with Media Host {MediaHostId}.",
                    response.MediaHostId);
                return true;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Media Agent pairing failed.");
                FirstRunDialog.ShowError(ex.Message);
            }
        }

        return false;
    }

    private HubConnection CreateHubConnection(Uri hubUrl, CancellationToken stoppingToken)
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(hubUrl, options =>
            {
                options.Headers.Add("X-Audexa-Agent-Token", _options.AccessToken);
                options.Headers.Add("X-Audexa-MediaHost-Id", _hostId.ToString("D"));
            })
            .WithAutomaticReconnect(new[]
            {
                TimeSpan.Zero,
                TimeSpan.FromSeconds(2),
                TimeSpan.FromSeconds(5),
                TimeSpan.FromSeconds(10),
                TimeSpan.FromSeconds(20),
                TimeSpan.FromSeconds(30)
            })
            .Build();

        connection.On<PlaybackCommand>("PlaybackCommand", async command =>
        {
            await HandlePlaybackCommandAsync(command, stoppingToken);
        });

        connection.On("MediaHostRevoked", () =>
        {
            _revoked = true;
            try
            {
                AgentConfigurationStore.Clear();
                _logger.LogWarning("Local pairing credentials were cleared after administrator revocation.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not clear revoked Media Agent credentials from local storage.");
            }

            return Task.CompletedTask;
        });

        connection.Reconnected += async connectionId =>
        {
            _logger.LogInformation(
                "SignalR reconnected. ConnectionId={ConnectionId}",
                connectionId);

            await RegisterAsync(stoppingToken);
        };

        connection.Closed += error =>
        {
            if (error is not null)
                _logger.LogWarning(error, "SignalR connection closed. Backend will be discovered again.");

            return Task.CompletedTask;
        };

        return connection;
    }

    private async Task<string?> ResolveBackendUrlAsync(CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(_options.BackendUrl))
            return _options.BackendUrl.TrimEnd('/');

        if (!_options.DiscoveryEnabled)
        {
            _logger.LogError(
                "BackendUrl is empty and Backend Discovery is disabled. Set MediaAgent:BackendUrl or enable Discovery.");
            return null;
        }

        _logger.LogInformation(
            "Searching for Audexa Backend via UDP broadcast on port {Port}...",
            _options.DiscoveryPort);

        var discovered = await BackendDiscoveryClient.DiscoverAsync(
            _options.DiscoveryPort,
            _options.DiscoveryTimeoutSeconds,
            _logger,
            cancellationToken);

        if (discovered is null)
        {
            _logger.LogWarning("Audexa Backend was not discovered. Will retry.");
            return null;
        }

        _logger.LogInformation(
            "Discovered Audexa Backend {MachineName} at {BackendUrl}.",
            discovered.MachineName,
            discovered.BaseUri);

        return discovered.BaseUri.ToString().TrimEnd('/');
    }

    private async Task RegisterAsync(CancellationToken cancellationToken)
    {
        var displays = _displayEnumerator.GetDisplays();

        var request = new MediaHostRegistrationRequest(
            _hostId,
            Environment.MachineName,
            Environment.MachineName,
            _version);

        await _connection!.InvokeAsync(
            "RegisterHost",
            request,
            cancellationToken);

        await ReportDisplaysAsync(displays, cancellationToken);

        _lastDisplays = displays;
        await _playerManager.ReconcileDisplaysAsync(
            displays.Select(display => display.DeviceId).ToArray(), cancellationToken);

        _logger.LogInformation(
            "Registered Media Host {HostId} ({HostName}), displays: {Count}",
            _hostId,
            Environment.MachineName,
            displays.Count);

        LogDisplays(displays);
    }

    private async Task RefreshDisplaysIfChangedAsync(
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var current = _displayEnumerator.GetDisplays();

        if (_lastDisplays.SequenceEqual(current))
            return;

        await ReportDisplaysAsync(current, cancellationToken);

        _lastDisplays = current;
        await _playerManager.ReconcileDisplaysAsync(
            current.Select(display => display.DeviceId).ToArray(), cancellationToken);

        _logger.LogInformation(
            "Display configuration changed. Updated {Count} display(s).",
            current.Count);

        LogDisplays(current);
    }

    private async Task ReportDisplaysAsync(
        IReadOnlyList<MediaDisplayDto> displays,
        CancellationToken cancellationToken)
    {
        var reports = displays
            .Select(display => new DisplayReportRequest(
                display.DeviceId,
                display.Name,
                display.Name,
                display.Width,
                display.Height,
                display.RefreshRate,
                display.IsPrimary))
            .ToArray();

        await _connection!.InvokeAsync(
            "ReportDisplays",
            reports,
            cancellationToken);
    }

    private async Task HandlePlaybackCommandAsync(
        PlaybackCommand command,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Received playback command {CommandId}: {Action} on {DisplayKey}",
            command.CommandId, command.Action, command.DisplayKey);

        await TryReportPlaybackCommandResultAsync(
            command.CommandId, "Accepted", null, cancellationToken);

        try
        {
            switch (command.Action.Trim().ToLowerInvariant())
            {
                case "play":
                    if (command.VideoFileId is null)
                        throw new ArgumentException("VideoFileId is required for Play.");

                    var localVideoPath = await DownloadVideoAsync(command, cancellationToken);
                    await _playerManager.PlayAsync(
                        command.DisplayKey, localVideoPath, cancellationToken);
                    break;
                case "pause":
                    await _playerManager.PauseAsync(command.DisplayKey, cancellationToken);
                    break;
                case "resume":
                    await _playerManager.ResumeAsync(command.DisplayKey, cancellationToken);
                    break;
                case "stop":
                    await _playerManager.StopPlaybackAsync(command.DisplayKey, cancellationToken);
                    break;
                case "close":
                    await _playerManager.CloseAsync(command.DisplayKey, cancellationToken);
                    break;
                case "seek":
                    await _playerManager.SeekAsync(command.DisplayKey, command.PositionMs ?? 0, cancellationToken);
                    break;
                case "volume":
                    await _playerManager.SetVolumeAsync(command.DisplayKey, command.Volume ?? 100, cancellationToken);
                    break;
                case "mute":
                    await _playerManager.SetMuteAsync(command.DisplayKey, command.Muted ?? true, cancellationToken);
                    break;
                default:
                    throw new ArgumentOutOfRangeException(
                        nameof(command.Action), command.Action, "Unsupported playback action.");
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Playback command {CommandId} ({Action}) failed on display {DisplayKey}.",
                command.CommandId, command.Action, command.DisplayKey);

            await TryReportPlaybackCommandResultAsync(
                command.CommandId, "Failed", ex.Message, cancellationToken);
            return;
        }

        await TryReportPlaybackCommandResultAsync(
            command.CommandId, "Completed", null, cancellationToken);
    }

    private async Task<string> DownloadVideoAsync(
        PlaybackCommand command,
        CancellationToken cancellationToken)
    {
        var videoId = command.VideoFileId
            ?? throw new ArgumentException("VideoFileId is required.");

        if (string.IsNullOrWhiteSpace(command.VideoSha256) ||
            command.VideoSha256.Length != 64 ||
            command.VideoSha256.Any(c => !Uri.IsHexDigit(c)))
            throw new InvalidOperationException("Backend supplied an invalid video SHA-256.");

        if (command.VideoSize is null || command.VideoSize <= 0 ||
            command.VideoSize > 4L * 1024 * 1024 * 1024)
            throw new InvalidOperationException("Backend supplied an invalid video size.");

        var extension = Path.GetExtension(command.VideoFileName ?? string.Empty);
        if (string.IsNullOrWhiteSpace(extension) ||
            extension.Length > 12 ||
            extension.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '.'))
            extension = ".media";

        var cacheDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Audexa", "MediaCache");
        Directory.CreateDirectory(cacheDirectory);

        var destinationPath = Path.Combine(cacheDirectory, $"{videoId:N}{extension}");
        var temporaryPath = destinationPath + $".{Guid.NewGuid():N}.part";

        if (File.Exists(destinationPath))
        {
            var existingHash = await ComputeSha256Async(destinationPath, cancellationToken);
            var existingInfo = new FileInfo(destinationPath);
            if (existingInfo.Length == command.VideoSize &&
                string.Equals(existingHash, command.VideoSha256, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Using cached video {VideoId} ({Path})", videoId, destinationPath);
                return destinationPath;
            }

            File.Delete(destinationPath);
        }

        var downloadUri = new Uri(
            new Uri(_options.BackendUrl.TrimEnd('/') + "/"),
            $"api/video/{videoId:D}/agent-download");

        using var request = new HttpRequestMessage(HttpMethod.Get, downloadUri);
        request.Headers.Add("X-Audexa-Agent-Token", _options.AccessToken);
        request.Headers.Add("X-Audexa-MediaHost-Id", _hostId.ToString("D"));

        _logger.LogInformation("Downloading video {VideoId} from Backend.", videoId);

        try
        {
            using var response = await _downloadClient.SendAsync(
                request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();

            if (response.Content.Headers.ContentLength is long contentLength &&
                contentLength != command.VideoSize.Value)
                throw new InvalidDataException(
                    $"Video size mismatch. Expected {command.VideoSize}, received {contentLength}.");

            await using (var source = await response.Content.ReadAsStreamAsync(cancellationToken))
            await using (var target = new FileStream(
                temporaryPath, FileMode.Create, FileAccess.Write, FileShare.None,
                1024 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan))
            {
                await source.CopyToAsync(target, 1024 * 1024, cancellationToken);
            }

            var downloadedInfo = new FileInfo(temporaryPath);
            if (downloadedInfo.Length != command.VideoSize.Value)
                throw new InvalidDataException(
                    $"Downloaded video size mismatch. Expected {command.VideoSize}, received {downloadedInfo.Length}.");

            var actualHash = await ComputeSha256Async(temporaryPath, cancellationToken);
            if (!string.Equals(actualHash, command.VideoSha256, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("Downloaded video SHA-256 verification failed.");

            File.Move(temporaryPath, destinationPath, overwrite: true);
            _logger.LogInformation("Video {VideoId} downloaded and verified ({Bytes} bytes).",
                videoId, downloadedInfo.Length);
            return destinationPath;
        }
        catch
        {
            if (File.Exists(temporaryPath))
                File.Delete(temporaryPath);
            throw;
        }
    }

    private static async Task<string> ComputeSha256Async(
        string path,
        CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(
            path, FileMode.Open, FileAccess.Read, FileShare.Read,
            1024 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan);
        var hash = await SHA256.HashDataAsync(stream, cancellationToken);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private async Task TryReportPlaybackCommandResultAsync(
        string commandId,
        string status,
        string? error,
        CancellationToken cancellationToken)
    {
        try
        {
            var connection = _connection;
            if (connection?.State != HubConnectionState.Connected)
                throw new InvalidOperationException(
                    "Cannot report playback command result while SignalR is disconnected.");

            await connection.InvokeAsync(
                "ReportPlaybackCommandResult",
                new PlaybackCommandResult(commandId, status, error),
                cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Could not report {Status} for playback command {CommandId}.",
                status, commandId);
        }
    }

    private void ValidateOptions()
    {
        if (!string.IsNullOrWhiteSpace(_options.BackendUrl) &&
            (!Uri.TryCreate(_options.BackendUrl, UriKind.Absolute, out var backendUri) ||
             (backendUri.Scheme != Uri.UriSchemeHttp && backendUri.Scheme != Uri.UriSchemeHttps)))
        {
            throw new InvalidOperationException(
                "MediaAgent:BackendUrl must be an absolute HTTP or HTTPS URL when specified.");
        }

        if (_options.DiscoveryPort is < 1 or > 65535)
            throw new InvalidOperationException("MediaAgent:DiscoveryPort must be between 1 and 65535.");

        if (string.IsNullOrWhiteSpace(_options.AccessToken) ||
            !Guid.TryParse(_options.MediaHostId, out _hostId))
        {
            throw new InvalidOperationException(
                "Media Agent has no valid paired credentials. Run the Agent again to pair it with Audexa.");
        }
    }

    private void LogHostInformation()
    {
        var addresses = Dns.GetHostAddresses(Dns.GetHostName())
            .Where(x =>
                x.AddressFamily == AddressFamily.InterNetwork &&
                !IPAddress.IsLoopback(x))
            .Select(x => x.ToString());

        _logger.LogInformation(
            "Host={Host}; OS={OS}; IPv4={Addresses}; HostId={HostId}",
            Environment.MachineName,
            Environment.OSVersion.VersionString,
            string.Join(", ", addresses),
            _hostId);
    }

    private void LogDisplays(IReadOnlyList<MediaDisplayDto> displays)
    {
        if (displays.Count == 0)
        {
            _logger.LogWarning(
                "No active displays detected in the current interactive session.");

            return;
        }

        foreach (var display in displays)
        {
            _logger.LogInformation(
                "Display {DeviceId}: {Name}, {Width}x{Height}@{RefreshRate}Hz, Primary={IsPrimary}",
                display.DeviceId,
                display.Name,
                display.Width,
                display.Height,
                display.RefreshRate,
                display.IsPrimary);
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_connection is not null)
        {
            try
            {
                await _connection.StopAsync(cancellationToken);
            }
            finally
            {
                await _connection.DisposeAsync();
                _connection = null;
            }
        }

        await _playerManager.DisposeAsync();
        _downloadClient.Dispose();
        await _playbackUiThread.DisposeAsync();
        await base.StopAsync(cancellationToken);
    }

    private sealed record MediaHostRegistrationRequest(
        Guid HostId,
        string Name,
        string MachineName,
        string AgentVersion);

    private sealed record DisplayReportRequest(
        string DisplayKey,
        string DeviceName,
        string FriendlyName,
        int Width,
        int Height,
        int RefreshRate,
        bool IsPrimary);
}