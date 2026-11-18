namespace audexa_backend.Media;

public sealed record MediaDisplayDto(
    string DeviceId,
    string Name,
    int Width,
    int Height,
    int RefreshRate,
    bool IsPrimary);

public sealed record RegisterMediaHostRequest(
    string HostId,
    string HostName,
    string AgentVersion,
    IReadOnlyList<MediaDisplayDto> Displays);

public sealed record MediaHostSnapshot(
    string HostId,
    string HostName,
    string AgentVersion,
    bool IsOnline,
    DateTimeOffset? LastSeenAt,
    IReadOnlyList<MediaDisplayDto> Displays);
