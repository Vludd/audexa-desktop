using System.Collections.Concurrent;
using audexa_backend.DTOs;

namespace audexa_backend.Services;

public sealed class MediaPlaybackStateRegistry
{
    private readonly ConcurrentDictionary<(Guid HostId, string DisplayKey), PlaybackStateDto> _states = new();

    public void Update(Guid hostId, AgentPlaybackStateDto state)
    {
        _states[(hostId, state.DisplayKey)] = new PlaybackStateDto(
            hostId,
            state.DisplayKey,
            state.State,
            state.Media,
            state.PositionMs,
            state.DurationMs,
            state.Volume,
            state.IsMuted,
            state.Error,
            DateTime.UtcNow);
    }

    public PlaybackStateDto? Get(Guid hostId, string displayKey) =>
        _states.TryGetValue((hostId, displayKey), out var state) ? state : null;
}
