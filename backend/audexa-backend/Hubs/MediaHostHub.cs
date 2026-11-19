using audexa_backend.DTOs;
using audexa_backend.Services;
using Microsoft.AspNetCore.SignalR;

namespace audexa_backend.Hubs;

public sealed class MediaHostHub(
    MediaHostRegistry registry,
    IConfiguration configuration,
    ILogger<MediaHostHub> logger,
    IHubContext<MediaHostsUiHub> uiHub,
    PlaybackCommandRegistry playbackCommands) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var expected = configuration["MediaHosts:AgentToken"];
        var supplied = Context.GetHttpContext()?.Request.Headers["X-Audexa-Agent-Token"].ToString();

        if (string.IsNullOrWhiteSpace(expected) ||
            string.IsNullOrWhiteSpace(supplied) ||
            !System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(expected),
                System.Text.Encoding.UTF8.GetBytes(supplied)))
        {
            logger.LogWarning(
                "Rejected Media Agent SignalR connection from {RemoteIp}.",
                Context.GetHttpContext()?.Connection.RemoteIpAddress);

            Context.Abort();
            return;
        }

        await base.OnConnectedAsync();
    }

    public async Task RegisterHost(MediaHostRegistrationDto request)
    {
        var host = await registry.RegisterAsync(
            request,
            Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString(),
            Context.ConnectionAborted);

        Context.Items["MediaHostId"] = host.Id;

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            GroupName(host.Id));

        await uiHub.Clients.All.SendAsync(
            "MediaHostUpdated",
            host.Id,
            "Online",
            Context.ConnectionAborted);
    }

    public async Task ReportPlaybackCommandResult(PlaybackCommandResultDto result)
    {
        var hostId = GetHostId();
        var updated = playbackCommands.Update(hostId, result);

        if (updated is null)
        {
            logger.LogWarning(
                "Ignoring playback command result for unknown command {CommandId} from host {HostId}.",
                result.CommandId,
                hostId);
            return;
        }

        await uiHub.Clients.All.SendAsync(
            "PlaybackCommandUpdated",
            updated,
            Context.ConnectionAborted);
    }

    public async Task ReportPlaybackStates(IReadOnlyCollection<AgentPlaybackStateDto> states)
    {
        var hostId = GetHostId();
        var payload = states.Select(state => new PlaybackStateDto(hostId, state.DisplayKey, state.State, state.Media,
            state.PositionMs, state.DurationMs, state.Volume, state.IsMuted, state.Error, DateTime.UtcNow)).ToArray();
        await uiHub.Clients.All.SendAsync("PlaybackStatesUpdated", payload, Context.ConnectionAborted);
    }

    public async Task Heartbeat()
    {
        var hostId = GetHostId();

        if (!await registry.HeartbeatAsync(
                hostId,
                Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString(),
                Context.ConnectionAborted))
        {
            throw new HubException(
                "Media Host is not registered. Call RegisterHost first.");
        }
    }

    public async Task ReportDisplays(IReadOnlyCollection<DisplayReportDto> displays)
    {
        var hostId = GetHostId();

        if (!await registry.UpdateDisplaysAsync(
                hostId,
                displays,
                Context.ConnectionAborted))
        {
            throw new HubException(
                "Media Host is not registered. Call RegisterHost first.");
        }

        await uiHub.Clients.All.SendAsync(
            "MediaHostDisplaysUpdated",
            hostId,
            Context.ConnectionAborted);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.Items.TryGetValue("MediaHostId", out var value) &&
            value is Guid hostId)
        {
            await uiHub.Clients.All.SendAsync(
                "MediaHostConnectionLost",
                hostId,
                CancellationToken.None);
        }

        await base.OnDisconnectedAsync(exception);
    }

    private Guid GetHostId() =>
        Context.Items.TryGetValue("MediaHostId", out var value) &&
        value is Guid id
            ? id
            : throw new HubException(
                "Call RegisterHost before sending agent events.");

    private static string GroupName(Guid hostId) =>
        $"media-host:{hostId:D}";
}