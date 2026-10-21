namespace audexa_backend.DTOs.Diagnostics;

public sealed record AudioTestRequest(
    string DeviceId,
    string OutputId,
    string Mode,
    int DurationMs,
    double Volume);

public sealed record AudioTestOutputsRequest(
    string DeviceId,
    IReadOnlyList<string> OutputIds,
    string Mode,
    int DurationMs,
    double Volume);

public sealed record AudioTestResponse(
    bool Ok,
    string OutputId,
    string? Message = null);
