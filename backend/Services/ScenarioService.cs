using audexa_backend.Data;
using audexa_backend.DTOs.Scenarios;
using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace audexa_backend.Services;

public sealed class ScenarioService
{
    private static readonly string[] ValidStatuses = ["active", "inactive"];
    private static readonly string[] ValidPlayModes = ["sequential"];
    private static readonly string[] ValidRepeats = ["once", "loop"];

    private readonly AppDbContext _db;
    private readonly IAudioDeviceService _audioDevices;

    public ScenarioService(AppDbContext db, IAudioDeviceService audioDevices)
    {
        _db = db;
        _audioDevices = audioDevices;
    }

    public async Task<IReadOnlyList<ScenarioDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        var scenarios = await _db.Scenarios
            .AsNoTracking()
            .Include(x => x.Steps)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return scenarios.Select(ToDto).ToList();
    }

    public async Task<ScenarioDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var scenario = await _db.Scenarios
            .AsNoTracking()
            .Include(x => x.Steps)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return scenario is null ? null : ToDto(scenario);
    }

    public async Task<ScenarioDto> CreateAsync(
        CreateScenarioRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalized = Normalize(
            request.Name,
            request.Description,
            request.Status,
            request.PlayMode,
            request.Repeat,
            request.StopPrevious);

        ValidateScenarioSettings(normalized);

        var steps = request.Steps ?? [];

        await ValidateStepsAsync(
            steps.Select(x => new StepInput(
                x.RoomId,
                x.AudioFileId,
                x.DelayMs,
                x.TranslationAudioFileId)).ToList(),
            cancellationToken);

        if (normalized.Status == "active" && steps.Count == 0)
        {
            throw new ScenarioValidationException(
                "INVALID_SCENARIO",
                ["An active scenario must contain at least one step."]);
        }

        var now = DateTime.UtcNow;

        var scenario = new Scenario
        {
            Id = Guid.NewGuid(),
            Name = normalized.Name,
            Description = normalized.Description,
            Status = normalized.Status,
            PlayMode = normalized.PlayMode,
            Repeat = normalized.Repeat,
            StopPrevious = normalized.StopPrevious,
            CreatedAt = now,
            UpdatedAt = now
        };

        scenario.Steps = steps
            .Select((step, index) => ToEntity(
                scenario.Id,
                index,
                step.RoomId,
                step.AudioFileId,
                step.DelayMs,
                step.TranslationAudioFileId))
            .ToList();

        _db.Scenarios.Add(scenario);

        await _db.SaveChangesAsync(cancellationToken);

        return ToDto(scenario);
    }

    public async Task<ScenarioDto?> UpdateAsync(
        Guid id,
        UpdateScenarioRequest request,
        CancellationToken cancellationToken = default)
    {
        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        var scenario = await _db.Scenarios
            .Include(x => x.Steps)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (scenario is null)
        {
            return null;
        }

        var normalized = Normalize(
            request.Name,
            request.Description,
            request.Status,
            request.PlayMode,
            request.Repeat,
            request.StopPrevious);

        ValidateScenarioSettings(normalized);

        var requestedSteps = request.Steps ?? [];

        await ValidateStepsAsync(
            requestedSteps.Select(x => new StepInput(
                x.RoomId,
                x.AudioFileId,
                x.DelayMs,
                x.TranslationAudioFileId)).ToList(),
            cancellationToken);

        if (normalized.Status == "active" && requestedSteps.Count == 0)
        {
            throw new ScenarioValidationException(
                "INVALID_SCENARIO",
                ["An active scenario must contain at least one step."]);
        }

        /*
         * Update scenario properties.
         */
        scenario.Name = normalized.Name;
        scenario.Description = normalized.Description;
        scenario.Status = normalized.Status;
        scenario.PlayMode = normalized.PlayMode;
        scenario.Repeat = normalized.Repeat;
        scenario.StopPrevious = normalized.StopPrevious;
        scenario.UpdatedAt = DateTime.UtcNow;

        /*
         * Replace scenario steps through EF Core's change tracker.
         *
         * Do NOT use ExecuteDeleteAsync() here.
         *
         * The scenario and its steps are already tracked because of
         * Include(x => x.Steps). Using ExecuteDeleteAsync() bypasses
         * the change tracker and can leave EF with stale entity state,
         * which results in DbUpdateConcurrencyException during SaveChanges().
         */
        var existingSteps = scenario.Steps.ToList();

        if (existingSteps.Count > 0)
        {
            _db.ScenarioSteps.RemoveRange(existingSteps);
        }

        var newSteps = requestedSteps
            .Select((step, index) => ToEntity(
                scenario.Id,
                index,
                step.RoomId,
                step.AudioFileId,
                step.DelayMs,
                step.TranslationAudioFileId))
            .ToList();

        if (newSteps.Count > 0)
        {
            await _db.ScenarioSteps.AddRangeAsync(
                newSteps,
                cancellationToken);
        }

        /*
         * Keep the navigation property synchronized with the new state.
         * The entities are already explicitly attached to the DbContext
         * through RemoveRange/AddRangeAsync above.
         */
        scenario.Steps = newSteps;

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return ToDto(scenario);
    }

    public async Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var scenario = await _db.Scenarios
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (scenario is null)
        {
            return false;
        }

        _db.Scenarios.Remove(scenario);

        await _db.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<ScenarioValidationDto?> ValidateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var scenario = await _db.Scenarios
            .AsNoTracking()
            .Include(x => x.Steps)
                .ThenInclude(x => x.Room)
            .Include(x => x.Steps)
                .ThenInclude(x => x.AudioFile)
            .Include(x => x.Steps)
                .ThenInclude(x => x.TranslationAudioFile)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (scenario is null)
        {
            return null;
        }

        var errors = new List<string>();
        var warnings = new List<string>();

        ValidateScenarioSettings(
            scenario.Name,
            scenario.Description,
            scenario.Status,
            scenario.PlayMode,
            scenario.Repeat,
            scenario.StopPrevious,
            errors);

        var steps = scenario.Steps.OrderBy(x => x.Order).ToList();
        if (steps.Count == 0)
        {
            errors.Add("Scenario must contain at least one step.");
        }

        var settings = await _db.AudioConfigurations
            .AsNoTracking()
            .Include(x => x.Mappings)
            .SingleOrDefaultAsync(cancellationToken);

        AudioDeviceDto? device = null;
        if (string.IsNullOrWhiteSpace(settings?.DeviceId))
        {
            errors.Add("No audio device is configured.");
        }
        else
        {
            device = _audioDevices.FindDevice(settings.DeviceId);
            if (device is null || !string.Equals(device.Status, "online", StringComparison.OrdinalIgnoreCase))
            {
                errors.Add("The configured audio device is unavailable.");
            }
        }

        var mappings = (settings?.Mappings ?? [])
            .Where(x => !string.IsNullOrWhiteSpace(x.OutputId))
            .GroupBy(x => x.RoomId)
            .ToDictionary(
                x => x.Key,
                x => x.Select(y => y.OutputId!).Distinct(StringComparer.Ordinal).ToList());

        foreach (var step in steps)
        {
            var number = step.Order + 1;

            if (step.Room is null)
            {
                errors.Add($"Step {number}: room '{step.RoomId}' was not found.");
            }
            else if (!mappings.TryGetValue(step.RoomId, out var outputIds) || outputIds.Count == 0)
            {
                errors.Add($"Step {number}: room '{step.Room.Name}' has no audio output mapping.");
            }
            else if (device is not null && string.Equals(device.Status, "online", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var outputId in outputIds)
                {
                    if (!_audioDevices.HasOutput(settings!.DeviceId!, outputId))
                    {
                        errors.Add($"Step {number}: output '{outputId}' is not available on the configured audio device.");
                    }
                }
            }

            if (step.AudioFile is null)
            {
                errors.Add($"Step {number}: audio file '{step.AudioFileId}' was not found.");
            }
            else
            {
                var path = GetAudioPath(step.AudioFile.StorageFileName);
                if (!File.Exists(path))
                {
                    errors.Add($"Step {number}: audio file '{step.AudioFile.FileName}' is missing from storage.");
                }

                if (step.AudioFile.Duration <= TimeSpan.Zero)
                {
                    warnings.Add($"Step {number}: audio file '{step.AudioFile.FileName}' has no valid duration metadata.");
                }
            }

            if (step.TranslationAudioFileId is not null)
            {
                if (step.TranslationAudioFile is null)
                {
                    errors.Add($"Step {number}: translation audio file '{step.TranslationAudioFileId}' was not found.");
                }
                else
                {
                    var translationPath = GetAudioPath(step.TranslationAudioFile.StorageFileName);
                    if (!File.Exists(translationPath))
                    {
                        errors.Add($"Step {number}: translation audio file '{step.TranslationAudioFile.FileName}' is missing from storage.");
                    }

                    if (step.TranslationAudioFile.Duration <= TimeSpan.Zero)
                    {
                        warnings.Add($"Step {number}: translation audio file '{step.TranslationAudioFile.FileName}' has no valid duration metadata.");
                    }
                    else if (step.AudioFile is not null && step.AudioFile.Duration > TimeSpan.Zero)
                    {
                        var difference = Math.Abs((step.AudioFile.Duration - step.TranslationAudioFile.Duration).TotalSeconds);
                        if (difference >= 1)
                        {
                            warnings.Add($"Step {number}: translation duration differs from the main audio by {difference:0.#} seconds.");
                        }
                    }
                }

                if (string.IsNullOrWhiteSpace(settings?.TranslationOutputId))
                {
                    errors.Add($"Step {number}: translation audio is selected, but no translation output is configured.");
                }
                else
                {
                    if (mappings.Values.Any(ids => ids.Contains(settings.TranslationOutputId, StringComparer.Ordinal)))
                    {
                        errors.Add($"Step {number}: translation output '{settings.TranslationOutputId}' is also assigned to a room.");
                    }

                    if (device is not null && string.Equals(device.Status, "online", StringComparison.OrdinalIgnoreCase) &&
                        !_audioDevices.HasOutput(settings.DeviceId!, settings.TranslationOutputId))
                    {
                        errors.Add($"Step {number}: translation output '{settings.TranslationOutputId}' is not available on the configured audio device.");
                    }
                }
            }

            if (step.DelayMs < 0)
            {
                errors.Add($"Step {number}: delay cannot be negative.");
            }
        }

        return new ScenarioValidationDto(errors.Count == 0, errors, warnings);
    }

    private static string GetAudioPath(string storageFileName)
    {
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appDataPath, "Audexa", "Audio", storageFileName);
    }

    private async Task ValidateStepsAsync(
        IReadOnlyList<StepInput> steps,
        CancellationToken cancellationToken)
    {
        var errors = new List<string>();

        var roomIds = steps
            .Select(x => x.RoomId)
            .Distinct()
            .ToList();

        var audioIds = steps
            .SelectMany(x => x.TranslationAudioFileId is Guid translationId
                ? new[] { x.AudioFileId, translationId }
                : new[] { x.AudioFileId })
            .Distinct()
            .ToList();

        var existingRoomIds = await _db.Rooms
            .Where(x => roomIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        var existingAudioIds = await _db.AudioFiles
            .Where(x => audioIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        foreach (var step in steps.Select((value, index) => (value, index)))
        {
            if (!existingRoomIds.Contains(step.value.RoomId))
            {
                errors.Add(
                    $"Step {step.index + 1}: room '{step.value.RoomId}' was not found.");
            }

            if (!existingAudioIds.Contains(step.value.AudioFileId))
            {
                errors.Add(
                    $"Step {step.index + 1}: audio file '{step.value.AudioFileId}' was not found.");
            }

            if (step.value.TranslationAudioFileId is Guid translationId &&
                !existingAudioIds.Contains(translationId))
            {
                errors.Add(
                    $"Step {step.index + 1}: translation audio file '{translationId}' was not found.");
            }
            else if (step.value.TranslationAudioFileId == step.value.AudioFileId)
            {
                errors.Add(
                    $"Step {step.index + 1}: main audio and translation must use different audio files.");
            }

            if (step.value.DelayMs < 0)
            {
                errors.Add(
                    $"Step {step.index + 1}: delay cannot be negative.");
            }
        }

        if (errors.Count > 0)
        {
            throw new ScenarioValidationException(
                "INVALID_STEPS",
                errors);
        }
    }

    private static ScenarioSettings Normalize(
        string name,
        string? description,
        string? status,
        string? playMode,
        string? repeat,
        bool stopPrevious)
    {
        return new ScenarioSettings(
            name.Trim(),
            description?.Trim() ?? string.Empty,
            string.IsNullOrWhiteSpace(status)
                ? "inactive"
                : status.Trim().ToLowerInvariant(),
            string.IsNullOrWhiteSpace(playMode)
                ? "sequential"
                : playMode.Trim().ToLowerInvariant(),
            string.IsNullOrWhiteSpace(repeat)
                ? "once"
                : repeat.Trim().ToLowerInvariant(),
            stopPrevious);
    }

    private static void ValidateScenarioSettings(
        ScenarioSettings settings)
    {
        var errors = new List<string>();

        ValidateScenarioSettings(
            settings.Name,
            settings.Description,
            settings.Status,
            settings.PlayMode,
            settings.Repeat,
            settings.StopPrevious,
            errors);

        if (errors.Count > 0)
        {
            throw new ScenarioValidationException(
                "INVALID_SCENARIO",
                errors);
        }
    }

    private static void ValidateScenarioSettings(
        string name,
        string description,
        string status,
        string playMode,
        string repeat,
        bool stopPrevious,
        List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            errors.Add("Scenario name is required.");
        }
        else if (name.Length > 200)
        {
            errors.Add(
                "Scenario name cannot exceed 200 characters.");
        }

        if (description.Length > 2000)
        {
            errors.Add(
                "Scenario description cannot exceed 2000 characters.");
        }

        if (!ValidStatuses.Contains(
                status,
                StringComparer.Ordinal))
        {
            errors.Add(
                $"Unsupported scenario status '{status}'.");
        }

        if (!ValidPlayModes.Contains(
                playMode,
                StringComparer.Ordinal))
        {
            errors.Add(
                $"Unsupported play mode '{playMode}'.");
        }

        if (!ValidRepeats.Contains(
                repeat,
                StringComparer.Ordinal))
        {
            errors.Add(
                $"Unsupported repeat mode '{repeat}'.");
        }
    }

    private static ScenarioStep ToEntity(
        Guid scenarioId,
        int order,
        Guid roomId,
        Guid audioFileId,
        int delayMs,
        Guid? translationAudioFileId)
    {
        return new ScenarioStep
        {
            Id = Guid.NewGuid(),
            ScenarioId = scenarioId,
            Order = order,
            RoomId = roomId,
            AudioFileId = audioFileId,
            TranslationAudioFileId = translationAudioFileId,
            DelayMs = delayMs
        };
    }

    private static ScenarioDto ToDto(Scenario scenario)
    {
        return new ScenarioDto(
            scenario.Id,
            scenario.Name,
            scenario.Description,
            scenario.Status,
            scenario.PlayMode,
            scenario.Repeat,
            scenario.StopPrevious,
            scenario.CreatedAt,
            scenario.UpdatedAt,
            scenario.Steps
                .OrderBy(x => x.Order)
                .Select(x => new ScenarioStepDto(
                    x.Id,
                    x.Order,
                    x.RoomId,
                    x.AudioFileId,
                    x.DelayMs,
                    x.TranslationAudioFileId))
                .ToList());
    }

    private sealed record ScenarioSettings(
        string Name,
        string Description,
        string Status,
        string PlayMode,
        string Repeat,
        bool StopPrevious);

    private sealed record StepInput(
        Guid RoomId,
        Guid AudioFileId,
        int DelayMs,
        Guid? TranslationAudioFileId);
}

public sealed class ScenarioValidationException : Exception
{
    public ScenarioValidationException(
        string code,
        IReadOnlyList<string> errors)
        : base(string.Join(" ", errors))
    {
        Code = code;
        Errors = errors;
    }

    public string Code { get; }

    public IReadOnlyList<string> Errors { get; }
}