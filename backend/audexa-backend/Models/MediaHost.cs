namespace audexa_backend.Models;

public class MediaHost
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string MachineName { get; set; } = string.Empty;
    public string AgentVersion { get; set; } = string.Empty;
    public string Status { get; set; } = "Offline";
    public string? IpAddress { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAtUtc { get; set; } = DateTime.UtcNow;
    public ICollection<DisplayDevice> Displays { get; set; } = new List<DisplayDevice>();
    public ICollection<MediaHostCredential> Credentials { get; set; } = new List<MediaHostCredential>();
}
