using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using DevEnvy.FFmpeg.Binaries;
using audexa_backend.Data;
using audexa_backend.DTOs.VideoFiles;
using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace audexa_backend.Services;

public sealed class VideoFileService
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".m4v", ".mkv", ".mov", ".avi", ".webm", ".mpeg", ".mpg"
    };

    private const long MaxFileSize = 4L * 1024 * 1024 * 1024;
    private readonly AppDbContext _db;
    private readonly ILogger<VideoFileService> _logger;
    private readonly string _videoDirectory;
    private readonly string _thumbnailDirectory;

    public VideoFileService(AppDbContext db, ILogger<VideoFileService> logger)
    {
        _db = db;
        _logger = logger;
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        _videoDirectory = Path.Combine(appData, "Audexa", "Video");
        _thumbnailDirectory = Path.Combine(_videoDirectory, "Thumbnails");
        Directory.CreateDirectory(_videoDirectory);
    }

    public async Task<IReadOnlyCollection<VideoFile>> GetAllAsync(CancellationToken ct = default)
    {
        var files = await _db.VideoFiles.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var updated = false;

        foreach (var video in files.Where(x => x.DurationMs is null))
        {
            var path = Path.Combine(_videoDirectory, video.StorageFileName);
            if (!File.Exists(path))
            {
                _logger.LogWarning("Cannot read metadata for video {VideoId}: stored file {Path} is missing.", video.Id, path);
                continue;
            }

            var metadata = await TryReadMetadataAsync(path, video.FileName, ct);
            if (metadata?.DurationMs is not long durationMs)
                continue;

            video.DurationMs = durationMs;
            video.Width = metadata.Width;
            video.Height = metadata.Height;
            updated = true;
        }

        if (updated)
            await _db.SaveChangesAsync(ct);

        return files;
    }

    public Task<VideoFile?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.VideoFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<string?> GetThumbnailPathAsync(Guid id, CancellationToken ct = default)
    {
        var video = await _db.VideoFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (video is null)
            return null;

        var videoPath = Path.Combine(_videoDirectory, video.StorageFileName);
        if (!File.Exists(videoPath))
            return null;

        var thumbnailPath = GetThumbnailFilePath(id);
        if (File.Exists(thumbnailPath) && new FileInfo(thumbnailPath).Length > 0)
            return thumbnailPath;

        Directory.CreateDirectory(_thumbnailDirectory);
        var temporaryPath = Path.Combine(_thumbnailDirectory, $"{Guid.NewGuid():N}.jpg");
        try
        {
            if (!await TryCreateThumbnailAsync(video, videoPath, temporaryPath, ct))
                return null;

            if (!File.Exists(temporaryPath) || new FileInfo(temporaryPath).Length == 0)
            {
                _logger.LogWarning("FFmpeg produced an empty thumbnail for video {VideoId}.", id);
                return null;
            }

            File.Move(temporaryPath, thumbnailPath, overwrite: true);
            return thumbnailPath;
        }
        finally
        {
            if (File.Exists(temporaryPath))
                File.Delete(temporaryPath);
        }
    }

    public async Task<VideoFile> UploadAsync(IFormFile file, CancellationToken ct = default)
    {
        if (file is null || file.Length <= 0)
            throw new InvalidOperationException("The video file is empty.");
        if (file.Length > MaxFileSize)
            throw new InvalidOperationException("The video file exceeds the 4 GB limit.");

        var originalName = Path.GetFileName(file.FileName);
        var extension = Path.GetExtension(originalName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            throw new InvalidOperationException("Unsupported video format. Supported formats: MP4, M4V, MKV, MOV, AVI, WEBM, MPEG, MPG.");

        var id = Guid.NewGuid();
        var storageName = $"{id:N}{extension}";
        var storagePath = Path.Combine(_videoDirectory, storageName);

        try
        {
            await using (var output = new FileStream(storagePath, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                1024 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan))
            {
                await file.CopyToAsync(output, ct);
            }

            var metadata = await TryReadMetadataAsync(storagePath, originalName, ct);

            string sha256;
            await using (var input = new FileStream(storagePath, FileMode.Open, FileAccess.Read, FileShare.Read,
                1024 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan))
            {
                var hash = await SHA256.HashDataAsync(input, ct);
                sha256 = Convert.ToHexString(hash).ToLowerInvariant();
            }

            var entity = new VideoFile
            {
                Id = id,
                Name = Path.GetFileNameWithoutExtension(originalName),
                FileName = originalName,
                StorageFileName = storageName,
                Format = extension.TrimStart('.').ToUpperInvariant(),
                Size = file.Length,
                DurationMs = metadata?.DurationMs,
                Width = metadata?.Width,
                Height = metadata?.Height,
                Sha256 = sha256,
                CreatedAt = DateTime.UtcNow
            };

            _db.VideoFiles.Add(entity);
            await _db.SaveChangesAsync(ct);
            return entity;
        }
        catch
        {
            if (File.Exists(storagePath)) File.Delete(storagePath);
            throw;
        }
    }

    private async Task<VideoMetadata?> TryReadMetadataAsync(string path, string fileName, CancellationToken ct)
    {
        try
        {
            var metadata = await VideoMetadataProbe.ReadAsync(path, ct);
            if (metadata.DurationMs is null)
                _logger.LogWarning("Video duration could not be determined for {VideoFileName}.", fileName);
            return metadata;
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Could not read metadata for video {VideoFileName}.", fileName);
            return null;
        }
    }

    private async Task<bool> TryCreateThumbnailAsync(
        VideoFile video,
        string videoPath,
        string thumbnailPath,
        CancellationToken ct)
    {
        var executable = FFmpegBinaries.GetFFmpegPath();
        if (string.IsNullOrWhiteSpace(executable) || !File.Exists(executable))
        {
            _logger.LogWarning("FFmpeg is not available; cannot create a thumbnail for video {VideoId}.", video.Id);
            return false;
        }

        var seekSeconds = video.DurationMs is long durationMs && durationMs > 0
            ? Math.Min(1d, durationMs / 10_000d)
            : 0d;
        var startInfo = new ProcessStartInfo
        {
            FileName = executable,
            WorkingDirectory = Path.GetDirectoryName(executable) ?? Environment.CurrentDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true
        };
        startInfo.ArgumentList.Add("-hide_banner");
        startInfo.ArgumentList.Add("-loglevel");
        startInfo.ArgumentList.Add("error");
        startInfo.ArgumentList.Add("-nostdin");
        startInfo.ArgumentList.Add("-ss");
        startInfo.ArgumentList.Add(seekSeconds.ToString("0.###", CultureInfo.InvariantCulture));
        startInfo.ArgumentList.Add("-i");
        startInfo.ArgumentList.Add(videoPath);
        startInfo.ArgumentList.Add("-frames:v");
        startInfo.ArgumentList.Add("1");
        startInfo.ArgumentList.Add("-vf");
        startInfo.ArgumentList.Add("scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2");
        startInfo.ArgumentList.Add("-q:v");
        startInfo.ArgumentList.Add("4");
        startInfo.ArgumentList.Add(thumbnailPath);

        try
        {
            using var process = new Process { StartInfo = startInfo };
            if (!process.Start())
            {
                _logger.LogWarning("FFmpeg could not be started for video {VideoId}.", video.Id);
                return false;
            }

            var errorTask = process.StandardError.ReadToEndAsync();
            try
            {
                await process.WaitForExitAsync(ct);
            }
            finally
            {
                if (!process.HasExited)
                {
                    try
                    {
                        process.Kill(entireProcessTree: true);
                    }
                    catch (InvalidOperationException)
                    {
                    }
                }
            }

            var error = await errorTask;
            if (process.ExitCode != 0)
            {
                if (error.Length > 512) error = error[..512];
                _logger.LogWarning("Could not create a thumbnail for video {VideoId}: {Error}", video.Id, error.Trim());
                return false;
            }

            return true;
        }
        catch (Win32Exception ex)
        {
            _logger.LogWarning(ex, "Could not start FFmpeg for video {VideoId}.", video.Id);
            return false;
        }
    }

    private string GetThumbnailFilePath(Guid id) =>
        Path.Combine(_thumbnailDirectory, $"{id:N}.jpg");

    public async Task<(VideoFile VideoFile, string FilePath)?> GetStreamAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.VideoFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;
        var path = Path.Combine(_videoDirectory, entity.StorageFileName);
        return File.Exists(path) ? (entity, path) : null;
    }

    public async Task<VideoFile?> UpdateAsync(Guid id, UpdateVideoFileRequest request, CancellationToken ct = default)
    {
        var name = request.Name?.Trim();
        if (request.Name is not null && string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Video name cannot be empty.", nameof(request));
        if (request.Name is null && request.GainDb is null)
            throw new ArgumentException("At least one video property must be provided.", nameof(request));

        var entity = await _db.VideoFiles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;
        if (name is not null) entity.Name = name;
        if (request.GainDb is int gainDb) entity.GainDb = Math.Clamp(gainDb, -24, 24);
        await _db.SaveChangesAsync(ct);
        return entity;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.VideoFiles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        var path = Path.Combine(_videoDirectory, entity.StorageFileName);
        _db.VideoFiles.Remove(entity);
        await _db.SaveChangesAsync(ct);
        if (File.Exists(path)) File.Delete(path);
        var thumbnailPath = GetThumbnailFilePath(id);
        if (File.Exists(thumbnailPath)) File.Delete(thumbnailPath);
        return true;
    }
}
