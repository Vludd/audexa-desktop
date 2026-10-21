using audexa_backend.DTOs.Diagnostics;

namespace audexa_backend.Services;

public interface IAudioDiagnosticsService
{
    Task<AudioTestResponse> TestOutputAsync(
        AudioTestRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AudioTestResponse>> TestOutputsAsync(
        AudioTestOutputsRequest request,
        CancellationToken cancellationToken = default);
}
