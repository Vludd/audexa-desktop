namespace audexa_backend.DTOs.AudioFiles;

public class CreateAudioFileRequest
{
    public string Name { get; set; } = string.Empty;

    public string FileName { get; set; } = string.Empty;

    public string Format { get; set; } = string.Empty;

    public TimeSpan Duration { get; set; }

    public long Size { get; set; }

    public int SampleRate { get; set; }

    public int Channels { get; set; }

    public int Volume { get; set; } = 100;

    public int VolumeDb { get; set; }
}