namespace Audexa.MediaAgent.Playback;

public sealed record PlaybackCommand(
    string CommandId,
    string Action,
    string DisplayKey,
    string? FilePath = null);
