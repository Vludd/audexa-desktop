namespace audexa_backend.DTOs;

public sealed record MediaPlaybackCommandDto(
    string Action,
    string DisplayKey,
    string? FilePath = null);

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
