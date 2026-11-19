namespace audexa_backend.DTOs;

public sealed record MediaPlaybackCommandDto(
    string Action,
    string DisplayKey,
    string? FilePath = null, long? PositionMs = null, int? Volume = null, bool? Muted = null);

public sealed record PlaybackCommandResultDto(
    string CommandId,
    string Status,
    string? Error = null);

public sealed record PlaybackCommandStatusDto(
    string CommandId,
    Guid HostId,
    string DisplayKey,
    string Action,
    string Status,
    string? Error,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record PlaybackStateDto(Guid HostId, string DisplayKey, string State, string? Media, long PositionMs, long DurationMs, int Volume, bool IsMuted, string? Error, DateTime UpdatedAtUtc);
public sealed record AgentPlaybackStateDto(string DisplayKey, string State, string? Media, long PositionMs, long DurationMs, int Volume, bool IsMuted, string? Error);
