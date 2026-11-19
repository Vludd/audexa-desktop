namespace Audexa.MediaAgent.Playback;

public sealed record PlaybackCommand(
    string CommandId,
    string Action,
    string DisplayKey,
    string? FilePath = null);

public sealed record PlaybackCommandResult(
    string CommandId,
    string Status,
    string? Error = null);
