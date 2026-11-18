using System.Security.Cryptography;
using System.Text;
using audexa_backend.Media;
using Microsoft.AspNetCore.SignalR;

namespace audexa_backend.Hubs;

public sealed class MediaAgentHub : Hub
{
    private readonly MediaHostRegistry _registry;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MediaAgentHub> _logger;

    public MediaAgentHub(
        MediaHostRegistry registry,
        IConfiguration configuration,
        ILogger<MediaAgentHub> logger)
    {
        _registry = registry;
        _configuration = configuration;
        _logger = logger;
    }

    public override Task OnConnectedAsync()
    {
        var expectedToken = _configuration["MediaAgents:SharedToken"];
        var suppliedToken = Context.GetHttpContext()?.Request.Headers["X-Audexa-Agent-Token"].ToString();

        if (!IsValidToken(expectedToken, suppliedToken))
        {
            _logger.LogWarning("Rejected Media Agent connection {ConnectionId}: invalid or missing agent token.", Context.ConnectionId);
            Context.Abort();
            return Task.CompletedTask;
        }

        return base.OnConnectedAsync();
    }

    public Task Register(RegisterMediaHostRequest request)
    {
        _registry.Register(Context.ConnectionId, request);
        _logger.LogInformation("Media Host {HostId} ({HostName}) registered with {DisplayCount} displays.",
            request.HostId, request.HostName, request.Displays.Count);
        return Clients.Others.SendAsync("MediaHostChanged", request.HostId);
    }

    public Task Heartbeat()
    {
        _registry.Heartbeat(Context.ConnectionId);
        return Task.CompletedTask;
    }

    public Task UpdateDisplays(IReadOnlyList<MediaDisplayDto> displays)
    {
        _registry.UpdateDisplays(Context.ConnectionId, displays);
        return Clients.Others.SendAsync("MediaDisplaysChanged", Context.ConnectionId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _registry.MarkOffline(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    private static bool IsValidToken(string? expected, string? supplied)
    {
        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(supplied))
            return false;

        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        var suppliedBytes = Encoding.UTF8.GetBytes(supplied);
        return expectedBytes.Length == suppliedBytes.Length &&
               CryptographicOperations.FixedTimeEquals(expectedBytes, suppliedBytes);
    }
}
