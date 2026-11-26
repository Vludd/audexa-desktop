using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using DevEnvy.FFmpeg.Binaries;

namespace audexa_backend.Services;

internal sealed record VideoMetadata(long? DurationMs, int? Width, int? Height);

internal static class VideoMetadataProbe
{
    public static async Task<VideoMetadata> ReadAsync(string filePath, CancellationToken ct)
    {
        var executable = FFmpegBinaries.GetFFprobePath();
        if (string.IsNullOrWhiteSpace(executable) || !File.Exists(executable))
            throw new InvalidOperationException("FFprobe is not available in the application package.");

        var startInfo = new ProcessStartInfo
        {
            FileName = executable,
            WorkingDirectory = Path.GetDirectoryName(executable) ?? Environment.CurrentDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        startInfo.ArgumentList.Add("-v");
        startInfo.ArgumentList.Add("error");
        startInfo.ArgumentList.Add("-show_entries");
        startInfo.ArgumentList.Add("format=duration:stream=codec_type,duration,width,height");
        startInfo.ArgumentList.Add("-of");
        startInfo.ArgumentList.Add("json");
        startInfo.ArgumentList.Add(filePath);

        using var process = new Process { StartInfo = startInfo };
        if (!process.Start())
            throw new InvalidOperationException("FFprobe could not be started.");

        try
        {
            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync(ct);
            var output = await outputTask;
            var error = await errorTask;

            if (process.ExitCode != 0)
            {
                var detail = string.IsNullOrWhiteSpace(error) ? "No metadata was returned." : error.Trim();
                if (detail.Length > 512) detail = detail[..512];
                throw new InvalidOperationException($"FFprobe could not read video metadata: {detail}");
            }

            return ParseMetadata(output);
        }
        finally
        {
            if (!process.HasExited)
                process.Kill(entireProcessTree: true);
        }
    }

    private static VideoMetadata ParseMetadata(string output)
    {
        using var document = JsonDocument.Parse(output);
        var root = document.RootElement;

        var formatDuration = root.TryGetProperty("format", out var format)
            ? ReadNumber(format, "duration")
            : null;

        JsonElement? videoStream = null;
        if (root.TryGetProperty("streams", out var streams) && streams.ValueKind == JsonValueKind.Array)
        {
            foreach (var stream in streams.EnumerateArray())
            {
                if (stream.TryGetProperty("codec_type", out var codecType) &&
                    codecType.ValueKind == JsonValueKind.String &&
                    codecType.GetString() == "video")
                {
                    videoStream = stream;
                    break;
                }
            }
        }

        var durationSeconds = formatDuration ??
            (videoStream is { } selectedVideoStream ? ReadNumber(selectedVideoStream, "duration") : null);
        var durationMs = durationSeconds is > 0 and var seconds &&
                         double.IsFinite(seconds) &&
                         seconds <= long.MaxValue / 1000d
            ? (long?)Math.Round(seconds * 1000, MidpointRounding.AwayFromZero)
            : null;

        var width = videoStream is { } selectedStream ? ReadInteger(selectedStream, "width") : null;
        var height = videoStream is { } selectedStreamForHeight
            ? ReadInteger(selectedStreamForHeight, "height")
            : null;

        return new VideoMetadata(durationMs, width, height);
    }

    private static double? ReadNumber(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
            return null;

        if (property.ValueKind == JsonValueKind.Number && property.TryGetDouble(out var number))
            return number;

        return property.ValueKind == JsonValueKind.String &&
               double.TryParse(property.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out number)
            ? number
            : null;
    }

    private static int? ReadInteger(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
            return null;

        if (property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out var number))
            return number;

        return property.ValueKind == JsonValueKind.String &&
               int.TryParse(property.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out number)
            ? number
            : null;
    }
}
