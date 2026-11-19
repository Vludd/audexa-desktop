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
    PlaybackCommandRegistry commands,
    IHubContext<MediaHostHub> agentHub,
    IHubContext<MediaHostsUiHub> uiHub) : ControllerBase
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

        var command = commands.Create(hostId, request.DisplayKey.Trim(), action);
        await uiHub.Clients.All.SendAsync("PlaybackCommandUpdated", command, ct);

        try
        {
            await agentHub.Clients
                .Group($"media-host:{hostId:D}")
                .SendAsync("PlaybackCommand", new
                {
                    CommandId = command.CommandId,
                    Action = action,
                    DisplayKey = command.DisplayKey,
                    request.FilePath
                }, ct);
        }
        catch
        {
            var failed = commands.Update(hostId,
                new PlaybackCommandResultDto(command.CommandId, "Failed", "Backend could not dispatch the command to the Media Agent."));
            if (failed is not null)
                await uiHub.Clients.All.SendAsync("PlaybackCommandUpdated", failed, CancellationToken.None);
            throw;
        }

        return Accepted(command);
    }

    [HttpGet("playback-commands/{commandId}")]
    public IActionResult GetPlaybackCommand(string commandId)
    {
        var command = commands.Get(commandId);
        return command is null ? NotFound() : Ok(command);
    }
}
