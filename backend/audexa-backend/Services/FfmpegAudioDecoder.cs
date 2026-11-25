using System.Diagnostics;
using DevEnvy.FFmpeg.Binaries;
using NAudio.Wave;

namespace audexa_backend.Services;

internal sealed class FfmpegAudioDecoder : IDisposable
{
    private readonly Process _process;
    private readonly RawSourceWaveStream _source;
    private readonly Task<string> _errorOutput;

    private FfmpegAudioDecoder(Process process)
    {
        _process = process;
        _source = new RawSourceWaveStream(process.StandardOutput.BaseStream, new WaveFormat(48000, 16, 1));
        _errorOutput = process.StandardError.ReadToEndAsync();
    }

    public WaveStream Source => _source;

    public static FfmpegAudioDecoder Open(string mediaPath)
    {
        var executable = FFmpegBinaries.GetFFmpegPath();
        if (string.IsNullOrWhiteSpace(executable) || !File.Exists(executable))
            throw new PlaybackException("FFMPEG_NOT_AVAILABLE", "FFmpeg audio decoder is not available in the application package.");

        var startInfo = new ProcessStartInfo
        {
            FileName = executable,
            WorkingDirectory = Path.GetDirectoryName(executable)!,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        startInfo.ArgumentList.Add("-hide_banner");
        startInfo.ArgumentList.Add("-nostdin");
        startInfo.ArgumentList.Add("-loglevel");
        startInfo.ArgumentList.Add("error");
        startInfo.ArgumentList.Add("-i");
        startInfo.ArgumentList.Add(mediaPath);
        startInfo.ArgumentList.Add("-map");
        startInfo.ArgumentList.Add("0:a:0");
        startInfo.ArgumentList.Add("-vn");
        startInfo.ArgumentList.Add("-ac");
        startInfo.ArgumentList.Add("1");
        startInfo.ArgumentList.Add("-ar");
        startInfo.ArgumentList.Add("48000");
        startInfo.ArgumentList.Add("-f");
        startInfo.ArgumentList.Add("s16le");
        startInfo.ArgumentList.Add("pipe:1");

        var process = new Process { StartInfo = startInfo };
        try
        {
            if (!process.Start())
                throw new PlaybackException("VIDEO_AUDIO_DECODE_FAILED", "FFmpeg could not be started.");
            return new FfmpegAudioDecoder(process);
        }
        catch
        {
            process.Dispose();
            throw;
        }
    }

    public async Task EnsureSuccessfulAsync(CancellationToken cancellationToken)
    {
        await _process.WaitForExitAsync(cancellationToken);
        var error = await _errorOutput;
        if (_process.ExitCode != 0)
        {
            var detail = string.IsNullOrWhiteSpace(error) ? "No audio stream could be decoded." : error.Trim();
            if (detail.Length > 512) detail = detail[..512];
            throw new PlaybackException("VIDEO_AUDIO_DECODE_FAILED", $"Could not decode the video soundtrack: {detail}");
        }
    }

    public void Dispose()
    {
        _source.Dispose();
        if (!_process.HasExited)
        {
            try { _process.Kill(entireProcessTree: true); }
            catch (InvalidOperationException) { }
        }
        _process.Dispose();
    }
}
