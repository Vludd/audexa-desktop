namespace Audexa.MediaAgent.Playback;

public sealed record PlaybackCommand(
    string CommandId,
    string Action,
    string DisplayKey,
    string? FilePath = null, long? PositionMs = null, int? Volume = null, bool? Muted = null);

public sealed record PlaybackCommandResult(
    string CommandId,
    string Status,
    string? Error = null);
