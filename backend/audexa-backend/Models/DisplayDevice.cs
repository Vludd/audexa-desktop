namespace audexa_backend.Models;

public class DisplayDevice
{
    public Guid Id { get; set; }
    public Guid MediaHostId { get; set; }
    public MediaHost MediaHost { get; set; } = null!;
    public string DisplayKey { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public string FriendlyName { get; set; } = string.Empty;
    public int Width { get; set; }
    public int Height { get; set; }
    public int RefreshRate { get; set; }
    public bool IsPrimary { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
