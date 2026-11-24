namespace audexa_backend.Models;

public sealed class MediaHostCredential
{
    public Guid Id { get; set; }
    public Guid MediaHostId { get; set; }
    public MediaHost MediaHost { get; set; } = null!;
    public string SecretHash { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAtUtc { get; set; }
    public DateTime? LastUsedAtUtc { get; set; }
}
