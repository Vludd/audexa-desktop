using System.Windows.Forms;
using LibVLCSharp.Shared;
using LibVLCSharp.WinForms;
using Audexa.MediaAgent.Display;
using Microsoft.Extensions.Logging;

namespace Audexa.MediaAgent.Playback;

/// <summary>Runs one independent LibVLC MediaPlayer per physical display.</summary>
public sealed class LibVlcPlayerManager : IAsyncDisposable
{
    private readonly ILogger<LibVlcPlayerManager> _logger;
    private readonly PlaybackUiThread _uiThread;
    private readonly DisplayWindowManager _windowManager;
    private readonly LibVLC _libVlc;
    private readonly Dictionary<string, PlayerSession> _players = new(StringComparer.OrdinalIgnoreCase);
    private bool _disposed;

    public LibVlcPlayerManager(
        ILogger<LibVlcPlayerManager> logger,
        PlaybackUiThread uiThread,
        DisplayWindowManager windowManager)
    {
        _logger = logger;
        _uiThread = uiThread;
        _windowManager = windowManager;

        // Match the known-good VLC test configuration: software decoding and GDI output.
        _libVlc = new LibVLC(
            "--no-video-title-show",
            "--avcodec-hw=none",
            "--vout=wingdi",
            "--quiet");
    }

    public Task PlayAsync(string displayKey, string filePath, bool? muted, int? volume, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => PlayCore(displayKey, filePath, muted, volume), ct);

    public Task PauseAsync(string displayKey, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => GetPlayer(displayKey).MediaPlayer.SetPause(true), ct);

    public Task ResumeAsync(string displayKey, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => GetPlayer(displayKey).MediaPlayer.SetPause(false), ct);

    public Task StopPlaybackAsync(string displayKey, CancellationToken ct) =>
        _uiThread.InvokeAsync(() =>
        {
            if (_players.TryGetValue(displayKey, out var session))
                session.MediaPlayer.Stop();
        }, ct);

    public Task CloseAsync(string displayKey, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => CloseCore(displayKey), ct);


    public Task SeekAsync(string displayKey, long positionMs, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => GetPlayer(displayKey).MediaPlayer.Time = Math.Max(0, positionMs), ct);

    public Task SetVolumeAsync(string displayKey, int volume, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => GetPlayer(displayKey).MediaPlayer.Volume = Math.Clamp(volume, 0, 200), ct);

    public Task SetMuteAsync(string displayKey, bool muted, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => GetPlayer(displayKey).MediaPlayer.Mute = muted, ct);

    public Task<IReadOnlyList<PlaybackStateReport>> GetStatesAsync(CancellationToken ct) =>
        _uiThread.InvokeAsync<IReadOnlyList<PlaybackStateReport>>(() => _players.Select(pair =>
        {
            var player = pair.Value.MediaPlayer;
            var state = player.State switch
            {
                VLCState.Opening => "Opening", VLCState.Buffering => "Buffering",
                VLCState.Playing => "Playing", VLCState.Paused => "Paused",
                VLCState.Stopped => "Stopped", VLCState.Ended => "Ended",
                VLCState.Error => "Error", _ => "Idle"
            };
            return new PlaybackStateReport(pair.Key, state, pair.Value.Media?.Mrl,
                Math.Max(0, player.Time), Math.Max(0, player.Length),
                Math.Clamp(player.Volume, 0, 200), player.Mute, null);
        }).ToArray(), ct);

    /// <summary>Closes output sessions for displays that are no longer present.</summary>
    public Task ReconcileDisplaysAsync(
        IReadOnlyCollection<string> availableDisplayKeys,
        CancellationToken ct) =>
        _uiThread.InvokeAsync(() =>
        {
            ObjectDisposedException.ThrowIf(_disposed, this);

            var available = new HashSet<string>(
                availableDisplayKeys,
                StringComparer.OrdinalIgnoreCase);

            foreach (var displayKey in _players.Keys
                         .Where(key => !available.Contains(key))
                         .ToArray())
            {
                CloseCore(displayKey);
            }

            var availableScreens = Screen.AllScreens
                .Where(screen => available.Contains(screen.DeviceName))
                .ToArray();

            _windowManager.ReconcileDisplays(availableScreens);

            _logger.LogInformation(
                "Reconciled display output windows. Available displays: {Count}",
                availableScreens.Length);
        }, ct);

    private void PlayCore(string displayKey, string filePath, bool? muted, int? volume)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentException.ThrowIfNullOrWhiteSpace(displayKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);

        var fullPath = Path.GetFullPath(filePath);
        if (!File.Exists(fullPath))
            throw new FileNotFoundException("Media file was not found on this Media Host.", fullPath);

        var screen = Screen.AllScreens.FirstOrDefault(x =>
            string.Equals(x.DeviceName, displayKey, StringComparison.OrdinalIgnoreCase));
        if (screen is null)
            throw new InvalidOperationException($"Display '{displayKey}' is not currently available.");

        if (!_players.TryGetValue(displayKey, out var session))
        {
            var view = _windowManager.GetOrCreate(displayKey, screen);
            var mediaPlayer = new MediaPlayer(_libVlc);
            view.MediaPlayer = mediaPlayer;
            session = new PlayerSession(view, mediaPlayer);
            _players.Add(displayKey, session);
        }

        session.MediaPlayer.Media = null;
        session.Media?.Dispose();
        session.Media = new Media(_libVlc, new Uri(fullPath));
        session.MediaPlayer.Media = session.Media;

        // Apply the selected audio route before starting playback so that the
        // first decoded audio frames cannot leak to the Media Host speakers.
        session.MediaPlayer.Mute = muted ?? false;
        if (volume.HasValue)
            session.MediaPlayer.Volume = Math.Clamp(volume.Value, 0, 200);

        if (!session.MediaPlayer.Play())
            throw new InvalidOperationException($"LibVLC refused to start playback on '{displayKey}'.");

        _logger.LogInformation("LibVLC playback started on {DisplayKey}: {FilePath}", displayKey, fullPath);
    }

    private PlayerSession GetPlayer(string displayKey) =>
        _players.TryGetValue(displayKey, out var session)
            ? session
            : throw new InvalidOperationException($"No player is running for display '{displayKey}'.");

    private void CloseCore(string displayKey)
    {
        if (!_players.Remove(displayKey, out var session))
            return;

        session.MediaPlayer.Stop();
        session.MediaPlayer.Media = null;
        session.View.MediaPlayer = null;
        session.Media?.Dispose();
        session.MediaPlayer.Dispose();
        _windowManager.Close(displayKey);
        _logger.LogInformation("Closed playback session for {DisplayKey}", displayKey);
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
            return;

        _disposed = true;
        try
        {
            if (_uiThread.IsStarted)
            {
                await _uiThread.InvokeAsync(() =>
                {
                    foreach (var key in _players.Keys.ToArray())
                        CloseCore(key);
                    _windowManager.CloseAll();
                });
            }
        }
        finally
        {
            _libVlc.Dispose();
        }
    }

    private sealed class PlayerSession(VideoView view, MediaPlayer mediaPlayer)
    {
        public VideoView View { get; } = view;
        public MediaPlayer MediaPlayer { get; } = mediaPlayer;
        public Media? Media { get; set; }
    }
}

public sealed record PlaybackStateReport(string DisplayKey, string State, string? Media, long PositionMs, long DurationMs, int Volume, bool IsMuted, string? Error);
