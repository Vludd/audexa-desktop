using Microsoft.AspNetCore.Http;

namespace audexa_backend.DTOs.AudioFiles;

public class UploadAudioFileRequest
{
    public IFormFile File { get; set; } = null!;
}