using audexa_backend.DTOs.VideoFiles;
using audexa_backend.Models;
using audexa_backend.Services;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/video")]
public sealed class VideoFilesController : ControllerBase
{
    private readonly VideoFileService _service;
    public VideoFilesController(VideoFileService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<VideoFile>>> GetAll(CancellationToken ct) =>
        Ok(await _service.GetAllAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<VideoFile>> GetById(Guid id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("upload")]
    [RequestSizeLimit(4L * 1024 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 4L * 1024 * 1024 * 1024)]
    public async Task<ActionResult<VideoFile>> Upload(IFormFile file, CancellationToken ct)
    {
        try
        {
            var item = await _service.UploadAsync(file, ct);
            return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id:guid}/stream")]
    public async Task<IActionResult> Stream(Guid id, CancellationToken ct)
    {
        var result = await _service.GetStreamAsync(id, ct);
        if (result is null) return NotFound();

        var (item, path) = result.Value;
        var contentType = item.Format switch
        {
            "MP4" or "M4V" => "video/mp4",
            "WEBM" => "video/webm",
            "MOV" => "video/quicktime",
            "AVI" => "video/x-msvideo",
            "MPEG" or "MPG" => "video/mpeg",
            _ => "application/octet-stream"
        };

        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read,
            1024 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan);
        return new FileStreamResult(stream, contentType) { EnableRangeProcessing = true };
    }

    // Agent-only endpoint. The shared Agent token is never exposed to the frontend.
    [HttpGet("{id:guid}/agent-download")]
    public async Task<IActionResult> AgentDownload(Guid id, [FromServices] IConfiguration configuration, CancellationToken ct)
    {
        var expected = configuration["MediaHosts:AgentToken"];
        var supplied = Request.Headers["X-Audexa-Agent-Token"].ToString();

        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(supplied))
            return Unauthorized();

        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        var suppliedBytes = Encoding.UTF8.GetBytes(supplied);
        if (expectedBytes.Length != suppliedBytes.Length ||
            !CryptographicOperations.FixedTimeEquals(expectedBytes, suppliedBytes))
            return Unauthorized();

        var result = await _service.GetStreamAsync(id, ct);
        if (result is null) return NotFound();

        var (item, path) = result.Value;
        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read,
            1024 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan);
        Response.ContentLength = item.Size;
        Response.Headers["X-Audexa-SHA256"] = item.Sha256;
        return File(stream, "application/octet-stream", item.FileName, enableRangeProcessing: true);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<VideoFile>> Update(Guid id, UpdateVideoFileRequest request, CancellationToken ct)
    {
        try
        {
            var item = await _service.UpdateAsync(id, request, ct);
            return item is null ? NotFound() : Ok(item);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        await _service.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
