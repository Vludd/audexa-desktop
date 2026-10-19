using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/audio-devices")]
public class AudioDevicesController : ControllerBase
{
    private readonly IAudioDeviceService _audioDeviceService;

    public AudioDevicesController(IAudioDeviceService audioDeviceService)
    {
        _audioDeviceService = audioDeviceService;
    }

    [HttpGet]
    public ActionResult<AudioDevicesResponse> Get()
    {
        return Ok(_audioDeviceService.GetDevices());
    }
}
