namespace audexa_backend.Models;

public class VideoFile
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string StorageFileName { get; set; } = string.Empty;
    public string Format { get; set; } = string.Empty;
    public long Size { get; set; }
    public long? DurationMs { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
