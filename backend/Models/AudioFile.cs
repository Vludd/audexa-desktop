namespace audexa_backend.Models;

public class AudioFile
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string FileName { get; set; } = string.Empty;

    public string StorageFileName { get; set; } = string.Empty;

    public string Format { get; set; } = string.Empty;

    public TimeSpan Duration { get; set; }

    public long Size { get; set; }

    public int SampleRate { get; set; }

    public int Channels { get; set; }

    public int Volume { get; set; } = 100;

    public int VolumeDb { get; set; }

    public DateTime CreatedAt { get; set; }
}