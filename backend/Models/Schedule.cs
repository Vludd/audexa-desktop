namespace audexa_backend.Models;

public class Schedule
{
    public int Id { get; set; }

    public TimeSpan Time { get; set; }

    public Guid ScenarioId { get; set; }

    public Scenario Scenario { get; set; } = null!;

    // Stored as a comma-separated list of ISO-like weekday keys: mon,tue,...,sun.
    public string Days { get; set; } = string.Empty;

    public string Repeat { get; set; } = "daily";

    public bool Enabled { get; set; } = true;

    public DateOnly? ExecutionDate { get; set; }

    // Persisted occurrence guard prevents duplicate runs after backend restarts.
    public DateTime? LastTriggeredAt { get; set; }

    public string? LastExecutionStatus { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
