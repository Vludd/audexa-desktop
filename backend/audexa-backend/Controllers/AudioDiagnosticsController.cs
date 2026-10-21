using audexa_backend.DTOs.Diagnostics;
using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/audio-diagnostics")]
public sealed class AudioDiagnosticsController : ControllerBase
{
    private readonly IAudioDiagnosticsService _service;

    public AudioDiagnosticsController(IAudioDiagnosticsService service)
    {
        _service = service;
    }

    [HttpPost("test-output")]
    public async Task<ActionResult<AudioTestResponse>> TestOutput(
        AudioTestRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _service.TestOutputAsync(request, cancellationToken));
        }
        catch (AudioDiagnosticException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("test-outputs")]
    public async Task<ActionResult<IReadOnlyList<AudioTestResponse>>> TestOutputs(
        AudioTestOutputsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _service.TestOutputsAsync(request, cancellationToken));
        }
        catch (AudioDiagnosticException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }
}
