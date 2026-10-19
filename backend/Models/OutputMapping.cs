namespace audexa_backend.Models;

public class OutputMapping
{
    public Guid Id { get; set; }

    public Guid RoomId { get; set; }

    public string OutputId { get; set; } = string.Empty;

    public Guid AudioConfigurationId { get; set; }

    public AudioConfiguration AudioConfiguration { get; set; } = null!;
}
