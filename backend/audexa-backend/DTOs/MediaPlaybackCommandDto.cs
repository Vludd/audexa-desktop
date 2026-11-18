namespace audexa_backend.DTOs;

public sealed record MediaPlaybackCommandDto(
    string Action,
    string DisplayKey,
    string? FilePath = null);
