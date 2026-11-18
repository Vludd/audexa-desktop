using audexa_backend.DTOs;
using audexa_backend.Hubs;
using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/media-hosts")]
public sealed class MediaHostsController(
    MediaHostRegistry registry,
    IHubContext<MediaHostHub> agentHub) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Ok(await registry.GetAllAsync(ct));

    [HttpPost("{hostId:guid}/playback")]
    public async Task<IActionResult> SendPlaybackCommand(
        Guid hostId,
        [FromBody] MediaPlaybackCommandDto request,
        CancellationToken ct)
    {
        var action = request.Action?.Trim().ToLowerInvariant();
        var allowedActions = new[] { "play", "pause", "resume", "stop", "close" };

        if (string.IsNullOrWhiteSpace(action) || !allowedActions.Contains(action))
            return BadRequest(new { message = "Unsupported playback action." });

        if (string.IsNullOrWhiteSpace(request.DisplayKey))
            return BadRequest(new { message = "DisplayKey is required." });

        if (action == "play" && string.IsNullOrWhiteSpace(request.FilePath))
            return BadRequest(new { message = "FilePath is required for Play." });

        var host = await registry.GetByIdAsync(hostId, ct);
        if (host is null)
            return NotFound(new { message = "Media Host was not found." });

        if (!string.Equals(host.Status, "Online", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Media Host is offline." });

        var commandId = Guid.NewGuid().ToString("N");
        await agentHub.Clients
            .Group($"media-host:{hostId:D}")
            .SendAsync("PlaybackCommand", new
            {
                CommandId = commandId,
                Action = action,
                request.DisplayKey,
                request.FilePath
            }, ct);

        return Accepted(new { commandId, status = "Dispatched" });
    }
}
