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
                x.RoomId, x.AudioFileId, x.DelayMs, x.TranslationAudioFileId,
                x.VideoFileId, x.MediaHostId, x.DisplayKey, x.VideoAudioMode)).ToList(),
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
                step.RoomId, step.AudioFileId, step.DelayMs, step.TranslationAudioFileId,
                step.VideoFileId, step.MediaHostId, step.DisplayKey, step.VideoAudioMode))
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
                x.RoomId, x.AudioFileId, x.DelayMs, x.TranslationAudioFileId,
                x.VideoFileId, x.MediaHostId, x.DisplayKey, x.VideoAudioMode)).ToList(),
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
                step.RoomId, step.AudioFileId, step.DelayMs, step.TranslationAudioFileId,
                step.VideoFileId, step.MediaHostId, step.DisplayKey, step.VideoAudioMode))
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
        Guid id, CancellationToken cancellationToken = default)
    {
        var scenario = await _db.Scenarios.AsNoTracking()
            .Include(x => x.Steps).ThenInclude(x => x.Room)
            .Include(x => x.Steps).ThenInclude(x => x.AudioFile)
            .Include(x => x.Steps).ThenInclude(x => x.TranslationAudioFile)
            .Include(x => x.Steps).ThenInclude(x => x.VideoFile)
            .Include(x => x.Steps).ThenInclude(x => x.MediaHost)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (scenario is null) return null;

        var errors = new List<string>();
        var warnings = new List<string>();
        ValidateScenarioSettings(scenario.Name, scenario.Description, scenario.Status,
            scenario.PlayMode, scenario.Repeat, scenario.StopPrevious, errors);

        var steps = scenario.Steps.OrderBy(x => x.Order).ToList();
        if (steps.Count == 0) errors.Add("Scenario must contain at least one step.");

        var requiresAudioEngine = steps.Any(x => x.AudioFileId.HasValue ||
            (x.VideoFileId.HasValue && string.Equals(x.VideoAudioMode, "RoomOutput", StringComparison.OrdinalIgnoreCase)));
        var settings = await _db.AudioConfigurations.AsNoTracking().Include(x => x.Mappings)
            .SingleOrDefaultAsync(cancellationToken);
        AudioDeviceDto? device = null;
        if (requiresAudioEngine)
        {
            if (string.IsNullOrWhiteSpace(settings?.DeviceId)) errors.Add("No audio device is configured.");
            else
            {
                device = _audioDevices.FindDevice(settings.DeviceId);
                if (device is null || !string.Equals(device.Status, "online", StringComparison.OrdinalIgnoreCase))
                    errors.Add("The configured audio device is unavailable.");
            }
        }

        var mappings = (settings?.Mappings ?? []).Where(x => !string.IsNullOrWhiteSpace(x.OutputId))
            .GroupBy(x => x.RoomId).ToDictionary(x => x.Key,
                x => x.Select(y => y.OutputId!).Distinct(StringComparer.Ordinal).ToList());
        var displayKeys = await _db.DisplayDevices.AsNoTracking()
            .Select(x => new { x.MediaHostId, x.DisplayKey }).ToListAsync(cancellationToken);

        foreach (var step in steps)
        {
            var number = step.Order + 1;
            var mode = NormalizeVideoAudioMode(step.VideoAudioMode, step.VideoFileId.HasValue);
            if (!step.AudioFileId.HasValue && !step.VideoFileId.HasValue)
                errors.Add($"Step {number}: at least one audio file or video file must be selected.");

            if (step.AudioFileId.HasValue)
            {
                if (step.Room is null) errors.Add($"Step {number}: room '{step.RoomId}' was not found.");
                else if (!mappings.TryGetValue(step.RoomId!.Value, out var outputs) || outputs.Count == 0)
                    errors.Add($"Step {number}: room '{step.Room.Name}' has no audio output mapping.");
                else if (device is not null)
                    foreach (var output in outputs)
                        if (!_audioDevices.HasOutput(settings!.DeviceId!, output))
                            errors.Add($"Step {number}: output '{output}' is unavailable.");

                if (step.AudioFile is null) errors.Add($"Step {number}: audio file '{step.AudioFileId}' was not found.");
                else if (!File.Exists(GetAudioPath(step.AudioFile.StorageFileName)))
                    errors.Add($"Step {number}: audio file '{step.AudioFile.FileName}' is missing from storage.");
            }

            if (step.TranslationAudioFileId.HasValue)
            {
                if (!step.AudioFileId.HasValue) errors.Add($"Step {number}: translation requires a main audio file.");
                if (step.TranslationAudioFile is null) errors.Add($"Step {number}: translation audio file '{step.TranslationAudioFileId}' was not found.");
                else if (!File.Exists(GetAudioPath(step.TranslationAudioFile.StorageFileName)))
                    errors.Add($"Step {number}: translation audio file '{step.TranslationAudioFile.FileName}' is missing from storage.");
                if (string.IsNullOrWhiteSpace(settings?.TranslationOutputId))
                    errors.Add($"Step {number}: translation output is not configured.");
                else if (mappings.Values.Any(ids => ids.Contains(settings.TranslationOutputId, StringComparer.Ordinal)))
                    errors.Add($"Step {number}: translation output is also assigned to a room.");
            }

            if (step.VideoFileId.HasValue)
            {
                if (step.VideoFile is null) errors.Add($"Step {number}: video file '{step.VideoFileId}' was not found.");
                else
                {
                    var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                    var path = Path.Combine(appData, "Audexa", "Video", step.VideoFile.StorageFileName);
                    if (!File.Exists(path)) errors.Add($"Step {number}: video file '{step.VideoFile.FileName}' is missing from storage.");
                }
                if (step.MediaHost is null) errors.Add($"Step {number}: Media Host '{step.MediaHostId}' was not found.");
                else if (!string.Equals(step.MediaHost.Status, "Online", StringComparison.OrdinalIgnoreCase))
                    errors.Add($"Step {number}: Media Host '{step.MediaHost.Name}' is offline.");
                if (step.MediaHostId.HasValue && !string.IsNullOrWhiteSpace(step.DisplayKey) &&
                    !displayKeys.Any(x => x.MediaHostId == step.MediaHostId && string.Equals(x.DisplayKey, step.DisplayKey, StringComparison.OrdinalIgnoreCase)))
                    errors.Add($"Step {number}: display '{step.DisplayKey}' is not registered on the selected Media Host.");
                if (mode == "RoomOutput")
                {
                    if (step.Room is null) errors.Add($"Step {number}: RoomOutput requires a valid room.");
                    else if (!mappings.TryGetValue(step.RoomId!.Value, out var outputs) || outputs.Count == 0)
                        errors.Add($"Step {number}: room '{step.Room.Name}' has no audio output mapping.");
                    else if (device is not null)
                        foreach (var output in outputs)
                            if (!_audioDevices.HasOutput(settings!.DeviceId!, output)) errors.Add($"Step {number}: output '{output}' is unavailable.");
                }
                if (step.AudioFileId.HasValue)
                    errors.Add($"Step {number}: a video step uses its own soundtrack; a separate audio file is not supported in the same step.");
            }

            if (step.DelayMs < 0) errors.Add($"Step {number}: delay cannot be negative.");
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
        var roomIds = steps.Where(x => x.RoomId.HasValue).Select(x => x.RoomId!.Value).Distinct().ToList();
        var audioIds = steps.SelectMany(x => new[] { x.AudioFileId, x.TranslationAudioFileId })
            .Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var videoIds = steps.Where(x => x.VideoFileId.HasValue).Select(x => x.VideoFileId!.Value).Distinct().ToList();
        var hostIds = steps.Where(x => x.MediaHostId.HasValue).Select(x => x.MediaHostId!.Value).Distinct().ToList();

        var existingRoomIds = await _db.Rooms.Where(x => roomIds.Contains(x.Id)).Select(x => x.Id).ToListAsync(cancellationToken);
        var existingAudioIds = await _db.AudioFiles.Where(x => audioIds.Contains(x.Id)).Select(x => x.Id).ToListAsync(cancellationToken);
        var existingVideoIds = await _db.VideoFiles.Where(x => videoIds.Contains(x.Id)).Select(x => x.Id).ToListAsync(cancellationToken);
        var hosts = await _db.MediaHosts.AsNoTracking().Where(x => hostIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Status }).ToListAsync(cancellationToken);
        var displays = await _db.DisplayDevices.AsNoTracking()
            .Where(x => hostIds.Contains(x.MediaHostId))
            .Select(x => new { x.MediaHostId, x.DisplayKey }).ToListAsync(cancellationToken);

        foreach (var (step, index) in steps.Select((value, index) => (value, index)))
        {
            var number = index + 1;
            var hasAudio = step.AudioFileId.HasValue;
            var hasVideo = step.VideoFileId.HasValue;
            var mode = NormalizeVideoAudioMode(step.VideoAudioMode, hasVideo);
            if (hasVideo && mode is not ("Muted" or "HostOutput" or "RoomOutput"))
                errors.Add($"Step {number}: unsupported video audio mode '{step.VideoAudioMode}'.");

            if (!hasAudio && !hasVideo)
                errors.Add($"Step {number}: at least one audio file or video file must be selected.");

            if (hasAudio && step.RoomId is null)
                errors.Add($"Step {number}: RoomId is required when an audio file is selected.");
            if (hasVideo && (step.MediaHostId is null || string.IsNullOrWhiteSpace(step.DisplayKey)))
                errors.Add($"Step {number}: MediaHostId and DisplayKey are required when a video file is selected.");

            if (step.RoomId is Guid roomId && !existingRoomIds.Contains(roomId))
                errors.Add($"Step {number}: room '{roomId}' was not found.");
            if (step.AudioFileId is Guid audioId && !existingAudioIds.Contains(audioId))
                errors.Add($"Step {number}: audio file '{audioId}' was not found.");
            if (step.VideoFileId is Guid videoId && !existingVideoIds.Contains(videoId))
                errors.Add($"Step {number}: video file '{videoId}' was not found.");

            if (step.MediaHostId is Guid hostId)
            {
                var host = hosts.FirstOrDefault(x => x.Id == hostId);
                if (host is null)
                    errors.Add($"Step {number}: Media Host '{hostId}' was not found.");
                if (!string.IsNullOrWhiteSpace(step.DisplayKey) &&
                    !displays.Any(x => x.MediaHostId == hostId && string.Equals(x.DisplayKey, step.DisplayKey, StringComparison.OrdinalIgnoreCase)))
                    errors.Add($"Step {number}: display '{step.DisplayKey}' is not registered on Media Host '{hostId}'.");
            }

            if (step.TranslationAudioFileId is Guid translationId)
            {
                if (!existingAudioIds.Contains(translationId))
                    errors.Add($"Step {number}: translation audio file '{translationId}' was not found.");
                if (step.AudioFileId == translationId)
                    errors.Add($"Step {number}: main audio and translation must use different audio files.");
                if (!hasAudio)
                    errors.Add($"Step {number}: translation requires a main audio file.");
            }

            if (hasVideo && mode == "RoomOutput" && step.RoomId is null)
                errors.Add($"Step {number}: RoomId is required for video audio routed to a room.");
            if (hasVideo && step.AudioFileId.HasValue)
                errors.Add($"Step {number}: a video step uses its own soundtrack. Do not attach a separate audio file; select RoomOutput to route the video's soundtrack to the room.");
            if (step.DelayMs < 0)
                errors.Add($"Step {number}: delay cannot be negative.");
        }

        if (errors.Count > 0)
            throw new ScenarioValidationException("INVALID_STEPS", errors);
    }

    private static string? NormalizeVideoAudioMode(string? mode, bool hasVideo)
    {
        if (!hasVideo) return null;
        if (string.IsNullOrWhiteSpace(mode)) return "Muted";
        var normalized = mode.Trim();
        return new[] { "Muted", "HostOutput", "RoomOutput" }
            .FirstOrDefault(x => string.Equals(x, normalized, StringComparison.OrdinalIgnoreCase)) ?? normalized;
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
        Guid scenarioId, int order, Guid? roomId, Guid? audioFileId, int delayMs,
        Guid? translationAudioFileId, Guid? videoFileId, Guid? mediaHostId,
        string? displayKey, string? videoAudioMode)
    {
        return new ScenarioStep
        {
            Id = Guid.NewGuid(), ScenarioId = scenarioId, Order = order,
            RoomId = roomId, AudioFileId = audioFileId,
            TranslationAudioFileId = translationAudioFileId,
            VideoFileId = videoFileId, MediaHostId = mediaHostId,
            DisplayKey = string.IsNullOrWhiteSpace(displayKey) ? null : displayKey.Trim(),
            VideoAudioMode = NormalizeVideoAudioMode(videoAudioMode, videoFileId.HasValue),
            DelayMs = delayMs
        };
    }

    private static ScenarioDto ToDto(Scenario scenario)
    {
        return new ScenarioDto(
            scenario.Id, scenario.Name, scenario.Description, scenario.Status,
            scenario.PlayMode, scenario.Repeat, scenario.StopPrevious,
            scenario.CreatedAt, scenario.UpdatedAt,
            scenario.Steps.OrderBy(x => x.Order).Select(x => new ScenarioStepDto(
                x.Id, x.Order, x.RoomId, x.AudioFileId, x.DelayMs,
                x.TranslationAudioFileId, x.VideoFileId, x.MediaHostId,
                x.DisplayKey, x.VideoAudioMode)).ToList());
    }

    private sealed record ScenarioSettings(
        string Name,
        string Description,
        string Status,
        string PlayMode,
        string Repeat,
        bool StopPrevious);

    private sealed record StepInput(
        Guid? RoomId, Guid? AudioFileId, int DelayMs, Guid? TranslationAudioFileId,
        Guid? VideoFileId, Guid? MediaHostId, string? DisplayKey, string? VideoAudioMode);
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