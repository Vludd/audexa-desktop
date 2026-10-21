namespace audexa_backend.DTOs.AudioFiles;

public class UpdateAudioFileRequest
{
    public string Name { get; set; } = string.Empty;

    public int? Volume { get; set; }

    public int? VolumeDb { get; set; }
}
