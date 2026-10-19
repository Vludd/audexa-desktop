namespace audexa_backend.DTOs.Schedules;

public sealed record ScheduleDto(
    int Id,
    string Time,
    Guid ScenarioId,
    string ScenarioName,
    IReadOnlyList<string> Days,
    string Repeat,
    bool Enabled,
    string Status,
    DateOnly? ExecutionDate,
    DateTime? LastTriggeredAt,
    string? LastExecutionStatus,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public sealed record CreateScheduleRequest(
    string Time,
    Guid ScenarioId,
    IReadOnlyList<string> Days,
    string Repeat,
    bool Enabled,
    DateOnly? ExecutionDate
);

public sealed record UpdateScheduleRequest(
    string Time,
    Guid ScenarioId,
    IReadOnlyList<string> Days,
    string Repeat,
    bool Enabled,
    DateOnly? ExecutionDate
);

public sealed record ToggleScheduleRequest(bool Enabled);
