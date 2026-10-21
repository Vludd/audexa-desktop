using audexa_backend.DTOs.Settings;

namespace audexa_backend.Services;

public interface IAudioSettingsService
{
    Task<AudioSettingsDto> GetAsync(CancellationToken cancellationToken = default);

    Task<AudioSettingsDto> SaveAsync(
        UpdateAudioSettingsRequest request,
        CancellationToken cancellationToken = default);
}
