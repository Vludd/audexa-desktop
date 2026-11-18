namespace audexa_backend.DTOs;

public sealed record MediaHostRegistrationDto(Guid HostId, string Name, string MachineName, string AgentVersion);
public sealed record DisplayReportDto(string DisplayKey, string DeviceName, string FriendlyName, int Width, int Height, int RefreshRate, bool IsPrimary);
public sealed record MediaHostDto(Guid Id, string Name, string MachineName, string AgentVersion, string Status, string? IpAddress, DateTime LastSeenAtUtc, IReadOnlyList<DisplayDeviceDto> Displays);
public sealed record DisplayDeviceDto(Guid Id, string DisplayKey, string DeviceName, string FriendlyName, int Width, int Height, int RefreshRate, bool IsPrimary);
