namespace audexa_backend.DTOs.VideoFiles;

public sealed class UpdateVideoFileRequest
{
    public string? Name { get; set; }
    public int? GainDb { get; set; }
}
