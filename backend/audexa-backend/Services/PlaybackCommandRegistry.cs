using audexa_backend.DTOs;

namespace audexa_backend.Services;

/// <summary>
/// Keeps a bounded in-memory history of remote playback command lifecycle states.
/// This is intentionally ephemeral; durable command history can be added separately.
/// </summary>
public sealed class PlaybackCommandRegistry
{
    private const int MaxEntries = 500;
    private readonly object _sync = new();
    private readonly Dictionary<string, PlaybackCommandStatusDto> _commands = new(StringComparer.Ordinal);
    private readonly Queue<string> _order = new();

    public PlaybackCommandStatusDto Create(Guid hostId, string displayKey, string action)
    {
        var now = DateTime.UtcNow;
        var command = new PlaybackCommandStatusDto(
            Guid.NewGuid().ToString("N"), hostId, displayKey, action,
            "Dispatched", null, now, now);

        lock (_sync)
        {
            _commands.Add(command.CommandId, command);
            _order.Enqueue(command.CommandId);
            Trim();
        }

        return command;
    }

    public PlaybackCommandStatusDto? Update(
        Guid hostId,
        PlaybackCommandResultDto result)
    {
        lock (_sync)
        {
            if (!_commands.TryGetValue(result.CommandId, out var current) ||
                current.HostId != hostId)
                return null;

            var status = result.Status.Trim();
            if (status is not ("Accepted" or "Completed" or "Failed"))
                throw new ArgumentException("Unsupported playback command result status.");

            // Ignore stale or duplicate updates after a terminal state.
            if (current.Status is "Completed" or "Failed")
                return current;

            var updated = current with
            {
                Status = status,
                Error = status == "Failed" ? NormalizeError(result.Error) : null,
                UpdatedAtUtc = DateTime.UtcNow
            };

            _commands[result.CommandId] = updated;
            return updated;
        }
    }

    public PlaybackCommandStatusDto? Get(string commandId)
    {
        lock (_sync)
            return _commands.GetValueOrDefault(commandId);
    }

    private void Trim()
    {
        while (_order.Count > MaxEntries)
        {
            var oldest = _order.Dequeue();
            _commands.Remove(oldest);
        }
    }

    private static string NormalizeError(string? error)
    {
        if (string.IsNullOrWhiteSpace(error))
            return "The Media Agent reported an unspecified error.";

        return error.Length <= 2000 ? error : error[..2000];
    }
}
