namespace audexa_backend.Models;

public class Scenario
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Status { get; set; } = "inactive";

    public string PlayMode { get; set; } = "sequential";

    public string Repeat { get; set; } = "once";

    public bool StopPrevious { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<ScenarioStep> Steps { get; set; } = [];
}
