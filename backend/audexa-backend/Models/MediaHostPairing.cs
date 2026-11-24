namespace audexa_backend.Models;

public sealed class MediaHostPairing
{
    public Guid Id { get; set; }
    public string CodeHash { get; set; } = string.Empty;
    public string HostName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? UsedAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    // Kept for compatibility with the already-created SQLite migration schema.
    public int FailedAttempts { get; set; }
}
