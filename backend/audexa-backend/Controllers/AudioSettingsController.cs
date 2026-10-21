using audexa_backend.DTOs.Settings;
using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/settings/audio")]
public sealed class AudioSettingsController : ControllerBase
{
    private readonly IAudioSettingsService _service;

    public AudioSettingsController(IAudioSettingsService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<AudioSettingsDto>> Get(CancellationToken cancellationToken)
    {
        return Ok(await _service.GetAsync(cancellationToken));
    }

    [HttpPut]
    public async Task<ActionResult<AudioSettingsDto>> Put(
        UpdateAudioSettingsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _service.SaveAsync(request, cancellationToken));
        }
        catch (AudioSettingsValidationException ex)
        {
            return BadRequest(new
            {
                code = ex.Code,
                message = ex.Message
            });
        }
    }
}
