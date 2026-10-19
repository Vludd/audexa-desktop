using System.Globalization;
using audexa_backend.Data;
using audexa_backend.DTOs.Schedules;
using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace audexa_backend.Services;

public sealed class ScheduleService
{
    private static readonly HashSet<string> ValidDays = new(StringComparer.OrdinalIgnoreCase)
    {
        "mon", "tue", "wed", "thu", "fri", "sat", "sun"
    };

    private static readonly HashSet<string> ValidRepeats = new(StringComparer.OrdinalIgnoreCase)
    {
        "daily", "weekly", "once"
    };

    private readonly AppDbContext _db;

    public ScheduleService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<ScheduleDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        var schedules = await _db.Schedules
            .AsNoTracking()
            .Include(x => x.Scenario)
            .ToListAsync(cancellationToken);

        return schedules
            .OrderBy(x => x.Time)
            .ThenBy(x => x.Id)
            .Select(ToDto)
            .ToList();
    }

    public async Task<ScheduleDto?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var schedule = await _db.Schedules
            .AsNoTracking()
            .Include(x => x.Scenario)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return schedule is null ? null : ToDto(schedule);
    }

    public async Task<ScheduleDto> CreateAsync(
        CreateScheduleRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalized = Normalize(request.Time, request.ScenarioId, request.Days, request.Repeat, request.Enabled, request.ExecutionDate);
        await ValidateAsync(normalized, cancellationToken);
        await ValidateConflictsAsync(normalized, null, cancellationToken);

        var now = DateTime.UtcNow;
        var schedule = new Schedule
        {
            Time = normalized.Time,
            ScenarioId = normalized.ScenarioId,
            Days = string.Join(',', normalized.Days),
            Repeat = normalized.Repeat,
            Enabled = normalized.Enabled,
            ExecutionDate = normalized.ExecutionDate,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Schedules.Add(schedule);
        await _db.SaveChangesAsync(cancellationToken);

        schedule.Scenario = await _db.Scenarios
            .AsNoTracking()
            .FirstAsync(x => x.Id == schedule.ScenarioId, cancellationToken);

        return ToDto(schedule);
    }

    public async Task<ScheduleDto?> UpdateAsync(
        int id,
        UpdateScheduleRequest request,
        CancellationToken cancellationToken = default)
    {
        var schedule = await _db.Schedules
            .Include(x => x.Scenario)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (schedule is null)
        {
            return null;
        }

        var normalized = Normalize(request.Time, request.ScenarioId, request.Days, request.Repeat, request.Enabled, request.ExecutionDate);
        await ValidateAsync(normalized, cancellationToken);
        await ValidateConflictsAsync(normalized, id, cancellationToken);

        schedule.Time = normalized.Time;
        schedule.ScenarioId = normalized.ScenarioId;
        schedule.Days = string.Join(',', normalized.Days);
        schedule.Repeat = normalized.Repeat;
        schedule.Enabled = normalized.Enabled;
        schedule.ExecutionDate = normalized.ExecutionDate;
        // Editing a schedule creates a new definition, so reset its execution guard.
        schedule.LastTriggeredAt = null;
        schedule.LastExecutionStatus = null;
        schedule.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        schedule.Scenario = await _db.Scenarios
            .AsNoTracking()
            .FirstAsync(x => x.Id == schedule.ScenarioId, cancellationToken);

        return ToDto(schedule);
    }

    public async Task<ScheduleDto?> ToggleAsync(
        int id,
        ToggleScheduleRequest request,
        CancellationToken cancellationToken = default)
    {
        var schedule = await _db.Schedules
            .Include(x => x.Scenario)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (schedule is null)
        {
            return null;
        }

        if (request.Enabled &&
            string.Equals(schedule.Repeat, "once", StringComparison.OrdinalIgnoreCase) &&
            schedule.LastTriggeredAt is not null)
        {
            throw new ScheduleValidationException(
                "ONCE_ALREADY_CONSUMED",
                "This one-time schedule has already been attempted. Edit it and choose a new execution date.");
        }

        if (request.Enabled)
        {
            var normalized = Normalize(
                schedule.Time.ToString(@"hh\:mm"),
                schedule.ScenarioId,
                schedule.Days.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                schedule.Repeat,
                true,
                schedule.ExecutionDate);

            await ValidateAsync(normalized, cancellationToken);
            await ValidateConflictsAsync(normalized, id, cancellationToken);
        }

        schedule.Enabled = request.Enabled;
        schedule.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(schedule);
    }

    public async Task<bool> DeleteAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var schedule = await _db.Schedules.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (schedule is null)
        {
            return false;
        }

        _db.Schedules.Remove(schedule);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task ValidateConflictsAsync(
        NormalizedSchedule candidate,
        int? excludedId,
        CancellationToken cancellationToken)
    {
        if (!candidate.Enabled)
        {
            return;
        }

        var existingSchedules = await _db.Schedules
            .AsNoTracking()
            .Include(x => x.Scenario)
                .ThenInclude(x => x.Steps)
            .Where(x => x.Enabled && (!excludedId.HasValue || x.Id != excludedId.Value))
            .ToListAsync(cancellationToken);

        var candidateScenario = await _db.Scenarios
            .AsNoTracking()
            .Include(x => x.Steps)
            .FirstAsync(x => x.Id == candidate.ScenarioId, cancellationToken);

        var candidateRooms = candidateScenario.Steps.Select(x => x.RoomId).ToHashSet();

        foreach (var existing in existingSchedules)
        {
            if (existing.Time != candidate.Time ||
                !DatesCanOverlap(candidate, existing))
            {
                continue;
            }

            var existingRooms = existing.Scenario.Steps.Select(x => x.RoomId).ToHashSet();
            var sharedRoom = candidateRooms.Overlaps(existingRooms);
            var stopPreviousConflict = candidateScenario.StopPrevious || existing.Scenario.StopPrevious;

            if (!sharedRoom && !stopPreviousConflict)
            {
                continue;
            }

            var reason = stopPreviousConflict
                ? "At least one scenario uses Stop Previous and could interrupt the other scheduled playback."
                : "Both scenarios use one or more of the same rooms.";

            throw new ScheduleValidationException(
                "SCHEDULE_CONFLICT",
                $"Schedule conflicts with schedule #{existing.Id} at {candidate.Time:hh\\:mm}. {reason}");
        }
    }

    private static bool DatesCanOverlap(
        NormalizedSchedule candidate,
        Schedule existing)
    {
        var candidateDays = candidate.Days.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existingDays = existing.Days
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (candidate.Repeat == "once" && existing.Repeat == "once")
        {
            return candidate.ExecutionDate == existing.ExecutionDate;
        }

        if (candidate.Repeat == "once")
        {
            return candidate.ExecutionDate is { } date &&
                existingDays.Contains(GetWeekdayKey(date.DayOfWeek));
        }

        if (existing.Repeat == "once")
        {
            return existing.ExecutionDate is { } date &&
                candidateDays.Contains(GetWeekdayKey(date.DayOfWeek));
        }

        return candidateDays.Overlaps(existingDays);
    }

    private static string GetWeekdayKey(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday => "mon",
        DayOfWeek.Tuesday => "tue",
        DayOfWeek.Wednesday => "wed",
        DayOfWeek.Thursday => "thu",
        DayOfWeek.Friday => "fri",
        DayOfWeek.Saturday => "sat",
        _ => "sun"
    };

    private async Task ValidateAsync(
        NormalizedSchedule schedule,
        CancellationToken cancellationToken)
    {
        if (!await _db.Scenarios.AnyAsync(x => x.Id == schedule.ScenarioId, cancellationToken))
        {
            throw new ScheduleValidationException(
                "SCENARIO_NOT_FOUND",
                "Selected scenario was not found.");
        }
    }

    private static NormalizedSchedule Normalize(
        string time,
        Guid scenarioId,
        IReadOnlyList<string>? days,
        string repeat,
        bool enabled,
        DateOnly? executionDate)
    {
        if (!TimeSpan.TryParseExact(
                time,
                "hh\\:mm",
                CultureInfo.InvariantCulture,
                TimeSpanStyles.None,
                out var parsedTime) &&
            !TimeSpan.TryParseExact(
                time,
                "h\\:mm",
                CultureInfo.InvariantCulture,
                TimeSpanStyles.None,
                out parsedTime))
        {
            throw new ScheduleValidationException("INVALID_TIME", "Time must use HH:mm format.");
        }

        if (parsedTime < TimeSpan.Zero || parsedTime >= TimeSpan.FromDays(1))
        {
            throw new ScheduleValidationException("INVALID_TIME", "Time must be between 00:00 and 23:59.");
        }

        if (scenarioId == Guid.Empty)
        {
            throw new ScheduleValidationException("INVALID_SCENARIO", "A scenario is required.");
        }

        if (!ValidRepeats.Contains(repeat))
        {
            throw new ScheduleValidationException("INVALID_REPEAT", "Repeat must be daily, weekly, or once.");
        }

        var normalizedRepeat = repeat.ToLowerInvariant();
        var allDays = new List<string> { "mon", "tue", "wed", "thu", "fri", "sat", "sun" };
        var normalizedDays = normalizedRepeat == "weekly"
            ? (days ?? [])
                .Select(x => x.Trim().ToLowerInvariant())
                .Distinct()
                .ToList()
            : allDays;

        if (normalizedRepeat == "weekly" &&
            (normalizedDays.Count == 0 || normalizedDays.Any(x => !ValidDays.Contains(x))))
        {
            throw new ScheduleValidationException(
                "INVALID_DAYS",
                "At least one valid weekday is required for a weekly schedule.");
        }

        if (normalizedRepeat == "once" && executionDate is null)
        {
            throw new ScheduleValidationException("EXECUTION_DATE_REQUIRED", "A date is required for a one-time schedule.");
        }

        if (normalizedRepeat != "once" && executionDate is not null)
        {
            throw new ScheduleValidationException("UNEXPECTED_EXECUTION_DATE", "Execution date is only valid for one-time schedules.");
        }

        if (normalizedRepeat == "once" && executionDate is { } scheduledDate)
        {
            var now = DateTime.Now;
            var today = DateOnly.FromDateTime(now);
            var currentTime = new TimeSpan(now.Hour, now.Minute, 0);
            if (scheduledDate < today ||
                (scheduledDate == today && parsedTime <= currentTime))
            {
                throw new ScheduleValidationException(
                    "EXECUTION_DATE_IN_PAST",
                    "A one-time schedule must be set to a future date and time.");
            }
        }

        normalizedDays.Sort((left, right) =>
            Array.IndexOf(["mon", "tue", "wed", "thu", "fri", "sat", "sun"], left)
                .CompareTo(Array.IndexOf(["mon", "tue", "wed", "thu", "fri", "sat", "sun"], right)));

        return new NormalizedSchedule(parsedTime, scenarioId, normalizedDays, normalizedRepeat, enabled, executionDate);
    }

    private static ScheduleDto ToDto(Schedule schedule)
    {
        return new ScheduleDto(
            schedule.Id,
            schedule.Time.ToString(@"hh\:mm"),
            schedule.ScenarioId,
            schedule.Scenario.Name,
            schedule.Days
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            schedule.Repeat,
            schedule.Enabled,
            schedule.Enabled ? "active" : "inactive",
            schedule.ExecutionDate,
            schedule.LastTriggeredAt,
            schedule.LastExecutionStatus,
            schedule.CreatedAt,
            schedule.UpdatedAt);
    }

    private sealed record NormalizedSchedule(
        TimeSpan Time,
        Guid ScenarioId,
        List<string> Days,
        string Repeat,
        bool Enabled,
        DateOnly? ExecutionDate);
}

public sealed class ScheduleValidationException : Exception
{
    public ScheduleValidationException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}
