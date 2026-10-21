using audexa_backend.DTOs.AudioFiles;
using audexa_backend.Models;
using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/audio")]
public class AudioFilesController : ControllerBase
{
    private readonly IAudioFileService _audioFileService;

    public AudioFilesController(IAudioFileService audioFileService)
    {
        _audioFileService = audioFileService;
    }

    [HttpGet]
    public ActionResult<IReadOnlyCollection<AudioFile>> GetAll()
    {
        return Ok(_audioFileService.GetAll());
    }

    [HttpGet("{id:guid}")]
    public ActionResult<AudioFile> GetById(Guid id)
    {
        var audioFile = _audioFileService.GetById(id);

        if (audioFile is null)
        {
            return NotFound();
        }

        return Ok(audioFile);
    }

    [HttpGet("{id:guid}/stream")]
    public async Task<IActionResult> Stream(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _audioFileService.GetStreamAsync(
            id,
            cancellationToken);

        if (result is null)
        {
            return NotFound();
        }

        var audioFile = result.Value.AudioFile;
        var filePath = result.Value.FilePath;

        var contentType = audioFile.Format.ToUpperInvariant() switch
        {
            "WAV" => "audio/wav",
            "MP3" => "audio/mpeg",
            _ => "application/octet-stream"
        };

        var stream = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            64 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan);

        return new FileStreamResult(stream, contentType)
        {
            EnableRangeProcessing = true
        };
    }

    [HttpPost]
    public ActionResult<AudioFile> Create(CreateAudioFileRequest request)
    {
        var audioFile = _audioFileService.Create(request);

        return CreatedAtAction(
            nameof(GetById),
            new { id = audioFile.Id },
            audioFile
        );
    }

    [HttpPost("upload")]
    public async Task<ActionResult<AudioFile>> Upload(
    IFormFile file,
    CancellationToken cancellationToken)
    {
        try
        {
            var audioFile = await _audioFileService.UploadAsync(
                file,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = audioFile.Id },
                audioFile);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                message = ex.Message
            });
        }
    }

    [HttpPut("{id:guid}")]
    public ActionResult<AudioFile> Update(
        Guid id,
        UpdateAudioFileRequest request)
    {
        try
        {
            var audioFile = _audioFileService.Update(id, request);

            if (audioFile is null)
            {
                return NotFound();
            }

            return Ok(audioFile);
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new
            {
                message = ex.Message
            });
        }
    }

    [HttpDelete("{id:guid}")]
    public IActionResult Delete(Guid id)
    {
        try
        {
            var deleted = _audioFileService.Delete(id);

            if (!deleted)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (AudioFileInUseException ex)
        {
            return Conflict(new
            {
                code = ex.Code,
                message = ex.Message
            });
        }
    }
}