using System.Windows.Forms;
using LibVLCSharp.Shared;
using LibVLCSharp.WinForms;
using Microsoft.Extensions.Logging;

namespace Audexa.MediaAgent.Playback;

/// <summary>Runs one independent LibVLC MediaPlayer and output window per physical display.</summary>
public sealed class LibVlcPlayerManager : IAsyncDisposable
{
    private readonly ILogger<LibVlcPlayerManager> _logger;
    private readonly PlaybackUiThread _uiThread;
    private readonly LibVLC _libVlc;
    private readonly Dictionary<string, PlayerSession> _players = new(StringComparer.OrdinalIgnoreCase);
    private bool _disposed;

    public LibVlcPlayerManager(
        ILogger<LibVlcPlayerManager> logger,
        PlaybackUiThread uiThread)
    {
        _logger = logger;
        _uiThread = uiThread;

        // Match the known-good VLC test configuration: software decoding and GDI output.
        _libVlc = new LibVLC(
            "--no-video-title-show",
            "--avcodec-hw=none",
            "--vout=wingdi",
            "--quiet");
    }

    public Task PlayAsync(string displayKey, string filePath, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => PlayCore(displayKey, filePath), ct);

    public Task PauseAsync(string displayKey, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => GetPlayer(displayKey).MediaPlayer.SetPause(true), ct);

    public Task ResumeAsync(string displayKey, CancellationToken ct) =>
        _uiThread.InvokeAsync(() =>
        {
            GetPlayer(displayKey).MediaPlayer.SetPause(false);
        }, ct);

    public Task StopPlaybackAsync(string displayKey, CancellationToken ct) =>
        _uiThread.InvokeAsync(() =>
        {
            if (_players.TryGetValue(displayKey, out var session))
                session.MediaPlayer.Stop();
        }, ct);

    public Task CloseAsync(string displayKey, CancellationToken ct) =>
        _uiThread.InvokeAsync(() => CloseCore(displayKey), ct);

    private void PlayCore(string displayKey, string filePath)
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
            session = CreateSession(displayKey, screen);
            _players.Add(displayKey, session);
        }
        else if (!session.Form.Visible)
        {
            session.Form.Show();
        }

        session.MediaPlayer.Media = null;
        session.Media?.Dispose();
        session.Media = new Media(_libVlc, new Uri(fullPath));
        session.MediaPlayer.Media = session.Media;
        if (!session.MediaPlayer.Play())
            throw new InvalidOperationException($"LibVLC refused to start playback on '{displayKey}'.");

        _logger.LogInformation("LibVLC playback started on {DisplayKey}: {FilePath}", displayKey, fullPath);
    }

    private PlayerSession CreateSession(string displayKey, Screen screen)
    {
        var form = new Form
        {
            Name = $"Audexa-{Sanitize(displayKey)}",
            Text = "Audexa Media Output",
            FormBorderStyle = FormBorderStyle.None,
            StartPosition = FormStartPosition.Manual,
            Bounds = screen.Bounds,
            WindowState = FormWindowState.Normal,
            ShowInTaskbar = false,
            TopMost = true,
            BackColor = System.Drawing.Color.Black
        };

        var view = new VideoView
        {
            Dock = DockStyle.Fill,
            BackColor = System.Drawing.Color.Black
        };

        var mediaPlayer = new MediaPlayer(_libVlc);
        view.MediaPlayer = mediaPlayer;
        form.Controls.Add(view);
        form.Show();

        _logger.LogInformation(
            "Created LibVLC output window for {DisplayKey} at {Bounds}",
            displayKey, screen.Bounds);

        return new PlayerSession(form, view, mediaPlayer);
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
        session.Media?.Dispose();
        session.MediaPlayer.Dispose();
        session.Form.Close();
        session.View.Dispose();
        session.Form.Dispose();
        _logger.LogInformation("Closed LibVLC output for {DisplayKey}", displayKey);
    }

    private static string Sanitize(string value) =>
        string.Concat(value.Select(c => char.IsLetterOrDigit(c) ? c : '_'));

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
                });
            }
        }
        finally
        {
            _libVlc.Dispose();
        }
    }

    private sealed class PlayerSession(Form form, VideoView view, MediaPlayer mediaPlayer)
    {
        public Form Form { get; } = form;
        public VideoView View { get; } = view;
        public MediaPlayer MediaPlayer { get; } = mediaPlayer;
        public Media? Media { get; set; }
    }
}
