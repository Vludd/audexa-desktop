using audexa_backend.DTOs.Playback;
using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/playback")]
public sealed class PlaybackController : ControllerBase
{
    private readonly IPlaybackEngine _playback;
    private readonly ILogger<PlaybackController> _logger;

    public PlaybackController(IPlaybackEngine playback, ILogger<PlaybackController> logger)
    {
        _playback = playback;
        _logger = logger;
    }

    [HttpGet]
    public ActionResult<PlaybackStateDto> GetState() => Ok(_playback.GetState());

    [HttpGet("sessions")]
    public ActionResult<IReadOnlyList<PlaybackSessionDto>> GetSessions() => Ok(_playback.GetSessions());

    [HttpPost("sessions/{sessionId:guid}/pause")]
    public async Task<IActionResult> PauseSession(Guid sessionId, CancellationToken cancellationToken)
    {
        try { await _playback.PauseSessionAsync(sessionId, cancellationToken); return Ok(_playback.GetSessions()); }
        catch (PlaybackException ex)
        {
            _logger.LogWarning(new EventId(7201, "playback.session_pause_failed"), ex, "Could not pause session. SessionId={SessionId}; ErrorCode={ErrorCode}", sessionId, ex.Code);
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("sessions/{sessionId:guid}/resume")]
    public async Task<IActionResult> ResumeSession(Guid sessionId, CancellationToken cancellationToken)
    {
        try { await _playback.ResumeSessionAsync(sessionId, cancellationToken); return Ok(_playback.GetSessions()); }
        catch (PlaybackException ex) { return BadRequest(new { code = ex.Code, message = ex.Message }); }
    }

    [HttpPost("sessions/{sessionId:guid}/stop")]
    public async Task<IActionResult> StopSession(Guid sessionId, CancellationToken cancellationToken)
    {
        try { await _playback.StopSessionAsync(sessionId, cancellationToken); return Ok(_playback.GetSessions()); }
        catch (PlaybackException ex) { return BadRequest(new { code = ex.Code, message = ex.Message }); }
    }

    [HttpPost("scenarios/{id:guid}/start")]
    public async Task<ActionResult<PlaybackStateDto>> StartScenario(Guid id, CancellationToken cancellationToken)
    {
        try { return Ok(await _playback.StartScenarioAsync(id, cancellationToken)); }
        catch (PlaybackException ex)
        {
            _logger.LogWarning(new EventId(7202, "scenario.start_rejected"), ex, "Scenario start rejected. ScenarioId={ScenarioId}; ErrorCode={ErrorCode}; Message={Message}", id, ex.Code, ex.Message);
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("pause")]
    public async Task<ActionResult<PlaybackStateDto>> Pause(CancellationToken cancellationToken)
    {
        await _playback.PauseAsync(cancellationToken);
        return Ok(_playback.GetState());
    }

    [HttpPost("resume")]
    public async Task<ActionResult<PlaybackStateDto>> Resume(CancellationToken cancellationToken)
    {
        await _playback.ResumeAsync(cancellationToken);
        return Ok(_playback.GetState());
    }

    [HttpPost("stop")]
    public async Task<ActionResult<PlaybackStateDto>> Stop(CancellationToken cancellationToken)
    {
        await _playback.StopAsync(cancellationToken);
        return Ok(_playback.GetState());
    }

    [HttpPost("sessions/{sessionId:guid}/steps/{stepNumber:int}/skip")]
    public async Task<ActionResult<IReadOnlyList<PlaybackSessionDto>>> SkipStep(
        Guid sessionId,
        int stepNumber,
        CancellationToken cancellationToken)
    {
        try
        {
            await _playback.SkipStepAsync(sessionId, stepNumber, cancellationToken);
            return Ok(_playback.GetSessions());
        }
        catch (PlaybackException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPatch("rooms/{id:guid}/volume")]
    public async Task<ActionResult<PlaybackStateDto>> SetRoomVolume(Guid id, [FromBody] PlaybackVolumeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await _playback.SetRoomVolumeAsync(id, request.Value, cancellationToken);
            return Ok(_playback.GetState());
        }
        catch (PlaybackException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPatch("audio/{id:guid}/gain")]
    public async Task<ActionResult<PlaybackStateDto>> SetAudioGain(Guid id, [FromBody] PlaybackVolumeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await _playback.SetAudioGainAsync(id, request.Value, cancellationToken);
            return Ok(_playback.GetState());
        }
        catch (PlaybackException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }
}
