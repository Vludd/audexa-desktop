using System.Windows.Forms;

namespace Audexa.MediaAgent.Playback;

/// <summary>Owns the WinForms message loop used by video output windows.</summary>
public sealed class PlaybackUiThread : IAsyncDisposable
{
    private readonly TaskCompletionSource<Control> _ready =
        new(TaskCreationOptions.RunContinuationsAsynchronously);
    private Thread? _thread;
    private Control? _dispatcher;

    public bool IsStarted => _thread is not null && _ready.Task.IsCompletedSuccessfully;

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_thread is not null)
            return;

        _thread = new Thread(() =>
        {
            try
            {
                Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                var dispatcher = new Control();
                _ = dispatcher.Handle;
                _dispatcher = dispatcher;
                _ready.TrySetResult(dispatcher);
                Application.Run();
                dispatcher.Dispose();
            }
            catch (Exception ex)
            {
                _ready.TrySetException(ex);
            }
        })
        {
            IsBackground = true,
            Name = "Audexa Playback UI"
        };

        _thread.SetApartmentState(ApartmentState.STA);
        _thread.Start();
        await _ready.Task.WaitAsync(cancellationToken);
    }

    public async Task<T> InvokeAsync<T>(Func<T> action, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(action);
        var dispatcher = await _ready.Task.WaitAsync(cancellationToken);
        if (dispatcher.IsDisposed)
            throw new ObjectDisposedException(nameof(PlaybackUiThread));

        var completion = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        dispatcher.BeginInvoke(new Action(() =>
        {
            try { completion.TrySetResult(action()); }
            catch (Exception ex) { completion.TrySetException(ex); }
        }));

        return await completion.Task.WaitAsync(cancellationToken);
    }

    public async Task InvokeAsync(Action action, CancellationToken cancellationToken = default)
    {
        await InvokeAsync(() => { action(); return true; }, cancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        if (_dispatcher is null || _thread is null)
            return;

        try
        {
            await InvokeAsync(() => Application.ExitThread());
        }
        catch (ObjectDisposedException) { }

        if (Thread.CurrentThread != _thread)
            await Task.Run(() => _thread.Join(TimeSpan.FromSeconds(5)));

        _dispatcher = null;
        _thread = null;
    }
}
