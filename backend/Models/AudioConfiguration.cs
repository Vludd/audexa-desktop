namespace audexa_backend.Models;

public class AudioConfiguration
{
    public Guid Id { get; set; }

    public int Version { get; set; } = 1;

    public string? DeviceId { get; set; }

    public string? TranslationOutputId { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<OutputMapping> Mappings { get; set; } = new List<OutputMapping>();
}
