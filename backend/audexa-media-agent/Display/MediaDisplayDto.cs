namespace Audexa.MediaAgent.Display;

// Must stay in sync with audexa_backend.Media.MediaDisplayDto.
public sealed record MediaDisplayDto(
    string DeviceId,
    string Name,
    int Width,
    int Height,
    int RefreshRate,
    bool IsPrimary);
