namespace audexa_backend.DTOs;

public sealed record MediaHostRegistrationDto(Guid HostId, string Name, string MachineName, string AgentVersion);
public sealed record DisplayReportDto(string DisplayKey, string DeviceName, string FriendlyName, int Width, int Height, int RefreshRate, bool IsPrimary);
public sealed record MediaHostDto(Guid Id, string Name, string MachineName, string AgentVersion, string Status, string? IpAddress, DateTime LastSeenAtUtc, IReadOnlyList<DisplayDeviceDto> Displays);
public sealed record DisplayDeviceDto(Guid Id, string DisplayKey, string DeviceName, string FriendlyName, int Width, int Height, int RefreshRate, bool IsPrimary);

public sealed record CreateMediaHostPairingDto(string HostName, string? Description);
public sealed record MediaHostPairingCreatedDto(Guid Id, string PairingCode, DateTime ExpiresAtUtc);
public sealed record MediaHostPairingDto(Guid Id, string HostName, string? Description, DateTime CreatedAtUtc, DateTime ExpiresAtUtc, DateTime? UsedAtUtc, DateTime? RevokedAtUtc);
public sealed record MediaHostPairRequest(string PairingCode, string MachineName, string AgentVersion);
public sealed record MediaHostPairResponse(Guid MediaHostId, string AccessToken, string BackendUrl, string HubPath);

public sealed record RenameMediaHostDto(string Name);
