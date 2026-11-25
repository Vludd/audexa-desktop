namespace audexa_backend.Models;

public class ScenarioStep
{
    public Guid Id { get; set; }

    public Guid ScenarioId { get; set; }

    public Scenario Scenario { get; set; } = null!;

    public int Order { get; set; }

    public Guid? RoomId { get; set; }

    public Room? Room { get; set; }

    public Guid? AudioFileId { get; set; }

    public AudioFile? AudioFile { get; set; }

    public Guid? VideoFileId { get; set; }

    public VideoFile? VideoFile { get; set; }

    public Guid? MediaHostId { get; set; }

    public MediaHost? MediaHost { get; set; }

    public string? DisplayKey { get; set; }

    /// <summary>Muted, HostOutput or RoomOutput.</summary>
    public string? VideoAudioMode { get; set; }

    public Guid? TranslationAudioFileId { get; set; }

    public AudioFile? TranslationAudioFile { get; set; }

    public int DelayMs { get; set; }
}
