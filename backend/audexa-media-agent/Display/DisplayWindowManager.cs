using System.Drawing;
using System.Windows.Forms;
using LibVLCSharp.WinForms;
using Microsoft.Extensions.Logging;

namespace Audexa.MediaAgent.Display;

/// <summary>Owns the borderless output windows used by the Media Agent.</summary>
/// <remarks>All methods must be called on the PlaybackUiThread.</remarks>
public sealed class DisplayWindowManager
{
    private readonly ILogger<DisplayWindowManager> _logger;
    private readonly Dictionary<string, DisplayOutputWindow> _windows =
        new(StringComparer.OrdinalIgnoreCase);

    public DisplayWindowManager(ILogger<DisplayWindowManager> logger)
    {
        _logger = logger;
    }

    public VideoView GetOrCreate(string displayKey, Screen screen)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(displayKey);
        ArgumentNullException.ThrowIfNull(screen);

        if (_windows.TryGetValue(displayKey, out var existing))
        {
            existing.UpdateBounds(screen.Bounds);
            existing.Show();
            return existing.VideoView;
        }

        var outputWindow = new DisplayOutputWindow(displayKey, screen.Bounds);
        _windows.Add(displayKey, outputWindow);
        outputWindow.Show();

        _logger.LogInformation(
            "Created display output window for {DisplayKey} at {Bounds}",
            displayKey, screen.Bounds);

        return outputWindow.VideoView;
    }

    /// <summary>Creates output windows for all currently available displays.</summary>
    public void ReconcileDisplays(IReadOnlyCollection<Screen> screens)
    {
        ArgumentNullException.ThrowIfNull(screens);

        var available = new HashSet<string>(
            screens.Select(screen => screen.DeviceName),
            StringComparer.OrdinalIgnoreCase);

        foreach (var staleKey in _windows.Keys
                     .Where(key => !available.Contains(key))
                     .ToArray())
        {
            Close(staleKey);
        }

        foreach (var screen in screens)
        {
            _ = GetOrCreate(screen.DeviceName, screen);
        }
    }

    public void Close(string displayKey)
    {
        if (!_windows.Remove(displayKey, out var outputWindow))
            return;

        outputWindow.Dispose();
        _logger.LogInformation("Closed display output window for {DisplayKey}", displayKey);
    }

    public void CloseAll()
    {
        foreach (var displayKey in _windows.Keys.ToArray())
            Close(displayKey);
    }

    private sealed class DisplayOutputWindow : IDisposable
    {
        private readonly Form _form;

        public DisplayOutputWindow(string displayKey, Rectangle bounds)
        {
            _form = new Form
            {
                Name = $"Audexa-{Sanitize(displayKey)}",
                Text = "Audexa Media Output",
                FormBorderStyle = FormBorderStyle.None,
                StartPosition = FormStartPosition.Manual,
                Bounds = bounds,
                WindowState = FormWindowState.Normal,
                ShowInTaskbar = false,
                TopMost = true,
                BackColor = Color.Black
            };

            VideoView = new VideoView
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Black
            };

            _form.Controls.Add(VideoView);
        }

        public VideoView VideoView { get; }

        public void UpdateBounds(Rectangle bounds)
        {
            if (_form.Bounds != bounds)
                _form.Bounds = bounds;
        }

        public void Show()
        {
            if (!_form.Visible)
                _form.Show();
        }

        public void Dispose()
        {
            _form.Close();
            VideoView.Dispose();
            _form.Dispose();
        }

        private static string Sanitize(string value) =>
            string.Concat(value.Select(c => char.IsLetterOrDigit(c) ? c : '_'));
    }
}
