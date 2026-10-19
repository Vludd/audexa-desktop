namespace audexa_backend.DTOs.Playback;

public sealed record PlaybackStartRequest(Guid ScenarioId);

public sealed record PlaybackStepStateDto(
    int Step,
    Guid RoomId,
    string RoomName,
    Guid AudioFileId,
    string AudioFileName,
    string Status,
    int DelayMs,
    double DelayRemainingSeconds,
    double PositionSeconds,
    double DurationSeconds,
    string? OutputId,
    string? Error);

public sealed record PlaybackRoomStateDto(
    Guid RoomId,
    string Status,
    Guid? ScenarioId,
    string? ScenarioName,
    Guid? AudioFileId,
    string? AudioFileName,
    string? OutputId,
    int Step,
    int TotalSteps,
    double PositionSeconds,
    double DurationSeconds,
    int Volume,
    int AudioGainDb,
    string? Error);

public sealed record PlaybackStateDto(
    string Status,
    Guid? ScenarioId,
    string? ScenarioName,
    int CurrentStep,
    int? NextStep,
    int TotalSteps,
    DateTime? StartedAt,
    DateTime? FinishedAt,
    IReadOnlyList<PlaybackRoomStateDto> Rooms,
    IReadOnlyList<PlaybackStepStateDto> Steps,
    string? Error);

public sealed record PlaybackVolumeRequest(int Value);

public sealed record PlaybackSessionDto(Guid SessionId, PlaybackStateDto State);
