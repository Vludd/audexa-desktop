using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;
using Microsoft.Extensions.Logging;

namespace Audexa.MediaAgent.Playback;

/// <summary>Owns one mpv process and one private named-pipe IPC endpoint per display.</summary>
public sealed class MpvPlayerManager(ILogger<MpvPlayerManager> logger) : IAsyncDisposable
{
    private readonly ConcurrentDictionary<string, PlayerSession> _players =
        new(StringComparer.OrdinalIgnoreCase);

    public async Task PlayAsync(string displayKey, string filePath, string mpvPath, CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(displayKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);

        var fullPath = Path.GetFullPath(filePath);
        if (!File.Exists(fullPath))
            throw new FileNotFoundException("Media file was not found on this Media Host.", fullPath);

        var screens = Screen.AllScreens;
        var screenIndex = Array.FindIndex(screens, x =>
            string.Equals(x.DeviceName, displayKey, StringComparison.OrdinalIgnoreCase));
        if (screenIndex < 0)
            throw new InvalidOperationException($"Display '{displayKey}' is not currently available.");

        var executable = ResolveMpvPath(mpvPath);
        var session = await GetOrStartAsync(displayKey, screenIndex, executable, ct);
        await session.SendCommandAsync(new object[] { "loadfile", fullPath, "replace" }, ct);
        logger.LogInformation("Started playback on {DisplayKey}: {FilePath}", displayKey, fullPath);
    }

    public Task PauseAsync(string displayKey, CancellationToken ct) =>
        SendToPlayerAsync(displayKey, new object[] { "set_property", "pause", true }, ct);

    public Task ResumeAsync(string displayKey, CancellationToken ct) =>
        SendToPlayerAsync(displayKey, new object[] { "set_property", "pause", false }, ct);

    public async Task StopPlaybackAsync(string displayKey, CancellationToken ct)
    {
        if (_players.TryGetValue(displayKey, out var session))
            await session.SendCommandAsync(new object[] { "stop" }, ct);
    }

    public async Task CloseAsync(string displayKey, CancellationToken ct)
    {
        if (!_players.TryRemove(displayKey, out var session))
            return;

        await session.DisposeAsync(ct);
        logger.LogInformation("Closed player for display {DisplayKey}", displayKey);
    }

    private async Task SendToPlayerAsync(string displayKey, object[] command, CancellationToken ct)
    {
        if (!_players.TryGetValue(displayKey, out var session))
            throw new InvalidOperationException($"No player is running for display '{displayKey}'.");

        await session.SendCommandAsync(command, ct);
    }

    private async Task<PlayerSession> GetOrStartAsync(
        string displayKey, int screenIndex, string mpvPath, CancellationToken ct)
    {
        if (_players.TryGetValue(displayKey, out var existing) && !existing.HasExited)
            return existing;

        if (existing is not null)
        {
            _players.TryRemove(displayKey, out _);
            await existing.DisposeAsync(ct);
        }

        var created = await PlayerSession.StartAsync(displayKey, screenIndex, mpvPath, logger, ct);
        if (!_players.TryAdd(displayKey, created))
        {
            await created.DisposeAsync(ct);
            return _players[displayKey];
        }

        return created;
    }

    private static string ResolveMpvPath(string configuredPath)
    {
        var candidate = string.IsNullOrWhiteSpace(configuredPath) ? "mpv.exe" : configuredPath;
        if (Path.IsPathRooted(candidate) && File.Exists(candidate))
            return candidate;

        if (candidate.Contains(Path.DirectorySeparatorChar) || candidate.Contains(Path.AltDirectorySeparatorChar))
            throw new FileNotFoundException("Configured mpv executable does not exist.", candidate);

        return candidate; // Allow executable lookup through PATH.
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var pair in _players.ToArray())
        {
            if (_players.TryRemove(pair.Key, out var session))
                await session.DisposeAsync(CancellationToken.None);
        }
    }

    private sealed class PlayerSession : IAsyncDisposable
    {
        private readonly Process _process;
        private readonly NamedPipeClientStream _pipe;
        private readonly StreamReader _reader;
        private readonly StreamWriter _writer;
        private readonly SemaphoreSlim _ioLock = new(1, 1);
        private int _requestId;

        private PlayerSession(Process process, NamedPipeClientStream pipe)
        {
            _process = process;
            _pipe = pipe;
            _reader = new StreamReader(pipe, Encoding.UTF8, leaveOpen: true);
            _writer = new StreamWriter(pipe, new UTF8Encoding(false), leaveOpen: true) { AutoFlush = true };
        }

        public bool HasExited => _process.HasExited;

        public static async Task<PlayerSession> StartAsync(
            string displayKey, int screenIndex, string mpvPath,
            ILogger logger, CancellationToken ct)
        {
            var pipeName = $"Audexa-mpv-{Guid.NewGuid():N}";
            var pipePath = $@"\\.\pipe\{pipeName}";
            var startInfo = new ProcessStartInfo
            {
                FileName = mpvPath,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = AppContext.BaseDirectory
            };

            startInfo.ArgumentList.Add("--idle=yes");
            startInfo.ArgumentList.Add("--force-window=yes");
            startInfo.ArgumentList.Add("--keep-open=yes");
            startInfo.ArgumentList.Add("--fullscreen=yes");
            startInfo.ArgumentList.Add($"--screen={screenIndex}");
            startInfo.ArgumentList.Add("--no-border");
            startInfo.ArgumentList.Add("--osc=no");
            startInfo.ArgumentList.Add($"--input-ipc-server={pipePath}");

            var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
            if (!process.Start())
                throw new InvalidOperationException("Failed to start mpv process.");

            var pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            try
            {
                await pipe.ConnectAsync(10_000, ct);
                logger.LogInformation("mpv started for {DisplayKey} (PID {ProcessId})", displayKey, process.Id);
                return new PlayerSession(process, pipe);
            }
            catch
            {
                pipe.Dispose();
                try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { }
                process.Dispose();
                throw;
            }
        }

        public async Task SendCommandAsync(object[] command, CancellationToken ct)
        {
            await _ioLock.WaitAsync(ct);
            try
            {
                if (_process.HasExited)
                    throw new InvalidOperationException($"mpv process exited with code {_process.ExitCode}.");

                var requestId = Interlocked.Increment(ref _requestId);
                var payload = JsonSerializer.Serialize(new { command, request_id = requestId });
                await _writer.WriteLineAsync(payload.AsMemory(), ct);

                while (true)
                {
                    var line = await _reader.ReadLineAsync(ct);
                    if (line is null)
                        throw new IOException("mpv IPC pipe was closed.");

                    using var document = JsonDocument.Parse(line);
                    var root = document.RootElement;
                    if (!root.TryGetProperty("request_id", out var responseId) || responseId.GetInt32() != requestId)
                        continue;

                    var error = root.TryGetProperty("error", out var errorElement)
                        ? errorElement.GetString()
                        : null;
                    if (!string.Equals(error, "success", StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException($"mpv command failed: {error ?? "unknown error"}.");

                    return;
                }
            }
            finally
            {
                _ioLock.Release();
            }
        }

        public ValueTask DisposeAsync() => DisposeAsync(CancellationToken.None);

        public async ValueTask DisposeAsync(CancellationToken ct)
        {
            try
            {
                if (!_process.HasExited)
                {
                    try { await SendCommandAsync(new object[] { "quit" }, ct); } catch { }
                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                    timeout.CancelAfter(TimeSpan.FromSeconds(3));
                    try { await _process.WaitForExitAsync(timeout.Token); }
                    catch { if (!_process.HasExited) _process.Kill(entireProcessTree: true); }
                }
            }
            finally
            {
                _reader.Dispose();
                _writer.Dispose();
                _pipe.Dispose();
                _process.Dispose();
                _ioLock.Dispose();
            }
        }
    }
}
