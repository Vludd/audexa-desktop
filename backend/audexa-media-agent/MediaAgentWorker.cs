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
    private readonly HttpClient _downloadClient = new()
    {
        Timeout = Timeout.InfiniteTimeSpan
    };

    private HubConnection? _connection;
    private IReadOnlyList<MediaDisplayDto> _lastDisplays = Array.Empty<MediaDisplayDto>();

    private readonly Guid _hostId = Guid.Parse(HostIdentity.GetOrCreate());

    private readonly string _version =
        Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.1.0";

    public MediaAgentWorker(
        ILogger<MediaAgentWorker> logger,
        IOptions<MediaAgentOptions> options,
        DisplayEnumerator displayEnumerator,
        LibVlcPlayerManager playerManager,
        PlaybackUiThread playbackUiThread)
    {
        _logger = logger;
        _options = options.Value;
        _displayEnumerator = displayEnumerator;
        _playerManager = playerManager;
        _playbackUiThread = playbackUiThread;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        ValidateOptions();
        LogHostInformation();
        await _playbackUiThread.StartAsync(stoppingToken);

        var hubUrl = new Uri(
            new Uri(_options.BackendUrl.TrimEnd('/') + "/"),
            _options.HubPath.TrimStart('/'));

        _connection = new HubConnectionBuilder()
            .WithUrl(hubUrl, options =>
                options.Headers.Add("X-Audexa-Agent-Token", _options.SharedToken))
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

        _connection.On<PlaybackCommand>("PlaybackCommand", async command =>
        {
            await HandlePlaybackCommandAsync(command, stoppingToken);
        });

        _connection.Reconnected += async connectionId =>
        {
            _logger.LogInformation(
                "SignalR reconnected. ConnectionId={ConnectionId}",
                connectionId);

            await RegisterAsync(stoppingToken);
        };

        _connection.Closed += error =>
        {
            if (error is not null)
                _logger.LogWarning(error, "SignalR connection closed.");

            return Task.CompletedTask;
        };

        var heartbeat = Stopwatch.StartNew();
        var displayRefresh = Stopwatch.StartNew();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_connection.State == HubConnectionState.Disconnected)
                {
                    _logger.LogInformation("Connecting to {HubUrl}...", hubUrl);

                    await _connection.StartAsync(stoppingToken);

                    _logger.LogInformation("Connected to Audexa Backend.");

                    await RegisterAsync(stoppingToken);

                    heartbeat.Restart();
                    displayRefresh.Restart();
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
        request.Headers.Add("X-Audexa-Agent-Token", _options.SharedToken);

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
        if (!Uri.TryCreate(_options.BackendUrl, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException(
                "MediaAgent:BackendUrl must be an absolute URL.");
        }

        if (string.IsNullOrWhiteSpace(_options.SharedToken) ||
            _options.SharedToken.StartsWith(
                "REPLACE_",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Set MediaAgent:SharedToken in appsettings.json or the MediaAgent__SharedToken environment variable before starting the agent.");
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