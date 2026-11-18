using System.Collections.Concurrent;

namespace audexa_backend.Media;

/// <summary>
/// Keeps the live state of connected Media Agents. This is intentionally an
/// in-memory registry: connectivity and display state are runtime data, while
/// durable host configuration can be introduced separately.
/// </summary>
public sealed class MediaHostRegistry
{
    private readonly ConcurrentDictionary<string, MediaHostSnapshot> _hosts = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> _connectionToHost = new(StringComparer.Ordinal);

    public IReadOnlyList<MediaHostSnapshot> GetAll() => _hosts.Values
        .OrderBy(x => x.HostName, StringComparer.OrdinalIgnoreCase)
        .ToArray();

    public bool TryGet(string hostId, out MediaHostSnapshot? host) => _hosts.TryGetValue(hostId, out host);

    public void Register(string connectionId, RegisterMediaHostRequest request)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.HostId);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.HostName);
        ArgumentNullException.ThrowIfNull(request.Displays);

        if (_connectionToHost.TryGetValue(connectionId, out var previousHostId) &&
            !string.Equals(previousHostId, request.HostId, StringComparison.OrdinalIgnoreCase))
        {
            MarkOffline(connectionId);
        }

        var now = DateTimeOffset.UtcNow;
        _hosts.AddOrUpdate(
            request.HostId,
            _ => new MediaHostSnapshot(request.HostId, request.HostName, request.AgentVersion, true, now, request.Displays.ToArray()),
            (_, current) => current with
            {
                HostName = request.HostName,
                AgentVersion = request.AgentVersion,
                IsOnline = true,
                LastSeenAt = now,
                Displays = request.Displays.ToArray()
            });

        _connectionToHost[connectionId] = request.HostId;
    }

    public void Heartbeat(string connectionId)
    {
        if (!_connectionToHost.TryGetValue(connectionId, out var hostId))
            return;

        if (_hosts.TryGetValue(hostId, out var current))
            _hosts[hostId] = current with { IsOnline = true, LastSeenAt = DateTimeOffset.UtcNow };
    }

    public void UpdateDisplays(string connectionId, IReadOnlyList<MediaDisplayDto> displays)
    {
        if (!_connectionToHost.TryGetValue(connectionId, out var hostId))
            throw new InvalidOperationException("Media Host must register before updating displays.");

        if (_hosts.TryGetValue(hostId, out var current))
            _hosts[hostId] = current with { Displays = displays.ToArray(), LastSeenAt = DateTimeOffset.UtcNow };
    }

    public void MarkOffline(string connectionId)
    {
        if (!_connectionToHost.TryRemove(connectionId, out var hostId))
            return;

        // Do not mark a newer connection offline when an agent reconnects and
        // its old SignalR connection closes afterwards.
        var hasAnotherConnection = _connectionToHost.Values.Any(x =>
            string.Equals(x, hostId, StringComparison.OrdinalIgnoreCase));

        if (!hasAnotherConnection && _hosts.TryGetValue(hostId, out var current))
            _hosts[hostId] = current with { IsOnline = false };
    }
}
