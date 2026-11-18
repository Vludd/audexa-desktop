using Microsoft.AspNetCore.SignalR;

namespace audexa_backend.Hubs;

/// <summary>
/// Read-only SignalR endpoint for the Audexa frontend.
/// Media Agents must use MediaHostHub instead.
/// </summary>
public sealed class MediaHostsUiHub : Hub
{
}