using audexa_backend.Data;
using audexa_backend.DTOs.Playback;
using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using System.Globalization;
using System.Runtime.InteropServices;

namespace audexa_backend.Services;

public sealed class PlaybackEngine : IPlaybackEngine, IDisposable
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IAudioDeviceService _devices;
    private readonly ILogger<PlaybackEngine> _logger;
    private readonly object _sync = new();

    private readonly Dictionary<Guid, PlaybackSession> _sessions = [];
    private readonly Dictionary<Guid, Guid> _roomOwners = [];
    private TaskCompletionSource<bool> _roomChanged = NewRoomSignal();
    private readonly AsyncLocal<PlaybackSession?> _currentSession = new();
    private PlaybackStateDto _legacyState = new("idle", null, null, 0, null, 0, null, null, [], [], null);

    // Existing playback helpers operate on the session flowing through AsyncLocal.
    private PlaybackRuntime? _active
    {
        get => _currentSession.Value?.Active;
        set { if (_currentSession.Value is { } session) session.Active = value; }
    }
    private PlaybackStateDto _state
    {
        get => _currentSession.Value?.State ?? _legacyState;
        set { if (_currentSession.Value is { } session) session.State = value; else _legacyState = value; }
    }

    public PlaybackEngine(IServiceScopeFactory scopeFactory, IAudioDeviceService devices, ILogger<PlaybackEngine> logger)
    {
        _scopeFactory = scopeFactory;
        _devices = devices;
        _logger = logger;
    }

    public PlaybackStateDto GetState()
    {
        lock (_sync)
        {
            var preferred = _sessions.Values
                .OrderByDescending(x => IsActive(x.State.Status))
                .ThenByDescending(x => x.State.StartedAt)
                .FirstOrDefault();
            return preferred?.State ?? _legacyState;
        }
    }

    public IReadOnlyList<PlaybackSessionDto> GetSessions()
    {
        lock (_sync)
            return _sessions.Values
                .OrderByDescending(x => x.State.StartedAt)
                .Select(x => new PlaybackSessionDto(x.Id, x.State))
                .ToList();
    }

    public async Task<PlaybackStateDto> StartScenarioAsync(Guid scenarioId, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var scenario = await db.Scenarios.AsNoTracking()
            .Include(x => x.Steps).ThenInclude(x => x.Room)
            .Include(x => x.Steps).ThenInclude(x => x.AudioFile)
            .Include(x => x.Steps).ThenInclude(x => x.TranslationAudioFile)
            .FirstOrDefaultAsync(x => x.Id == scenarioId, cancellationToken);

        if (scenario is null)
            throw new PlaybackException("SCENARIO_NOT_FOUND", "Scenario was not found.");
        if (!string.Equals(scenario.Status, "active", StringComparison.OrdinalIgnoreCase))
            throw new PlaybackException("SCENARIO_INACTIVE", "Scenario is inactive. Activate it before starting playback.");
        if (scenario.Steps.Count == 0)
            throw new PlaybackException("SCENARIO_EMPTY", "Scenario has no steps.");

        var settings = await db.AudioConfigurations.AsNoTracking()
            .Include(x => x.Mappings)
            .SingleOrDefaultAsync(cancellationToken);

        if (settings?.DeviceId is null)
            throw new PlaybackException("DEVICE_NOT_CONFIGURED", "No audio device is configured.");

        var device = _devices.FindDevice(settings.DeviceId);
        if (device is null || !string.Equals(device.Status, "online", StringComparison.OrdinalIgnoreCase))
            throw new PlaybackException("DEVICE_UNAVAILABLE", "Configured audio device is unavailable.");

        var mappings = settings.Mappings
            .Where(x => !string.IsNullOrWhiteSpace(x.OutputId))
            .GroupBy(x => x.RoomId)
            .ToDictionary(x => x.Key, x => x.Select(y => y.OutputId).Distinct(StringComparer.Ordinal).ToList());
        var steps = scenario.Steps.OrderBy(x => x.Order).ToList();
        var translationOutputId = settings.TranslationOutputId;

        if (steps.Any(x => x.TranslationAudioFileId is not null))
        {
            if (string.IsNullOrWhiteSpace(translationOutputId))
                throw new PlaybackException("TRANSLATION_OUTPUT_NOT_CONFIGURED", "Для синхронного перевода не настроен отдельный аудиовыход.");

            if (mappings.Values.Any(ids => ids.Contains(translationOutputId, StringComparer.Ordinal)))
                throw new PlaybackException("TRANSLATION_OUTPUT_ASSIGNED_TO_ROOM", "Выход перевода не должен быть назначен комнате.");

            if (!_devices.HasOutput(settings.DeviceId, translationOutputId))
                throw new PlaybackException("TRANSLATION_OUTPUT_UNAVAILABLE", $"Выход перевода '{translationOutputId}' недоступен.");
        }

        foreach (var step in steps)
        {
            if (!mappings.TryGetValue(step.RoomId, out var outputIds) || outputIds.Count == 0)
                throw new PlaybackException("OUTPUT_NOT_MAPPED", $"Room '{step.Room.Name}' has no audio output mapping.");
            foreach (var outputId in outputIds)
            {
                if (!_devices.HasOutput(settings.DeviceId, outputId))
                    throw new PlaybackException("OUTPUT_UNAVAILABLE", $"Output '{outputId}' is not available.");
            }

            var path = GetAudioPath(step.AudioFile.StorageFileName);
            if (!File.Exists(path))
                throw new PlaybackException("AUDIO_FILE_MISSING", $"Audio file '{step.AudioFile.FileName}' is missing.");

            if (step.TranslationAudioFile is not null)
            {
                if (step.TranslationAudioFileId == step.AudioFileId)
                    throw new PlaybackException("INVALID_TRANSLATION_AUDIO", "Основная дорожка и перевод должны быть разными аудиофайлами.");

                var translationPath = GetAudioPath(step.TranslationAudioFile.StorageFileName);
                if (!File.Exists(translationPath))
                    throw new PlaybackException("TRANSLATION_FILE_MISSING", $"Translation audio file '{step.TranslationAudioFile.FileName}' is missing.");
            }
        }

        // StopPrevious retains its original meaning: when enabled, this scenario
        // replaces all active sessions. Otherwise it may run alongside them.
        if (scenario.StopPrevious && HasActiveSessions())
            await StopAsync(cancellationToken);

        var cts = new CancellationTokenSource();
        var sessionId = Guid.NewGuid();
        var stepStates = steps.Select((step, index) => new PlaybackStepStateDto(
            index + 1,
            step.RoomId,
            step.Room.Name,
            step.AudioFileId,
            step.AudioFile.FileName,
            index == 0 ? "pending" : "pending",
            step.DelayMs,
            0,
            0,
            Math.Max(0.001, Math.Max(
                step.AudioFile.Duration.TotalSeconds,
                step.TranslationAudioFile?.Duration.TotalSeconds ?? 0)),
            step.TranslationAudioFile is null
                ? string.Join(",", mappings[step.RoomId])
                : $"{string.Join(",", mappings[step.RoomId])}; translation={translationOutputId}",
            null)).ToList();

        var session = new PlaybackSession(sessionId, cts, new PlaybackStateDto(
            "starting",
            scenario.Id,
            scenario.Name,
            0,
            steps.Count > 0 ? 1 : null,
            steps.Count,
            DateTime.UtcNow,
            null,
            [],
            stepStates,
            null));

        lock (_sync)
        {
            PruneCompletedSessions();
            _sessions.Add(sessionId, session);
        }
        _logger.LogInformation(new EventId(7001, "scenario.started"), "Scenario started. ScenarioId={ScenarioId}; ScenarioName={ScenarioName}; SessionId={SessionId}; StepCount={StepCount}; DeviceId={DeviceId}", scenario.Id, scenario.Name, sessionId, steps.Count, settings.DeviceId);
        var previous = _currentSession.Value;
        _currentSession.Value = session;
        try
        {
            session.Task = Task.Run(() => RunScenarioAsync(scenario, settings.DeviceId, mappings, translationOutputId, cts.Token), CancellationToken.None);
        }
        finally { _currentSession.Value = previous; }

        return session.State;
    }

    public async Task StopAsync(CancellationToken cancellationToken = default)
    {
        PlaybackSession[] sessions;
        lock (_sync) sessions = _sessions.Values.Where(x => IsActive(x.State.Status)).ToArray();

        // Cancel every session before awaiting any worker. Otherwise releasing a
        // room while stopping session A could let waiting session B start briefly.
        foreach (var session in sessions)
        {
            _logger.LogInformation(new EventId(7002, "playback.stop_all_requested"), "Stop all requested. SessionId={SessionId}; ScenarioId={ScenarioId}; ScenarioName={ScenarioName}", session.Id, session.State.ScenarioId, session.State.ScenarioName);
            try { session.Cts.Cancel(); }
            catch (ObjectDisposedException) { }
            lock (_sync) session.Active?.Stop();
        }

        foreach (var session in sessions)
        {
            var previous = _currentSession.Value;
            _currentSession.Value = session;
            try
            {
                if (session.Task is not null)
                {
                    try { await session.Task; }
                    catch (OperationCanceledException) { }
                }
                NormalizeStoppedSteps();
            }
            finally { _currentSession.Value = previous; }
        }
    }

    public async Task StopSessionAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        PlaybackSession? session;
        lock (_sync) _sessions.TryGetValue(sessionId, out session);
        if (session is null) throw new PlaybackException("SESSION_NOT_FOUND", "Playback session was not found.");

        var previous = _currentSession.Value;
        _currentSession.Value = session;
        try
        {
            if (!IsActive(session.State.Status)) return;
            _logger.LogInformation(new EventId(7003, "scenario.stopped"), "Scenario stop requested. SessionId={SessionId}; ScenarioId={ScenarioId}; ScenarioName={ScenarioName}", session.Id, session.State.ScenarioId, session.State.ScenarioName);
            session.Cts.Cancel();
            lock (_sync) session.Active?.Stop();
            if (session.Task is not null)
            {
                try { await session.Task; }
                catch (OperationCanceledException) { }
            }
            NormalizeStoppedSteps();
        }
        finally { _currentSession.Value = previous; }
    }

    public Task PauseSessionAsync(Guid sessionId, CancellationToken cancellationToken = default) => ChangeSessionPauseAsync(sessionId, true);
    public Task ResumeSessionAsync(Guid sessionId, CancellationToken cancellationToken = default) => ChangeSessionPauseAsync(sessionId, false);

    private Task ChangeSessionPauseAsync(Guid sessionId, bool pause)
    {
        PlaybackSession? session;
        lock (_sync) _sessions.TryGetValue(sessionId, out session);
        if (session is null) throw new PlaybackException("SESSION_NOT_FOUND", "Playback session was not found.");
        lock (_sync)
        {
            if (pause)
            {
                if (session.State.Status == "playing" && session.Active is not null)
                {
                    session.Active.Pause();
                    session.State = session.State with { Status = "paused" };
                    return Task.CompletedTask;
                }

                // A session waiting for a room can be paused without acquiring
                // the room. It keeps waiting and resumes when explicitly asked.
                if (session.State.Status == "waiting" && session.Active is null)
                {
                    session.PauseRequested = true;
                    var steps = session.State.Steps.ToList();
                    var index = steps.FindIndex(x => x.Step == session.State.CurrentStep);
                    if (index >= 0) steps[index] = steps[index] with { Status = "paused" };
                    session.State = session.State with { Status = "paused", Steps = steps };
                }
                return Task.CompletedTask;
            }

            if (session.State.Status != "paused") return Task.CompletedTask;
            if (session.Active is not null)
            {
                session.Active.Resume();
                session.State = session.State with { Status = "playing" };
            }
            else
            {
                session.PauseRequested = false;
                var steps = session.State.Steps.ToList();
                var index = steps.FindIndex(x => x.Step == session.State.CurrentStep);
                if (index >= 0) steps[index] = steps[index] with { Status = "waiting" };
                session.State = session.State with { Status = "waiting", Steps = steps };
            }
        }
        return Task.CompletedTask;
    }

    public Task SkipStepAsync(Guid sessionId, int stepNumber, CancellationToken cancellationToken = default)
    {
        lock (_sync)
        {
            if (!_sessions.TryGetValue(sessionId, out var session) ||
                !IsActive(session.State.Status) ||
                stepNumber < 1 || stepNumber > session.State.TotalSteps ||
                session.State.CurrentStep != stepNumber)
            {
                throw new PlaybackException("NO_ACTIVE_STEP", "The selected scenario step is no longer active.");
            }

            var step = session.State.Steps.FirstOrDefault(x => x.Step == stepNumber);
            if (step is null || step.Status is not ("playing" or "paused" or "waiting" or "delaying"))
                throw new PlaybackException("NO_ACTIVE_STEP", "The selected scenario step is no longer active.");

            // Store the request on the session as well as the runtime. A step may
            // be waiting to reserve its room and therefore have no runtime yet.
            session.SkipRequestedStep = stepNumber;
            _logger.LogInformation(new EventId(7004, "scenario.step_skipped"), "Scenario step skip requested. SessionId={SessionId}; ScenarioId={ScenarioId}; StepNumber={StepNumber}", sessionId, session.State.ScenarioId, stepNumber);
            if (session.Active is { } active && active.RoomId == step.RoomId)
                active.RequestSkip();

            // Wake room waiters so a skipped step does not start later when its
            // room becomes free. The signal is shared, so all waiters re-check
            // their own session state before proceeding.
            var previous = _roomChanged;
            _roomChanged = NewRoomSignal();
            previous.TrySetResult(true);
        }
        return Task.CompletedTask;
    }

    public Task PauseAsync(CancellationToken cancellationToken = default)
    {
        var session = GetPreferredActiveSession();
        return session is null ? Task.CompletedTask : PauseSessionAsync(session.Id, cancellationToken);
    }

    public Task ResumeAsync(CancellationToken cancellationToken = default)
    {
        var session = GetPreferredActiveSession();
        return session is null ? Task.CompletedTask : ResumeSessionAsync(session.Id, cancellationToken);
    }

    private PlaybackSession? GetPreferredActiveSession()
    {
        lock (_sync)
            return _sessions.Values
                .Where(x => IsActive(x.State.Status))
                .OrderByDescending(x => x.State.StartedAt)
                .FirstOrDefault();
    }

    public async Task SetRoomVolumeAsync(Guid roomId, int volume, CancellationToken cancellationToken = default)
    {
        volume = Math.Clamp(volume, 0, 100);

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var room = await db.Rooms.FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);
        if (room is null) throw new PlaybackException("ROOM_NOT_FOUND", "Room was not found.");

        room.Volume = volume;
        await db.SaveChangesAsync(cancellationToken);

        lock (_sync)
        {
            foreach (var session in _sessions.Values)
                if (session.Active?.RoomId == roomId) session.Active.SetRoomVolume(volume);
        }
    }

    public async Task SetAudioGainAsync(Guid audioFileId, int gainDb, CancellationToken cancellationToken = default)
    {
        gainDb = Math.Clamp(gainDb, -24, 24);

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var audio = await db.AudioFiles.FirstOrDefaultAsync(x => x.Id == audioFileId, cancellationToken);
        if (audio is null) throw new PlaybackException("AUDIO_FILE_NOT_FOUND", "Audio file was not found.");

        audio.VolumeDb = gainDb;
        await db.SaveChangesAsync(cancellationToken);

        lock (_sync)
        {
            foreach (var session in _sessions.Values)
            {
                if (session.Active?.AudioFileId == audioFileId)
                    session.Active.SetAudioGainDb(gainDb);
                else if (session.Active?.TranslationAudioFileId == audioFileId)
                    session.Active.SetTranslationAudioGainDb(gainDb);
            }
        }
    }

    private bool HasActiveSessions()
    {
        lock (_sync) return _sessions.Values.Any(x => IsActive(x.State.Status));
    }

    private void PruneCompletedSessions()
    {
        var completed = _sessions.Values
            .Where(x => !IsActive(x.State.Status))
            .OrderByDescending(x => x.State.FinishedAt ?? x.State.StartedAt)
            .ToList();
        foreach (var stale in completed.Skip(25)) _sessions.Remove(stale.Id);
    }

    private static bool IsActive(string status) => status is "starting" or "playing" or "paused" or "waiting";

    private static TaskCompletionSource<bool> NewRoomSignal() =>
        new(TaskCreationOptions.RunContinuationsAsynchronously);

    private async Task<bool> ReserveRoomAsync(PlaybackSession session, Guid roomId, int stepNumber, CancellationToken token)
    {
        while (true)
        {
            token.ThrowIfCancellationRequested();
            bool isPaused;
            lock (_sync)
            {
                if (session.SkipRequestedStep == stepNumber)
                {
                    session.SkipRequestedStep = null;
                    return false;
                }
                isPaused = session.PauseRequested;
            }
            if (isPaused)
            {
                await Task.Delay(100, token);
                continue;
            }

            Task waitTask;
            lock (_sync)
            {
                if (session.SkipRequestedStep == stepNumber)
                {
                    session.SkipRequestedStep = null;
                    return false;
                }
                if (!_roomOwners.TryGetValue(roomId, out var owner) || owner == session.Id)
                {
                    _roomOwners[roomId] = session.Id;
                    return true;
                }
                waitTask = _roomChanged.Task;
            }

            SetStepState(stepNumber, "waiting", 0, 0);
            await waitTask.WaitAsync(token);
        }
    }

    private void ReleaseRoom(Guid roomId, Guid sessionId)
    {
        lock (_sync)
        {
            if (_roomOwners.TryGetValue(roomId, out var owner) && owner == sessionId)
            {
                _roomOwners.Remove(roomId);
                var previous = _roomChanged;
                _roomChanged = NewRoomSignal();
                previous.TrySetResult(true);
            }
        }
    }

    private void ReleaseSessionRooms(Guid sessionId)
    {
        lock (_sync)
        {
            var rooms = _roomOwners.Where(x => x.Value == sessionId).Select(x => x.Key).ToList();
            if (rooms.Count == 0) return;
            foreach (var room in rooms) _roomOwners.Remove(room);
            var previous = _roomChanged;
            _roomChanged = NewRoomSignal();
            previous.TrySetResult(true);
        }
    }

    private sealed class PlaybackSession(Guid id, CancellationTokenSource cts, PlaybackStateDto state)
    {
        public Guid Id { get; } = id;
        public CancellationTokenSource Cts { get; set; } = cts;
        public Task? Task { get; set; }
        public PlaybackRuntime? Active { get; set; }
        public bool PauseRequested { get; set; }
        public int? SkipRequestedStep { get; set; }
        public PlaybackStateDto State { get; set; } = state;
    }

    private async Task RunScenarioAsync(
        Scenario scenario,
        string deviceId,
        Dictionary<Guid, List<string>> mappings,
        string? translationOutputId,
        CancellationToken cancellationToken)
    {
        var session = _currentSession.Value ?? throw new InvalidOperationException("Playback session context is missing.");
        var previousSession = _currentSession.Value;
        _currentSession.Value = session;
        try
        {
            var steps = scenario.Steps.OrderBy(x => x.Order).ToList();

            do
            {
                for (var i = 0; i < steps.Count; i++)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var step = steps[i];
                    var stepNumber = i + 1;

                    // Reserve the room before applying this step's delay. A step
                    // waiting on another session starts from the beginning once released.
                    var roomReserved = await ReserveRoomAsync(session, step.RoomId, stepNumber, cancellationToken);
                    if (!roomReserved)
                    {
                        SetStepState(stepNumber, "stopped", 0, 0);
                        continue;
                    }

                    var runtime = new PlaybackRuntime(
                        deviceId,
                        step.RoomId,
                        step.AudioFileId,
                        step.Room.Volume,
                        step.AudioFile.VolumeDb,
                        step.TranslationAudioFileId,
                        step.TranslationAudioFile?.VolumeDb ?? 0);

                    lock (_sync) _active = runtime;

                    // Delay belongs to the step itself: it is the time to wait
                    // BEFORE this step starts. This also makes the first step
                    // support an intentional startup delay.
                    if (step.DelayMs > 0)
                    {
                        var remaining = step.DelayMs / 1000d;
                        SetStepState(stepNumber, "delaying", 0, remaining);

                        var delayStart = DateTime.UtcNow;
                        while (remaining > 0)
                        {
                            cancellationToken.ThrowIfCancellationRequested();

                            lock (_sync)
                            {
                                if (runtime.SkipRequested) break;
                            }

                            await Task.Delay(100, cancellationToken);
                            remaining = Math.Max(0, step.DelayMs / 1000d - (DateTime.UtcNow - delayStart).TotalSeconds);
                            SetStepState(stepNumber, "delaying", 0, remaining);
                        }

                        if (runtime.SkipRequested)
                        {
                            lock (_sync)
                            {
                                if (_active == runtime) _active = null;
                                if (session.SkipRequestedStep == stepNumber) session.SkipRequestedStep = null;
                            }
                            SetStepState(stepNumber, "stopped", 0, 0);
                            ReleaseRoom(step.RoomId, session.Id);
                            continue;
                        }
                    }

                    SetStepState(stepNumber, "playing", 0, 0);

                    await PlayFileAsync(
                        deviceId,
                        mappings[step.RoomId],
                        step.AudioFile,
                        step.TranslationAudioFile,
                        translationOutputId,
                        scenario,
                        step,
                        stepNumber,
                        steps.Count,
                        runtime,
                        cancellationToken);

                    if (runtime.SkipRequested)
                    {
                        lock (_sync)
                        {
                            if (_active == runtime) _active = null;
                            if (session.SkipRequestedStep == stepNumber) session.SkipRequestedStep = null;
                        }
                        SetStepState(stepNumber, "stopped", 0, 0);
                        ReleaseRoom(step.RoomId, session.Id);
                        continue;
                    }

                    SetStepState(stepNumber, "finished", Math.Max(
                        step.AudioFile.Duration.TotalSeconds,
                        step.TranslationAudioFile?.Duration.TotalSeconds ?? 0), 0);

                    lock (_sync)
                    {
                        if (_active == runtime) _active = null;
                        if (session.SkipRequestedStep == stepNumber) session.SkipRequestedStep = null;
                    }
                    ReleaseRoom(step.RoomId, session.Id);
                }
            } while (string.Equals(scenario.Repeat, "loop", StringComparison.OrdinalIgnoreCase));

            SetStateTerminal("idle", scenario);
            _logger.LogInformation(new EventId(7005, "scenario.completed"), "Scenario completed. ScenarioId={ScenarioId}; ScenarioName={ScenarioName}; SessionId={SessionId}", scenario.Id, scenario.Name, session.Id);
        }
        catch (OperationCanceledException)
        {
            SetStateTerminal("stopped", scenario);
            _logger.LogInformation(new EventId(7006, "scenario.cancelled"), "Scenario cancelled or stopped. ScenarioId={ScenarioId}; ScenarioName={ScenarioName}; SessionId={SessionId}", scenario.Id, scenario.Name, session.Id);
        }
        catch (Exception ex)
        {
            SetStateTerminal("error", scenario, GetFriendlyPlaybackError(ex));
            var code = ex is PlaybackException playbackException ? playbackException.Code : "UNEXPECTED_PLAYBACK_ERROR";
            _logger.LogError(new EventId(7007, "playback.error"), ex, "Scenario playback failed. ErrorCode={ErrorCode}; ScenarioId={ScenarioId}; ScenarioName={ScenarioName}; SessionId={SessionId}; Message={Message}", code, scenario.Id, scenario.Name, session.Id, ex.Message);
        }
        finally
        {
            ReleaseSessionRooms(session.Id);
            lock (_sync)
            {
                _active?.Stop();
                _active = null;
            }
            session.Cts.Dispose();
            session.Task = null;
            _currentSession.Value = previousSession;
        }
    }

    private async Task PlayFileAsync(
        string deviceId,
        IReadOnlyList<string> outputIds,
        AudioFile audio,
        AudioFile? translationAudio,
        string? translationOutputId,
        Scenario scenario,
        ScenarioStep step,
        int stepNumber,
        int totalSteps,
        PlaybackRuntime runtime,
        CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows())
            throw new PlaybackException("UNSUPPORTED_PLATFORM", "Audio playback is supported on Windows only.");

        var mainPath = GetAudioPath(audio.StorageFileName);
        using var source = OpenSource(mainPath);
        WaveStream? translationSource = null;

        try
        {
            if (translationAudio is not null)
            {
                if (string.IsNullOrWhiteSpace(translationOutputId))
                    throw new PlaybackException("TRANSLATION_OUTPUT_NOT_CONFIGURED", "Translation output is not configured.");

                translationSource = OpenSource(GetAudioPath(translationAudio.StorageFileName));
            }

            var mainChannels = outputIds.Select(ParseOutputIndex).Distinct().ToArray();
            if (mainChannels.Length == 0)
                throw new PlaybackException("OUTPUT_NOT_MAPPED", "No audio output is assigned to this room.");

            var translationChannels = translationAudio is null
                ? Array.Empty<int>()
                : [ParseOutputIndex(translationOutputId!)];

            if (translationChannels.Intersect(mainChannels).Any())
                throw new PlaybackException("OUTPUT_CHANNEL_COLLISION", "Translation output overlaps a room output.");

            var channels = mainChannels.Concat(translationChannels).Distinct().ToArray();
            using var output = CreateOutput(deviceId, channels, out var targetFormat);
            using var provider = new RoutedWaveProvider(
                source,
                targetFormat,
                mainChannels,
                runtime,
                translationSource,
                translationChannels);

            runtime.Attach(output, provider);
            output.PlaybackStopped += (_, args) =>
            {
                if (args.Exception is not null)
                    runtime.MarkOutputError(args.Exception);
            };

            var started = DateTime.UtcNow;
            var lastDeviceCheck = DateTime.MinValue;
            var duration = Math.Max(0.001, Math.Max(
                audio.Duration.TotalSeconds,
                translationAudio?.Duration.TotalSeconds ?? 0));

            try
            {
                output.Init(provider);
                output.Play();

                while (output.PlaybackState != PlaybackState.Stopped)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    if (runtime.OutputError is { } outputError)
                        throw CreateOutputFailure(outputError);

                    var now = DateTime.UtcNow;
                    if (now - lastDeviceCheck >= TimeSpan.FromMilliseconds(300))
                    {
                        lastDeviceCheck = now;
                        if (!_devices.IsDeviceAvailable(deviceId))
                            throw new PlaybackException(
                                "DEVICE_UNAVAILABLE",
                                "Аудиоустройство отключено или недоступно. Подключите устройство и запустите сценарий повторно.");
                    }

                    if (runtime.SkipRequested)
                    {
                        output.Stop();
                        break;
                    }

                    if (runtime.PauseRequested && output.PlaybackState == PlaybackState.Playing)
                    {
                        output.Pause();
                        SetStepState(stepNumber, "paused", runtime.PausedPosition, 0);
                        while (runtime.PauseRequested && !runtime.SkipRequested)
                        {
                            cancellationToken.ThrowIfCancellationRequested();

                            if (runtime.OutputError is { } pausedOutputError)
                                throw CreateOutputFailure(pausedOutputError);

                            var pausedNow = DateTime.UtcNow;
                            if (pausedNow - lastDeviceCheck >= TimeSpan.FromMilliseconds(300))
                            {
                                lastDeviceCheck = pausedNow;
                                if (!_devices.IsDeviceAvailable(deviceId))
                                    throw new PlaybackException(
                                        "DEVICE_UNAVAILABLE",
                                        "Аудиоустройство отключено или недоступно. Подключите устройство и запустите сценарий повторно.");
                            }

                            await Task.Delay(100, cancellationToken);
                        }

                        if (runtime.SkipRequested)
                        {
                            output.Stop();
                            break;
                        }

                        output.Play();
                        started = DateTime.UtcNow - TimeSpan.FromSeconds(runtime.PausedPosition);
                    }

                    var position = Math.Min(duration, (DateTime.UtcNow - started).TotalSeconds);
                    if (output.PlaybackState == PlaybackState.Playing)
                    {
                        runtime.PausedPosition = position;
                        SetStepState(stepNumber, "playing", position, 0);
                    }

                    if (runtime.EndOfStream)
                    {
                        output.Stop();
                        break;
                    }

                    await Task.Delay(100, cancellationToken);
                    if (output.PlaybackState == PlaybackState.Stopped)
                        break;
                }

                if (!cancellationToken.IsCancellationRequested)
                {
                    if (runtime.OutputError is { } stoppedOutputError)
                        throw CreateOutputFailure(stoppedOutputError);

                    if (!_devices.IsDeviceAvailable(deviceId))
                        throw new PlaybackException(
                            "DEVICE_UNAVAILABLE",
                            "Аудиоустройство отключено или недоступно. Подключите устройство и запустите сценарий повторно.");
                }

                if (!runtime.EndOfStream && !runtime.SkipRequested && !cancellationToken.IsCancellationRequested)
                {
                    throw new PlaybackException(
                        "AUDIO_OUTPUT_STOPPED",
                        "Аудиовыход остановился до завершения файла. Проверьте аудиоустройство и сопоставление выхода.");
                }
            }
            finally
            {
                try { output.Stop(); }
                catch (Exception ex) { runtime.MarkOutputError(ex); }
                runtime.Detach();
            }
        }
        finally
        {
            translationSource?.Dispose();
        }
    }

    private void SetStepState(int stepNumber, string status, double position, double delayRemaining)
    {
        lock (_sync)
        {
            // A terminal playback snapshot must never be moved back to an
            // active step state by a delayed update.
            if (_state.Status is "idle" or "stopped" or "error") return;
            if (_state.Steps.Count == 0) return;
            var steps = _state.Steps.ToList();
            var index = Math.Clamp(stepNumber - 1, 0, steps.Count - 1);
            var current = steps[index];
            steps[index] = current with
            {
                Status = status,
                PositionSeconds = position,
                DelayRemainingSeconds = delayRemaining
            };

            var next = status is "playing" or "waiting" or "delaying"
                ? (stepNumber < steps.Count ? stepNumber + 1 : null)
                : FindNextPending(steps, stepNumber);

            _state = _state with
            {
                Status = status switch
                {
                    "waiting" or "delaying" => "waiting",
                    "playing" => "playing",
                    "paused" => "paused",
                    _ => _state.Status
                },
                CurrentStep = stepNumber,
                NextStep = next,
                Rooms = BuildRoomStates(steps),
                Steps = steps
            };
        }
    }

    private void NormalizeStoppedSteps()
    {
        lock (_sync)
        {
            // Only normalize a stopped run. Another run may have started while
            // this StopAsync caller was awaiting the previous worker.
            if (_state.Status != "stopped") return;

            var steps = _state.Steps
                .Select(step => step with
                {
                    Status = step.Status is "playing" or "paused" or "waiting" or "delaying"
                        ? "stopped"
                        : step.Status,
                    DelayRemainingSeconds = 0
                })
                .ToList();

            _state = _state with
            {
                NextStep = null,
                Rooms = [],
                Steps = steps
            };
        }
    }

    private static int? FindNextPending(List<PlaybackStepStateDto> steps, int current)
    {
        return steps
            .Select((step, index) => new { step, index })
            .Where(x => x.index + 1 > current && x.step.Status == "pending")
            .Select(x => (int?)(x.index + 1))
            .FirstOrDefault();
    }

    private IReadOnlyList<PlaybackRoomStateDto> BuildRoomStates(List<PlaybackStepStateDto> steps)
    {
        lock (_sync)
        {
            var active = _active;
            if (active is null) return [];

            var current = steps.FirstOrDefault(x => x.Step == _state.CurrentStep);
            if (current is null) return [];

            return [new PlaybackRoomStateDto(
                current.RoomId,
                ToRoomStatus(current.Status),
                _state.ScenarioId,
                _state.ScenarioName,
                current.AudioFileId,
                current.AudioFileName,
                current.OutputId,
                current.Step,
                steps.Count,
                current.PositionSeconds,
                current.DurationSeconds,
                active.RoomVolume,
                active.AudioGainDb,
                current.Error)];
        }
    }

    private static string ToRoomStatus(string stepStatus)
    {
        return stepStatus switch
        {
            "playing" => "playing",
            "waiting" or "delaying" => "waiting",
            "paused" => "paused",
            "stopped" or "finished" => "stopped",
            "pending" => "idle",
            "error" => "error",
            _ => throw new InvalidOperationException($"Unknown playback step status: '{stepStatus}'.")
        };
    }

    private void SetState(string status, Scenario scenario, int step)
    {
        lock (_sync)
        {
            _state = _state with
            {
                Status = status,
                ScenarioId = scenario.Id,
                ScenarioName = scenario.Name,
                CurrentStep = step,
                NextStep = step < _state.TotalSteps ? step + 1 : null,
                Rooms = BuildRoomStates(_state.Steps.ToList())
            };
        }
    }

    private void SetStateTerminal(string status, Scenario scenario, string? error = null)
    {
        lock (_sync)
        {
            var steps = _state.Steps.ToList();
            for (var i = 0; i < steps.Count; i++)
            {
                var step = steps[i];

                if (status == "idle" && (step.Status is "pending" or "playing" or "waiting" or "delaying"))
                {
                    // Reaching the end of the run is a normal completion.
                    steps[i] = step with
                    {
                        Status = "finished",
                        DelayRemainingSeconds = 0
                    };
                }
                else if (status == "stopped" && (step.Status is "playing" or "paused" or "waiting" or "delaying"))
                {
                    // A stopped scenario must not leave an active/waiting step
                    // (or its countdown) in the terminal snapshot.
                    steps[i] = step with
                    {
                        Status = "stopped",
                        DelayRemainingSeconds = 0
                    };
                }
                else if (status == "error" && step.Step == _state.CurrentStep &&
                         (step.Status is "playing" or "paused" or "waiting" or "delaying"))
                {
                    steps[i] = step with
                    {
                        Status = "error",
                        DelayRemainingSeconds = 0,
                        Error = error
                    };
                }
            }

            _state = _state with
            {
                Status = status,
                ScenarioId = scenario.Id,
                ScenarioName = scenario.Name,
                FinishedAt = DateTime.UtcNow,
                CurrentStep = Math.Min(_state.CurrentStep, steps.Count),
                NextStep = null,
                Rooms = [],
                Steps = steps,
                Error = error
            };
        }
    }

    private static Exception CreateOutputFailure(Exception exception)
    {
        var message = GetFriendlyPlaybackError(exception);
        return new PlaybackException("AUDIO_OUTPUT_ERROR", message);
    }

    private static string GetFriendlyPlaybackError(Exception exception)
    {
        // AUDCLNT_E_DEVICE_INVALIDATED: the WASAPI endpoint was removed or
        // invalidated while the stream was active. Avoid leaking a raw HRESULT
        // to the operator; the stable code remains available in the log/API.
        const int deviceInvalidated = unchecked((int)0x88890004);
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current.HResult == deviceInvalidated ||
                current.Message.Contains("0x88890004", StringComparison.OrdinalIgnoreCase) ||
                current.Message.Contains("AUDCLNT_E_DEVICE_INVALIDATED", StringComparison.OrdinalIgnoreCase))
            {
                return "Аудиоустройство отключено во время воспроизведения. Подключите устройство и запустите сценарий повторно.";
            }
        }

        if (exception is PlaybackException playbackException)
            return playbackException.Message;

        if (exception is COMException || exception.InnerException is COMException)
            return "Ошибка аудиоустройства во время воспроизведения. Проверьте подключение устройства и сопоставление выхода.";

        return exception.Message;
    }

    private static string GetAudioPath(string storageFileName)
    {
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appDataPath, "Audexa", "Audio", storageFileName);
    }

    private static WaveStream OpenSource(string path)
    {
        var ext = Path.GetExtension(path).ToLowerInvariant();
        return ext switch
        {
            ".wav" => new WaveFileReader(path),
            ".mp3" => new Mp3FileReader(path),
            _ => throw new PlaybackException("UNSUPPORTED_AUDIO", $"Unsupported audio format '{ext}'.")
        };
    }

    private static IWavePlayer CreateOutput(string deviceId, IReadOnlyCollection<int> targetChannels, out WaveFormat targetFormat)
    {
        var maxChannel = targetChannels.Max();

        if (deviceId.StartsWith("asio:", StringComparison.Ordinal))
        {
            var driverName = deviceId[5..];
            using var probe = new AsioOut(driverName);
            var channels = Math.Max(probe.DriverOutputChannelCount, maxChannel + 1);
            targetFormat = WaveFormat.CreateIeeeFloatWaveFormat(48000, channels);
            return new AsioOut(driverName);
        }

        if (deviceId.StartsWith("wasapi:render:", StringComparison.Ordinal))
        {
            var endpointId = deviceId["wasapi:render:".Length..];
            using var enumerator = new MMDeviceEnumerator();
            var endpoint = enumerator.GetDevice(endpointId);
            var mixFormat = endpoint.AudioClient.MixFormat;
            targetFormat = new WaveFormat(mixFormat.SampleRate, 16, mixFormat.Channels);
            if (maxChannel >= mixFormat.Channels)
                throw new PlaybackException("OUTPUT_CHANNEL_OUT_OF_RANGE", $"Requested output channel {maxChannel + 1} is outside the endpoint's {mixFormat.Channels} channels.");
            return new WasapiOut(endpoint, AudioClientShareMode.Shared, true, 100);
        }

        if (deviceId.StartsWith("waveout:", StringComparison.Ordinal) &&
            int.TryParse(deviceId["waveout:".Length..], NumberStyles.Integer, CultureInfo.InvariantCulture, out var deviceNumber))
        {
            targetFormat = new WaveFormat(48000, 16, Math.Max(2, maxChannel + 1));
            return new WaveOutEvent { DeviceNumber = deviceNumber, DesiredLatency = 100 };
        }

        throw new PlaybackException("UNSUPPORTED_DEVICE", $"Unsupported device '{deviceId}'.");
    }

    private static int ParseOutputIndex(string outputId)
    {
        var marker = outputId.LastIndexOf(":out:", StringComparison.Ordinal);
        if (marker >= 0 && int.TryParse(outputId[(marker + 5)..], NumberStyles.Integer, CultureInfo.InvariantCulture, out var asioIndex))
            return asioIndex;

        var outputMarker = outputId.LastIndexOf(":output:", StringComparison.Ordinal);
        if (outputMarker >= 0 && int.TryParse(outputId[(outputMarker + 8)..], NumberStyles.Integer, CultureInfo.InvariantCulture, out var index))
            return index;

        throw new PlaybackException("INVALID_OUTPUT", $"Cannot determine output channel from '{outputId}'.");
    }

    private sealed class PlaybackRuntime
    {
        private readonly object _sync = new();
        private RoutedWaveProvider? _provider;
        private IWavePlayer? _output;
        private Exception? _outputError;
        private int _translationAudioGainDb;

        public PlaybackRuntime(
            string deviceId,
            Guid roomId,
            Guid audioFileId,
            int roomVolume,
            int audioGainDb,
            Guid? translationAudioFileId = null,
            int translationAudioGainDb = 0)
        {
            DeviceId = deviceId;
            RoomId = roomId;
            AudioFileId = audioFileId;
            TranslationAudioFileId = translationAudioFileId;
            RoomVolume = Math.Clamp(roomVolume, 0, 100);
            AudioGainDb = Math.Clamp(audioGainDb, -24, 24);
            _translationAudioGainDb = Math.Clamp(translationAudioGainDb, -24, 24);
        }

        public string DeviceId { get; }
        public Guid RoomId { get; }
        public Guid AudioFileId { get; }
        public Guid? TranslationAudioFileId { get; }
        public Exception? OutputError { get { lock (_sync) return _outputError; } }
        public int RoomVolume { get; private set; }
        public int AudioGainDb { get; private set; }
        public bool SkipRequested { get; private set; }
        public bool PauseRequested { get; private set; }
        public bool EndOfStream { get; private set; }
        public double PausedPosition { get; set; }

        public void Attach(IWavePlayer output, RoutedWaveProvider provider)
        {
            lock (_sync) { _output = output; _provider = provider; }
        }

        public void Detach()
        {
            lock (_sync) { _output = null; _provider = null; }
        }

        public void SetRoomVolume(int volume)
        {
            lock (_sync) RoomVolume = Math.Clamp(volume, 0, 100);
        }

        public void SetAudioGainDb(int gainDb)
        {
            lock (_sync) AudioGainDb = Math.Clamp(gainDb, -24, 24);
        }

        public void SetTranslationAudioGainDb(int gainDb)
        {
            lock (_sync) _translationAudioGainDb = Math.Clamp(gainDb, -24, 24);
        }

        public void RequestSkip()
        {
            lock (_sync)
            {
                SkipRequested = true;
                try { _output?.Stop(); }
                catch (Exception ex) { _outputError ??= ex; }
            }
        }

        public void Pause() { lock (_sync) PauseRequested = true; }
        public void Resume() { lock (_sync) PauseRequested = false; }
        public void MarkEndOfStream() { lock (_sync) EndOfStream = true; }
        public void MarkOutputError(Exception exception) { lock (_sync) _outputError ??= exception; }

        public void Stop()
        {
            lock (_sync)
            {
                SkipRequested = true;
                try { _output?.Stop(); }
                catch (Exception ex) { _outputError ??= ex; }
            }
        }

        public double GetMainGain()
        {
            lock (_sync)
                return Math.Clamp(RoomVolume / 100d, 0d, 1d) * Math.Pow(10d, AudioGainDb / 20d);
        }

        public double GetTranslationGain()
        {
            lock (_sync)
                return Math.Pow(10d, _translationAudioGainDb / 20d);
        }
    }

    private sealed class RoutedWaveProvider : IWaveProvider, IDisposable
    {
        private readonly WaveStream _mainSource;
        private readonly WaveStream? _translationSource;
        private readonly WaveFormat _target;
        private readonly int[] _mainChannels;
        private readonly int[] _translationChannels;
        private readonly PlaybackRuntime _runtime;
        private readonly MediaFoundationResampler? _mainResampler;
        private readonly MediaFoundationResampler? _translationResampler;
        private readonly IWaveProvider _mainInput;
        private readonly IWaveProvider? _translationInput;
        private bool _mainEnded;
        private bool _translationEnded;

        public RoutedWaveProvider(
            WaveStream mainSource,
            WaveFormat target,
            IReadOnlyCollection<int> mainChannels,
            PlaybackRuntime runtime,
            WaveStream? translationSource = null,
            IReadOnlyCollection<int>? translationChannels = null)
        {
            _mainSource = mainSource;
            _translationSource = translationSource;
            _target = target;
            _mainChannels = mainChannels.Distinct().Select(channel => Math.Clamp(channel, 0, Math.Max(0, target.Channels - 1))).ToArray();
            _translationChannels = (translationChannels ?? Array.Empty<int>())
                .Distinct().Select(channel => Math.Clamp(channel, 0, Math.Max(0, target.Channels - 1))).ToArray();
            _runtime = runtime;

            _mainInput = CreateMonoInput(mainSource, target.SampleRate, out var mainResampler);
            _mainResampler = mainResampler;
            if (translationSource is not null)
            {
                _translationInput = CreateMonoInput(translationSource, target.SampleRate, out var translationResampler);
                _translationResampler = translationResampler;
            }
        }

        private static IWaveProvider CreateMonoInput(
            WaveStream source,
            int sampleRate,
            out MediaFoundationResampler? resampler)
        {
            if (source.WaveFormat.SampleRate != sampleRate ||
                source.WaveFormat.Channels != 1 ||
                source.WaveFormat.BitsPerSample != 16)
            {
                resampler = new MediaFoundationResampler(source, new WaveFormat(sampleRate, 16, 1))
                {
                    ResamplerQuality = 60
                };
                return resampler;
            }

            resampler = null;
            return source;
        }

        public WaveFormat WaveFormat => _target;

        public int Read(byte[] buffer, int offset, int count)
        {
            var bytesPerFrame = _target.BlockAlign;
            var requestedFrames = count / bytesPerFrame;
            if (requestedFrames <= 0) return 0;

            var mainBuffer = new byte[requestedFrames * 2];
            var mainRead = _mainEnded ? 0 : _mainInput.Read(mainBuffer, 0, mainBuffer.Length);
            var mainFrames = mainRead / 2;
            if (mainFrames == 0) _mainEnded = true;

            var translationBuffer = new byte[requestedFrames * 2];
            var translationRead = 0;
            var translationFrames = 0;
            if (_translationInput is not null && !_translationEnded)
            {
                translationRead = _translationInput.Read(translationBuffer, 0, translationBuffer.Length);
                translationFrames = translationRead / 2;
                if (translationFrames == 0) _translationEnded = true;
            }
            else if (_translationInput is null)
            {
                _translationEnded = true;
            }

            var framesToWrite = Math.Max(mainFrames, translationFrames);
            if (framesToWrite == 0)
            {
                if (_mainEnded && _translationEnded)
                    _runtime.MarkEndOfStream();
                return 0;
            }

            var bytesToWrite = framesToWrite * bytesPerFrame;
            Array.Clear(buffer, offset, bytesToWrite);
            var mainGain = (float)_runtime.GetMainGain();
            var translationGain = (float)_runtime.GetTranslationGain();

            for (var frame = 0; frame < framesToWrite; frame++)
            {
                if (frame < mainFrames)
                {
                    var sample = BitConverter.ToInt16(mainBuffer, frame * 2) / 32768f * mainGain;
                    WriteSample(buffer, offset, frame, _mainChannels, sample);
                }

                if (frame < translationFrames)
                {
                    var sample = BitConverter.ToInt16(translationBuffer, frame * 2) / 32768f * translationGain;
                    WriteSample(buffer, offset, frame, _translationChannels, sample);
                }
            }

            return bytesToWrite;
        }

        private void WriteSample(byte[] buffer, int offset, int frame, IReadOnlyList<int> channels, float sample)
        {
            foreach (var channel in channels)
            {
                var sampleOffset = offset + frame * _target.BlockAlign + channel * (_target.BitsPerSample / 8);

                if (_target.Encoding == WaveFormatEncoding.IeeeFloat && _target.BitsPerSample == 32)
                    BitConverter.TryWriteBytes(buffer.AsSpan(sampleOffset, 4), sample);
                else if (_target.Encoding == WaveFormatEncoding.Pcm && _target.BitsPerSample == 16)
                    BitConverter.TryWriteBytes(buffer.AsSpan(sampleOffset, 2), (short)Math.Clamp(sample * short.MaxValue, short.MinValue, short.MaxValue));
                else if (_target.Encoding == WaveFormatEncoding.Pcm && _target.BitsPerSample == 32)
                    BitConverter.TryWriteBytes(buffer.AsSpan(sampleOffset, 4), (int)Math.Clamp(sample * int.MaxValue, int.MinValue, int.MaxValue));
                else
                    throw new PlaybackException("UNSUPPORTED_FORMAT", $"Unsupported target format {_target}");
            }
        }

        public void Dispose()
        {
            _mainResampler?.Dispose();
            _translationResampler?.Dispose();
        }
    }

    public void Dispose()
    {
        lock (_sync)
        {
            foreach (var session in _sessions.Values)
            {
                try { session.Cts.Cancel(); }
                catch (ObjectDisposedException) { }
            }
        }
    }
}

public sealed class PlaybackException : Exception
{
    public PlaybackException(string code, string message) : base(message) => Code = code;
    public string Code { get; }
}
