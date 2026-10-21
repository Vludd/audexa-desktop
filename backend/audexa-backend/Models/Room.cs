namespace audexa_backend.Models;

public class Room
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;


    public int Volume { get; set; } = 100;

    public ICollection<OutputMapping> OutputMappings { get; set; } = new List<OutputMapping>();
}