namespace audexa_backend.DTOs.Scenarios;

public sealed record ScenarioDto(
    Guid Id,
    string Name,
    string Description,
    string Status,
    string PlayMode,
    string Repeat,
    bool StopPrevious,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<ScenarioStepDto> Steps
);

public sealed record ScenarioStepDto(
    Guid Id,
    int Order,
    Guid RoomId,
    Guid AudioFileId,
    int DelayMs,
    Guid? TranslationAudioFileId = null
);

public sealed record CreateScenarioRequest(
    string Name,
    string? Description,
    string? Status,
    string? PlayMode,
    string? Repeat,
    bool StopPrevious,
    IReadOnlyList<CreateScenarioStepRequest>? Steps
);

public sealed record UpdateScenarioRequest(
    string Name,
    string? Description,
    string? Status,
    string? PlayMode,
    string? Repeat,
    bool StopPrevious,
    IReadOnlyList<UpdateScenarioStepRequest>? Steps
);

public sealed record CreateScenarioStepRequest(
    Guid RoomId,
    Guid AudioFileId,
    int DelayMs,
    Guid? TranslationAudioFileId = null
);

public sealed record UpdateScenarioStepRequest(
    Guid? Id,
    Guid RoomId,
    Guid AudioFileId,
    int DelayMs,
    Guid? TranslationAudioFileId = null
);

public sealed record ScenarioStatusRequest(string Status);

public sealed record ScenarioValidationDto(
    bool Valid,
    IReadOnlyList<string> Errors,
    IReadOnlyList<string> Warnings
);
