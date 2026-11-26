using audexa_backend.DTOs;
using audexa_backend.Hubs;
using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.RateLimiting;
using audexa_backend.Security;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/media-hosts")]
public sealed class MediaHostsController(
    MediaHostRegistry registry,
    PlaybackCommandRegistry commands,
    VideoFileService videoFiles,
    MediaHostPairingService pairingService,
    IHubContext<MediaHostHub> agentHub,
    IHubContext<MediaHostsUiHub> uiHub) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Ok(await registry.GetAllAsync(ct));

    [HttpGet("pairings")]
    public async Task<IActionResult> GetPairings(CancellationToken ct) =>
        Ok(await pairingService.GetAllAsync(ct));

    [HttpPost("pairings")]
    public async Task<IActionResult> CreatePairing(
        [FromBody] CreateMediaHostPairingDto request,
        CancellationToken ct)
    {
        // Pairing invitations are an administrative operation. At this stage,
        // only the local Audexa desktop UI may create them.
        if (!IsLocalRequest(HttpContext.Connection.RemoteIpAddress))
            return Forbid();

        try
        {
            Response.Headers["Cache-Control"] = "no-store";
            Response.Headers["Pragma"] = "no-cache";
            return Ok(await pairingService.CreateAsync(request, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("pairings/{id:guid}")]
    public async Task<IActionResult> RevokePairing(Guid id, CancellationToken ct)
    {
        if (!IsLocalRequest(HttpContext.Connection.RemoteIpAddress))
            return Forbid();

        try
        {
            await pairingService.RevokePairingAsync(id, ct);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    // Used by a saved Media Agent before opening SignalR. If its registration
    // was revoked or deleted while it was offline, it can safely return to first-run pairing.
    [HttpGet("{hostId:guid}/agent-credential")]
    [LanAccessible]
    public async Task<IActionResult> ValidateAgentCredential(Guid hostId, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        Response.Headers["Pragma"] = "no-cache";

        var suppliedSecret = Request.Headers["X-Audexa-Agent-Token"].ToString();
        var isValid = await pairingService.ValidateCredentialAsync(hostId, suppliedSecret, ct);
        return isValid ? NoContent() : Unauthorized();
    }

    [HttpPost("pair")]
    [LanAccessible]
    [EnableRateLimiting("media-host-pair")]
    public async Task<IActionResult> Pair(
        [FromBody] MediaHostPairRequest request,
        CancellationToken ct)
    {
        try
        {
            Response.Headers["Cache-Control"] = "no-store";
            Response.Headers["Pragma"] = "no-cache";
            var backendUrl = $"{Request.Scheme}://{Request.Host}";
            return Ok(await pairingService.PairAsync(request, backendUrl, ct));
        }
        catch (InvalidPairingCodeException)
        {
            return Unauthorized(new { message = "The pairing code is invalid, expired, revoked, or already used." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("unpaired")]
    public async Task<IActionResult> DeleteUnpairedHosts(CancellationToken ct)
    {
        if (!IsLocalRequest(HttpContext.Connection.RemoteIpAddress))
            return Forbid();

        var deletedIds = await pairingService.DeleteUnpairedHostsAsync(ct);
        return Ok(new
        {
            deletedCount = deletedIds.Count,
            deletedHostIds = deletedIds
        });
    }

    [HttpPut("{hostId:guid}")]
    public async Task<IActionResult> RenameHost(
        Guid hostId,
        [FromBody] RenameMediaHostDto request,
        CancellationToken ct)
    {
        if (!IsLocalRequest(HttpContext.Connection.RemoteIpAddress))
            return Forbid();

        try
        {
            var host = await registry.RenameAsync(hostId, request.Name, ct);
            if (host is null)
                return NotFound();

            await uiHub.Clients.All.SendAsync(
                "MediaHostUpdated", hostId, host.Status, ct);

            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{hostId:guid}/record")]
    public async Task<IActionResult> DeleteHostRecord(Guid hostId, CancellationToken ct)
    {
        if (!IsLocalRequest(HttpContext.Connection.RemoteIpAddress))
            return Forbid();

        try
        {
            if (!await pairingService.DeleteRevokedHostAsync(hostId, ct))
                return NotFound();

            await uiHub.Clients.All.SendAsync(
                "MediaHostRemoved", hostId, ct);

            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpDelete("{hostId:guid}")]
    public async Task<IActionResult> RevokeHost(Guid hostId, CancellationToken ct)
    {
        if (!IsLocalRequest(HttpContext.Connection.RemoteIpAddress))
            return Forbid();

        try
        {
            await pairingService.RevokeHostAsync(hostId, ct);
            await agentHub.Clients.Group($"media-host:{hostId:D}")
                .SendAsync("MediaHostRevoked", cancellationToken: ct);
            await uiHub.Clients.All.SendAsync(
                "MediaHostUpdated", hostId, "Disabled", ct);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    private static bool IsLocalRequest(System.Net.IPAddress? address)
    {
        if (address is null)
            return false;

        if (address.IsIPv4MappedToIPv6)
            address = address.MapToIPv4();

        return System.Net.IPAddress.IsLoopback(address);
    }

    [HttpPost("{hostId:guid}/playback")]
    public async Task<IActionResult> SendPlaybackCommand(
        Guid hostId,
        [FromBody] MediaPlaybackCommandDto request,
        CancellationToken ct)
    {
        var action = request.Action?.Trim().ToLowerInvariant();
        var allowedActions = new[] { "play", "pause", "resume", "stop", "close", "seek", "volume", "mute" };

        if (string.IsNullOrWhiteSpace(action) || !allowedActions.Contains(action))
            return BadRequest(new { message = "Unsupported playback action." });

        if (string.IsNullOrWhiteSpace(request.DisplayKey))
            return BadRequest(new { message = "DisplayKey is required." });

        if (action == "play" && request.VideoFileId is null)
            return BadRequest(new { message = "VideoFileId is required for Play." });

        if (action != "play" && request.VideoFileId is not null)
            return BadRequest(new { message = "VideoFileId is only valid for Play." });

        var host = await registry.GetByIdAsync(hostId, ct);
        if (host is null)
            return NotFound(new { message = "Media Host was not found." });

        if (!string.Equals(host.Status, "Online", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Media Host is offline." });

        var video = action == "play"
            ? await videoFiles.GetByIdAsync(request.VideoFileId!.Value, ct)
            : null;

        if (action == "play" && video is null)
            return NotFound(new { message = "Video file was not found in the media library." });

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
                    VideoFileId = video?.Id,
                    VideoSha256 = video?.Sha256,
                    VideoSize = video?.Size,
                    VideoFileName = video?.FileName,
                    request.PositionMs,
                    request.Volume,
                    request.Muted
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
