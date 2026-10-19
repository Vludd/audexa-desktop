namespace audexa_backend.Models;

public class ScenarioStep
{
    public Guid Id { get; set; }

    public Guid ScenarioId { get; set; }

    public Scenario Scenario { get; set; } = null!;

    public int Order { get; set; }

    public Guid RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public Guid AudioFileId { get; set; }

    public AudioFile AudioFile { get; set; } = null!;

    public Guid? TranslationAudioFileId { get; set; }

    public AudioFile? TranslationAudioFile { get; set; }

    public int DelayMs { get; set; }
}
