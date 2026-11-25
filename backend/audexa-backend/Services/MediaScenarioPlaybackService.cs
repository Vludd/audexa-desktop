using audexa_backend.DTOs;
using audexa_backend.Hubs;
using audexa_backend.Models;
using Microsoft.AspNetCore.SignalR;

namespace audexa_backend.Services;

/// <summary>
/// Coordinates scenario-owned video playback on a paired Media Agent.
/// The Media Agent remains responsible for decoding and presenting video.
/// </summary>
public sealed class MediaScenarioPlaybackService(
    IHubContext<MediaHostHub> hub,
    PlaybackCommandRegistry commands,
    MediaPlaybackStateRegistry states,
    ILogger<MediaScenarioPlaybackService> logger)
{
    public async Task PlayAsync(
        Guid hostId,
        string displayKey,
        VideoFile video,
        string audioMode,
        Func<bool> isPauseRequested,
        Func<bool> isSkipRequested,
        Action<double, double> reportProgress,
        CancellationToken cancellationToken)
    {
        var muted = !string.Equals(audioMode, "HostOutput", StringComparison.OrdinalIgnoreCase);
        var started = false;
        var pauseCommandSent = false;
        try
        {
            await DispatchAsync(
                hostId,
                displayKey,
                "play",
                video,
                muted,
                cancellationToken,
                isSkipRequested,
                GetHostOutputVolume(video.GainDb));
            var startedAt = DateTime.UtcNow;
            var lastStateAt = startedAt;

            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (isSkipRequested())
                {
                    await TryDispatchStopAsync(hostId, displayKey);
                    return;
                }

                var shouldPause = isPauseRequested();
                var state = states.Get(hostId, displayKey);
                var expectedMediaToken = video.Id.ToString("N");
                if (state is not null &&
                    (state.Media is null || !state.Media.Contains(expectedMediaToken, StringComparison.OrdinalIgnoreCase)))
                    state = null;

                if (shouldPause && !started)
                {
                    // Wait for the Media Agent's initial Play command to become visible.
                    await Task.Delay(100, cancellationToken);
                    continue;
                }

                if (state is not null)
                {
                    lastStateAt = state.UpdatedAtUtc;
                    if (state.DurationMs > 0)
                        reportProgress(Math.Max(0, state.PositionMs) / 1000d, state.DurationMs / 1000d);
                    var normalized = state.State.Trim();
                    if (normalized is "Opening" or "Buffering" or "Playing" or "Paused")
                        started = true;

                    if (normalized.Equals("Error", StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException(state.Error ?? $"Video playback failed on display '{displayKey}'.");

                    if (started && normalized.Equals("Ended", StringComparison.OrdinalIgnoreCase))
                        return;

                    if (started && normalized.Equals("Stopped", StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException($"Video playback stopped unexpectedly on display '{displayKey}'.");
                }

                if (DateTime.UtcNow - startedAt > TimeSpan.FromSeconds(20) && !started)
                    throw new TimeoutException($"Media Agent did not start video playback on display '{displayKey}'.");

                if (started && DateTime.UtcNow - lastStateAt > TimeSpan.FromSeconds(10))
                    throw new TimeoutException($"Lost playback status updates from Media Host '{hostId}'.");

                // The playback state loop owns pause/resume so all scenario controls
                // act on the same playback session.
                if (shouldPause && !pauseCommandSent && started)
                {
                    await DispatchAsync(hostId, displayKey, "pause", null, null, cancellationToken);
                    pauseCommandSent = true;
                }
                else if (!shouldPause && pauseCommandSent)
                {
                    await DispatchAsync(hostId, displayKey, "resume", null, null, cancellationToken);
                    pauseCommandSent = false;
                }

                await Task.Delay(150, cancellationToken);
            }
        }
        catch (MediaPlaybackSkippedException)
        {
            await TryDispatchStopAsync(hostId, displayKey);
            return;
        }
        catch (OperationCanceledException)
        {
            await TryDispatchStopAsync(hostId, displayKey);
            throw;
        }
        catch
        {
            await TryDispatchStopAsync(hostId, displayKey);
            throw;
        }
    }

    private async Task TryDispatchStopAsync(Guid hostId, string displayKey)
    {
        try
        {
            await DispatchAsync(hostId, displayKey, "stop", null, null, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not stop video on Media Host {HostId}, display {DisplayKey}.", hostId, displayKey);
        }
    }

    private async Task DispatchAsync(
        Guid hostId,
        string displayKey,
        string action,
        VideoFile? video,
        bool? muted,
        CancellationToken cancellationToken,
        Func<bool>? abortRequested = null,
        int? volume = null)
    {
        var command = commands.Create(hostId, displayKey, action);
        try
        {
            await hub.Clients.Group($"media-host:{hostId:D}").SendAsync("PlaybackCommand", new
            {
                CommandId = command.CommandId,
                Action = action,
                DisplayKey = displayKey,
                VideoFileId = video?.Id,
                VideoSha256 = video?.Sha256,
                VideoSize = video?.Size,
                VideoFileName = video?.FileName,
                Muted = muted,
                Volume = volume ?? 100
            }, cancellationToken);
        }
        catch
        {
            commands.Update(hostId, new PlaybackCommandResultDto(command.CommandId, "Failed", "Backend could not dispatch the command."));
            throw;
        }

        var dispatchDeadline = DateTime.UtcNow.AddSeconds(15);
        var executionTimeout = action == "play" ? TimeSpan.FromMinutes(10) : TimeSpan.FromSeconds(5);
        DateTime? acceptedAt = null;
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (abortRequested?.Invoke() == true)
                throw new MediaPlaybackSkippedException();

            var status = commands.Get(command.CommandId);
            if (status?.Status == "Completed") return;
            if (status?.Status == "Failed")
                throw new InvalidOperationException(status.Error ?? $"Media command '{action}' failed.");

            if (status?.Status == "Accepted")
            {
                acceptedAt ??= DateTime.UtcNow;
                if (DateTime.UtcNow - acceptedAt.Value > executionTimeout)
                    throw new TimeoutException($"Media Agent did not complete '{action}' command for display '{displayKey}'.");
            }
            else if (DateTime.UtcNow > dispatchDeadline)
            {
                throw new TimeoutException($"Media Agent did not accept '{action}' command for display '{displayKey}'.");
            }

            await Task.Delay(100, cancellationToken);
        }
    }

    private static int GetHostOutputVolume(int gainDb) =>
        Math.Clamp((int)Math.Round(100d * Math.Pow(10d, Math.Clamp(gainDb, -24, 24) / 20d)), 0, 200);

    private sealed class MediaPlaybackSkippedException : Exception { }
}
