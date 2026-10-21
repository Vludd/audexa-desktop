using audexa_backend.DTOs.AudioFiles;
using audexa_backend.Models;
using Microsoft.AspNetCore.Http;

namespace audexa_backend.Services;

public interface IAudioFileService
{
    IReadOnlyCollection<AudioFile> GetAll();

    AudioFile? GetById(Guid id);

    AudioFile Create(CreateAudioFileRequest request);

    Task<AudioFile> UploadAsync(
        IFormFile file,
        CancellationToken cancellationToken = default);

    Task<(AudioFile AudioFile, string FilePath)?> GetStreamAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    AudioFile? Update(Guid id, UpdateAudioFileRequest request);

    bool Delete(Guid id);
}