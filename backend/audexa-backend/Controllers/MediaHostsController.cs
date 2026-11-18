using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/media-hosts")]
public sealed class MediaHostsController(MediaHostRegistry registry) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) => Ok(await registry.GetAllAsync(ct));
}
