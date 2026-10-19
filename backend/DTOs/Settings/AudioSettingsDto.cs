namespace audexa_backend.DTOs.Settings;

public sealed record AudioSettingsDto(
    int Version,
    string? DeviceId,
    IReadOnlyList<AudioOutputMappingDto> Mappings,
    string? TranslationOutputId);

public sealed record AudioOutputMappingDto(
    Guid RoomId,
    string? OutputId);

public sealed record UpdateAudioSettingsRequest(
    int Version,
    string? DeviceId,
    IReadOnlyList<AudioOutputMappingDto>? Mappings,
    string? TranslationOutputId);
