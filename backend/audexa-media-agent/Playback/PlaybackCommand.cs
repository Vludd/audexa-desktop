namespace Audexa.MediaAgent.Playback;

public sealed record PlaybackCommand(
    string CommandId,
    string Action,
    string DisplayKey,
    long? PositionMs = null, int? Volume = null, bool? Muted = null, Guid? VideoFileId = null, string? VideoSha256 = null, long? VideoSize = null, string? VideoFileName = null);

public sealed record PlaybackCommandResult(
    string CommandId,
    string Status,
    string? Error = null);
