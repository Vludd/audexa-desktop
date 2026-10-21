using audexa_backend.Data;
using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace audexa_backend.Services;

public sealed class ScenarioSchedulerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IPlaybackEngine _playback;
    private readonly ILogger<ScenarioSchedulerService> _logger;

    public ScenarioSchedulerService(
        IServiceScopeFactory scopeFactory,
        IPlaybackEngine playback,
        ILogger<ScenarioSchedulerService> logger)
    {
        _scopeFactory = scopeFactory;
        _playback = playback;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    new EventId(7101, "schedule.tick_failed"),
                    ex,
                    "Scheduler tick failed. ErrorType={ErrorType}",
                    ex.GetType().Name);
            }
        }
    }

    private async Task TickAsync(CancellationToken cancellationToken)
    {
        // Audexa is a local desktop application; schedules use the machine's local time.
        var now = DateTime.Now;
        var occurrence = new DateTime(now.Year, now.Month, now.Day, now.Hour, now.Minute, 0);
        var today = DateOnly.FromDateTime(now);
        var weekday = GetWeekdayKey(now.DayOfWeek);
        var time = new TimeSpan(now.Hour, now.Minute, 0);

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var enabledOnceSchedules = await db.Schedules
            .Where(x => x.Enabled && x.Repeat == "once")
            .ToListAsync(cancellationToken);

        foreach (var oneTime in enabledOnceSchedules)
        {
            var isInvalid = oneTime.ExecutionDate is null;
            var isMissed = oneTime.ExecutionDate is { } executionDate &&
                (executionDate < today ||
                 (executionDate == today && oneTime.Time < time));

            if (!isInvalid && !isMissed)
            {
                continue;
            }

            oneTime.Enabled = false;
            oneTime.LastExecutionStatus = isInvalid ? "invalid" : "missed";
            oneTime.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);

            if (isInvalid)
            {
                _logger.LogWarning(
                    new EventId(7105, "schedule.one_time_missing_date"),
                    "One-time schedule disabled because it has no execution date. ScheduleId={ScheduleId}",
                    oneTime.Id);
            }
            else
            {
                _logger.LogWarning(
                    new EventId(7106, "schedule.one_time_missed"),
                    "One-time schedule disabled because its scheduled time was missed while the backend was unavailable. ScheduleId={ScheduleId}; ExecutionDate={ExecutionDate}; Time={Time}",
                    oneTime.Id,
                    oneTime.ExecutionDate,
                    oneTime.Time);
            }
        }

        var schedules = await db.Schedules
            .Include(x => x.Scenario)
            .Where(x => x.Enabled && x.Time == time)
            .OrderBy(x => x.Id)
            .ToListAsync(cancellationToken);

        foreach (var schedule in schedules)
        {
            if (!IsDue(schedule, today, weekday, occurrence))
            {
                continue;
            }

            if (!string.Equals(schedule.Scenario.Status, "active", StringComparison.OrdinalIgnoreCase))
            {
                schedule.LastTriggeredAt = occurrence;
                schedule.LastExecutionStatus = "failed";
                if (string.Equals(schedule.Repeat, "once", StringComparison.OrdinalIgnoreCase))
                {
                    schedule.Enabled = false;
                }

                schedule.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                _logger.LogError(
                    new EventId(7107, "schedule.scenario_inactive"),
                    "Scheduled scenario is inactive; execution was not started. ScheduleId={ScheduleId}; ScenarioId={ScenarioId}",
                    schedule.Id,
                    schedule.ScenarioId);
                continue;
            }

            // Persist the occurrence before invoking playback. This deliberately
            // provides at-most-once triggering across backend restarts.
            schedule.LastTriggeredAt = occurrence;
            schedule.LastExecutionStatus = "pending";
            if (string.Equals(schedule.Repeat, "once", StringComparison.OrdinalIgnoreCase))
            {
                schedule.Enabled = false;
            }

            schedule.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);

            try
            {
                if (schedule.Scenario.StopPrevious && HasActivePlayback())
                {
                    schedule.LastExecutionStatus = "skipped_conflict";
                    schedule.UpdatedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync(cancellationToken);
                    _logger.LogWarning(
                        new EventId(7104, "schedule.execution_conflict"),
                        "Schedule execution skipped because StopPrevious would interrupt active playback. ScheduleId={ScheduleId}; ScenarioId={ScenarioId}",
                        schedule.Id,
                        schedule.ScenarioId);
                    continue;
                }

                await _playback.StartScenarioAsync(schedule.ScenarioId, cancellationToken);
                schedule.LastExecutionStatus = "started";
                schedule.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                _logger.LogInformation(
                    new EventId(7102, "schedule.execution_started"),
                    "Schedule execution started. ScheduleId={ScheduleId}; ScenarioId={ScenarioId}; Occurrence={Occurrence}",
                    schedule.Id,
                    schedule.ScenarioId,
                    occurrence);
            }
            catch (PlaybackException ex)
            {
                schedule.LastExecutionStatus = "failed";
                schedule.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                _logger.LogError(
                    new EventId(7103, "schedule.execution_failed"),
                    ex,
                    "Schedule execution failed. ScheduleId={ScheduleId}; ScenarioId={ScenarioId}; ErrorCode={ErrorCode}; Message={Message}",
                    schedule.Id,
                    schedule.ScenarioId,
                    ex.Code,
                    ex.Message);
            }
            catch (Exception ex)
            {
                schedule.LastExecutionStatus = "failed";
                schedule.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                _logger.LogError(
                    new EventId(7108, "schedule.execution_unexpected_failure"),
                    ex,
                    "Scheduled execution failed unexpectedly. ScheduleId={ScheduleId}; ScenarioId={ScenarioId}; ErrorType={ErrorType}",
                    schedule.Id,
                    schedule.ScenarioId,
                    ex.GetType().Name);
            }
        }
    }

    private bool HasActivePlayback()
    {
        return _playback.GetSessions().Any(session =>
            session.State.Status is "starting" or "playing" or "paused" or "waiting");
    }

    private static bool IsDue(
        Schedule schedule,
        DateOnly today,
        string weekday,
        DateTime occurrence)
    {
        if (schedule.LastTriggeredAt == occurrence)
        {
            return false;
        }

        if (string.Equals(schedule.Repeat, "once", StringComparison.OrdinalIgnoreCase))
        {
            return schedule.ExecutionDate == today && schedule.LastTriggeredAt is null;
        }

        if (string.Equals(schedule.Repeat, "daily", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var days = schedule.Days.Split(
            ',',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return days.Contains(weekday, StringComparer.OrdinalIgnoreCase);
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
}
