using audexa_backend.DTOs.Diagnostics;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using System.Speech.Synthesis;

namespace audexa_backend.Services;

public sealed class AudioDiagnosticsService : IAudioDiagnosticsService
{
    private readonly IAudioDeviceService _audioDeviceService;
    private readonly ILogger<AudioDiagnosticsService> _logger;

    public AudioDiagnosticsService(
        IAudioDeviceService audioDeviceService,
        ILogger<AudioDiagnosticsService> logger)
    {
        _audioDeviceService = audioDeviceService;
        _logger = logger;
    }

    public async Task<AudioTestResponse> TestOutputAsync(
        AudioTestRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(request.DeviceId, request.OutputId, request.Mode, request.DurationMs, request.Volume);

        var device = _audioDeviceService.FindDevice(request.DeviceId)
            ?? throw new AudioDiagnosticException("DEVICE_NOT_FOUND", $"Audio device '{request.DeviceId}' was not found.");

        return await TestOutputOnDeviceAsync(
            device,
            request.OutputId,
            request.Mode,
            request.DurationMs,
            request.Volume,
            cancellationToken);
    }

    public async Task<IReadOnlyList<AudioTestResponse>> TestOutputsAsync(
        AudioTestOutputsRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.OutputIds is null || request.OutputIds.Count == 0)
        {
            return [];
        }

        if (string.IsNullOrWhiteSpace(request.DeviceId))
            throw new AudioDiagnosticException("DEVICE_REQUIRED", "DeviceId is required.");

        if (!request.Mode.Equals("voice", StringComparison.OrdinalIgnoreCase) &&
            !request.Mode.Equals("tone", StringComparison.OrdinalIgnoreCase))
            throw new AudioDiagnosticException("INVALID_MODE", "Mode must be 'voice' or 'tone'.");

        if (request.DurationMs is < 100 or > 5000)
            throw new AudioDiagnosticException("INVALID_DURATION", "Duration must be between 100 and 5000 ms.");

        if (!double.IsFinite(request.Volume) || request.Volume is < 0.01 or > 1.0)
            throw new AudioDiagnosticException("INVALID_VOLUME", "Volume must be between 0.01 and 1.0.");

        var device = _audioDeviceService.FindDevice(request.DeviceId)
            ?? throw new AudioDiagnosticException("DEVICE_NOT_FOUND", $"Audio device '{request.DeviceId}' was not found.");

        var results = new List<AudioTestResponse>(request.OutputIds.Count);
        var uniqueOutputIds = request.OutputIds
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        foreach (var outputId in uniqueOutputIds)
        {
            cancellationToken.ThrowIfCancellationRequested();
            results.Add(await TestOutputOnDeviceAsync(
                device,
                outputId,
                request.Mode,
                request.DurationMs,
                request.Volume,
                cancellationToken));
        }

        return results;
    }

    private async Task<AudioTestResponse> TestOutputOnDeviceAsync(
        AudioDeviceDto device,
        string outputId,
        string mode,
        int durationMs,
        double volume,
        CancellationToken cancellationToken)
    {
        var output = device.Outputs.FirstOrDefault(x => x.Id == outputId);
        if (output is null)
        {
            return new AudioTestResponse(
                false,
                outputId,
                $"Output '{outputId}' does not belong to device '{device.Name}'.");
        }

        if (!string.Equals(device.Status, "online", StringComparison.OrdinalIgnoreCase))
        {
            return new AudioTestResponse(false, outputId, $"Audio device '{device.Name}' is offline.");
        }

        _logger.LogInformation(
            "Audio output test started. Device={DeviceName} DeviceId={DeviceId} Type={DeviceType} Driver={Driver} OutputId={OutputId} OutputIndex={OutputIndex} Mode={Mode} DurationMs={DurationMs} Volume={Volume}",
            device.Name, device.Id, device.Type, device.Driver, outputId, output.Index, mode, durationMs, volume);

        try
        {
            var effectiveDurationMs = mode.Equals("voice", StringComparison.OrdinalIgnoreCase)
                ? Math.Max(durationMs, 1200)
                : durationMs;

            await PlayAsync(device, output.Index, mode, effectiveDurationMs, volume, cancellationToken);
            _logger.LogInformation(
                "Audio output test completed. DeviceId={DeviceId} OutputId={OutputId} OutputIndex={OutputIndex} Mode={Mode}",
                device.Id, outputId, output.Index, mode);
            return new AudioTestResponse(true, outputId, "Audio signal was sent to the selected output.");
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Audio output test failed. DeviceId={DeviceId} DeviceType={DeviceType} Driver={Driver} OutputId={OutputId} OutputIndex={OutputIndex} Mode={Mode}",
                device.Id, device.Type, device.Driver, outputId, output.Index, mode);
            return new AudioTestResponse(false, outputId, ex.Message);
        }
    }

    private async Task PlayAsync(
        AudioDeviceDto device,
        int outputIndex,
        string mode,
        int durationMs,
        double volume,
        CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new AudioDiagnosticException(
                "UNSUPPORTED_PLATFORM",
                "Audio diagnostics are supported on Windows only.");
        }

        if (device.Type.Equals("WASAPI", StringComparison.OrdinalIgnoreCase) &&
            device.Id.StartsWith("wasapi:render:", StringComparison.Ordinal))
        {
            await PlayWasapiAsync(device, outputIndex, mode, durationMs, volume, cancellationToken);
            return;
        }

        if (device.Type.Equals("ASIO", StringComparison.OrdinalIgnoreCase))
        {
            await PlayAsioAsync(device, outputIndex, mode, durationMs, volume, cancellationToken);
            return;
        }

        if (device.Type.Equals("WaveOut", StringComparison.OrdinalIgnoreCase))
        {
            await PlayWaveOutAsync(device, outputIndex, mode, durationMs, volume, cancellationToken);
            return;
        }

        throw new AudioDiagnosticException(
            "UNSUPPORTED_DEVICE_TYPE",
            $"Diagnostic playback is not implemented for device type '{device.Type}'.");
    }

    private async Task PlayWasapiAsync(
        AudioDeviceDto device,
        int outputIndex,
        string mode,
        int durationMs,
        double volume,
        CancellationToken cancellationToken)
    {
        var endpointId = device.Id["wasapi:render:".Length..];
        using var enumerator = new MMDeviceEnumerator();
        using var endpoint = enumerator.GetDevice(endpointId);
        // WASAPI Shared must be initialized with the endpoint's actual mix format.
        // UMC1820 exposes a 12-channel, 32-bit IEEE-float extensible mix format.
        var mixFormat = endpoint.AudioClient.MixFormat;
        if (outputIndex < 0 || outputIndex >= mixFormat.Channels)
        {
            throw new AudioDiagnosticException(
                "OUTPUT_CHANNEL_OUT_OF_RANGE",
                $"Requested output channel {outputIndex + 1} is outside the endpoint's {mixFormat.Channels} channels.");
        }

        var format = mixFormat;
        var provider = await CreateProviderAsync(mode, durationMs, volume, format, outputIndex, cancellationToken);

        using var output = new WasapiOut(endpoint, AudioClientShareMode.Shared, true, 100);

        var providerFormat = provider.WaveFormat;

        if (mixFormat is WaveFormatExtensible extensible)
        {
            _logger.LogInformation(
                "WASAPI SUBFORMAT: {SubFormat}",
                extensible.SubFormat);
        }

        _logger.LogInformation(
            "WASAPI MIX FORMAT: Encoding={Encoding}, SampleRate={SampleRate}, " +
            "Channels={Channels}, Bits={Bits}, BlockAlign={BlockAlign}, ExtraSize={ExtraSize}",
            mixFormat.Encoding,
            mixFormat.SampleRate,
            mixFormat.Channels,
            mixFormat.BitsPerSample,
            mixFormat.BlockAlign,
            mixFormat.ExtraSize);

        _logger.LogInformation(
            "WASAPI PROVIDER FORMAT: Encoding={Encoding}, SampleRate={SampleRate}, " +
            "Channels={Channels}, Bits={Bits}, BlockAlign={BlockAlign}, ExtraSize={ExtraSize}",
            providerFormat.Encoding,
            providerFormat.SampleRate,
            providerFormat.Channels,
            providerFormat.BitsPerSample,
            providerFormat.BlockAlign,
            providerFormat.ExtraSize);

        _logger.LogInformation(
            "WASAPI OUTPUT: Endpoint={Endpoint}, OutputIndex={OutputIndex}, " +
            "ShareMode={ShareMode}, Latency={Latency}",
            endpoint.FriendlyName,
            outputIndex,
            AudioClientShareMode.Shared,
            100);

        output.Init(provider);
        output.Play();

        await WaitForPlaybackAsync(output, durationMs, cancellationToken);
        output.Stop();
    }

    private static async Task PlayWaveOutAsync(
        AudioDeviceDto device,
        int outputIndex,
        string mode,
        int durationMs,
        double volume,
        CancellationToken cancellationToken)
    {
        if (!int.TryParse(device.Id["waveout:".Length..], out var deviceNumber))
        {
            throw new AudioDiagnosticException("INVALID_DEVICE_ID", $"Invalid WaveOut device id '{device.Id}'.");
        }

        var format = new WaveFormat(48000, 16, Math.Max(2, device.OutputCount));
        var provider = await CreateProviderAsync(mode, durationMs, volume, format, outputIndex, cancellationToken);

        using var output = new WaveOutEvent
        {
            DeviceNumber = deviceNumber,
            DesiredLatency = 100
        };
        output.Init(provider);
        output.Play();

        await WaitForPlaybackAsync(output, durationMs, cancellationToken);
        output.Stop();
    }

    private async Task PlayAsioAsync(
        AudioDeviceDto device,
        int outputIndex,
        string mode,
        int durationMs,
        double volume,
        CancellationToken cancellationToken)
    {
        var driverName = device.Driver;
        var stage = "open-driver";

        try
        {
            _logger.LogInformation(
                "Opening ASIO driver for output test. Driver={Driver} RequestedOutputIndex={OutputIndex} DeviceOutputCount={DeviceOutputCount}",
                driverName, outputIndex, device.OutputCount);

            using var output = new AsioOut(driverName);
            var driverOutputCount = output.DriverOutputChannelCount;

            _logger.LogInformation(
                "ASIO driver opened. Driver={Driver} DriverOutputChannels={DriverOutputChannels} DriverInputChannels={DriverInputChannels} RequestedOutputIndex={OutputIndex}",
                output.DriverName, driverOutputCount, output.DriverInputChannelCount, outputIndex);

            if (driverOutputCount <= 0)
                throw new AudioDiagnosticException("ASIO_NO_OUTPUTS", $"ASIO driver '{driverName}' reports no output channels.");

            if (outputIndex < 0 || outputIndex >= driverOutputCount)
                throw new AudioDiagnosticException(
                    "ASIO_OUTPUT_OUT_OF_RANGE",
                    $"Output index {outputIndex} is outside the ASIO driver's output range 0..{driverOutputCount - 1}.");

            stage = "validate-sample-rate";
            var sampleRate = output.IsSampleRateSupported(48000)
                ? 48000
                : output.IsSampleRateSupported(44100)
                    ? 44100
                    : 0;

            if (sampleRate == 0)
                throw new AudioDiagnosticException(
                    "ASIO_UNSUPPORTED_SAMPLE_RATE",
                    $"ASIO driver '{driverName}' supports neither 48000 Hz nor 44100 Hz.");

            // Test one physical output at a time. ChannelOffset routes the mono source
            // to the requested zero-based ASIO output without creating a full-width stream.
            stage = "create-provider";
            var format = WaveFormat.CreateIeeeFloatWaveFormat(sampleRate, 1);
            var provider = await CreateProviderAsync(mode, durationMs, volume, format, 0, cancellationToken);

            _logger.LogInformation(
                "ASIO test stream prepared. Driver={Driver} SampleRate={SampleRate} Channels={Channels} BitsPerSample={BitsPerSample} Encoding={Encoding} ChannelOffset={ChannelOffset}",
                driverName, sampleRate, format.Channels, format.BitsPerSample, format.Encoding, outputIndex);

            stage = "initialize-stream";
            output.ChannelOffset = outputIndex;
            output.Init(provider);

            _logger.LogInformation(
                "ASIO stream initialized. Driver={Driver} OutputWaveFormat={OutputWaveFormat} NumberOfOutputChannels={NumberOfOutputChannels} FramesPerBuffer={FramesPerBuffer}",
                driverName, output.OutputWaveFormat, output.NumberOfOutputChannels, output.FramesPerBuffer);

            stage = "start-playback";
            output.Play();

            stage = "wait-for-playback";
            await WaitForPlaybackAsync(output, durationMs, cancellationToken);

            stage = "stop-playback";
            output.Stop();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "ASIO output test failed at stage {Stage}. Driver={Driver} OutputIndex={OutputIndex} Mode={Mode}",
                stage, driverName, outputIndex, mode);
            throw;
        }
    }

    private static async Task<IWaveProvider> CreateProviderAsync(
        string mode,
        int durationMs,
        double volume,
        WaveFormat targetFormat,
        int outputIndex,
        CancellationToken cancellationToken)
    {
        if (mode.Equals("tone", StringComparison.OrdinalIgnoreCase))
        {
            return new RoutedToneWaveProvider(
                targetFormat,
                outputIndex,
                durationMs,
                Math.Clamp(volume, 0.01, 1.0));
        }

        if (!mode.Equals("voice", StringComparison.OrdinalIgnoreCase))
        {
            throw new AudioDiagnosticException("INVALID_MODE", $"Unsupported test mode '{mode}'.");
        }

        return await CreateVoiceProviderAsync(
            targetFormat,
            outputIndex,
            durationMs,
            Math.Clamp(volume, 0.01, 1.0),
            cancellationToken);
    }

    private static Task<IWaveProvider> CreateVoiceProviderAsync(
        WaveFormat targetFormat,
        int outputIndex,
        int durationMs,
        double volume,
        CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new AudioDiagnosticException("UNSUPPORTED_PLATFORM", "Voice diagnostics require Windows.");
        }

        var text = $"Выход {outputIndex + 1}";
        using var synthesizer = new SpeechSynthesizer();
        using var speechStream = new MemoryStream();

        synthesizer.SetOutputToWaveStream(speechStream);
        synthesizer.Speak(text);
        synthesizer.SetOutputToNull();
        speechStream.Position = 0;

        using var reader = new WaveFileReader(speechStream);
        using var resampler = new MediaFoundationResampler(
            reader,
            new WaveFormat(targetFormat.SampleRate, 16, 1));

        resampler.ResamplerQuality = 60;

        var duration = Math.Max(
            Math.Max(durationMs, 100),
            (int)Math.Ceiling(reader.TotalTime.TotalMilliseconds));

        var routed = new RoutedMonoWaveProvider(
            resampler,
            targetFormat,
            outputIndex,
            volume,
            duration);

        // Materialize the generated speech before disposing the source stream.
        // Use 64-bit arithmetic: a 12-channel Float32 endpoint can exceed Int32
        // during bytes-per-second * duration even when the final buffer is small.
        var bufferLength = ((long)targetFormat.AverageBytesPerSecond * Math.Max(1, duration) + 999L) / 1000L;
        if (bufferLength > Array.MaxLength)
        {
            throw new AudioDiagnosticException(
                "VOICE_TEST_BUFFER_TOO_LARGE",
                $"Voice test buffer is too large ({bufferLength} bytes). Reduce the test duration.");
        }

        var buffer = new byte[(int)bufferLength];
        using var output = new MemoryStream();
        var routedRead = 0;
        while (routedRead < buffer.Length)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var read = routed.Read(buffer, routedRead, buffer.Length - routedRead);
            if (read == 0)
                break;
            routedRead += read;
        }

        output.Write(buffer, 0, routedRead);
        output.Position = 0;

        return Task.FromResult<IWaveProvider>(
            new MemoryWaveProvider(output.ToArray(), targetFormat));
    }

    private static async Task WaitForPlaybackAsync(
        IWavePlayer output,
        int durationMs,
        CancellationToken cancellationToken)
    {
        var end = DateTime.UtcNow.AddMilliseconds(Math.Max(100, durationMs));

        while (DateTime.UtcNow < end)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await Task.Delay(25, cancellationToken);
        }
    }

    private static void ValidateRequest(
        string deviceId,
        string outputId,
        string mode,
        int durationMs,
        double volume)
    {
        if (string.IsNullOrWhiteSpace(deviceId))
            throw new AudioDiagnosticException("DEVICE_REQUIRED", "DeviceId is required.");

        if (string.IsNullOrWhiteSpace(outputId))
            throw new AudioDiagnosticException("OUTPUT_REQUIRED", "OutputId is required.");

        if (!mode.Equals("voice", StringComparison.OrdinalIgnoreCase) &&
            !mode.Equals("tone", StringComparison.OrdinalIgnoreCase))
            throw new AudioDiagnosticException("INVALID_MODE", "Mode must be 'voice' or 'tone'.");

        if (durationMs is < 100 or > 5000)
            throw new AudioDiagnosticException("INVALID_DURATION", "Duration must be between 100 and 5000 ms.");

        if (!double.IsFinite(volume) || volume is < 0.01 or > 1.0)
            throw new AudioDiagnosticException("INVALID_VOLUME", "Volume must be between 0.01 and 1.0.");
    }

    private sealed class MemoryWaveProvider : IWaveProvider
    {
        private readonly byte[] _buffer;
        private int _position;

        public MemoryWaveProvider(byte[] buffer, WaveFormat waveFormat)
        {
            _buffer = buffer;
            WaveFormat = waveFormat;
        }

        public WaveFormat WaveFormat { get; }

        public int Read(byte[] buffer, int offset, int count)
        {
            var remaining = _buffer.Length - _position;
            var toCopy = Math.Min(remaining, count);
            if (toCopy <= 0)
                return 0;

            Buffer.BlockCopy(_buffer, _position, buffer, offset, toCopy);
            _position += toCopy;
            return toCopy;
        }
    }

    private sealed class RoutedToneWaveProvider : IWaveProvider
    {
        private readonly WaveFormat _format;
        private readonly int _targetChannel;
        private readonly int _totalSamples;
        private readonly float _amplitude;
        private int _samplePosition;

        public RoutedToneWaveProvider(
            WaveFormat format,
            int targetChannel,
            int durationMs,
            double volume)
        {
            if (!AudioSampleFormat.IsSupported(format))
                throw new AudioDiagnosticException(
                    "UNSUPPORTED_FORMAT",
                    $"Diagnostic tone does not support the endpoint format {format}.");

            if (targetChannel < 0 || targetChannel >= format.Channels)
                throw new AudioDiagnosticException("INVALID_OUTPUT_CHANNEL", $"Target channel {targetChannel} is outside the stream channel range 0..{format.Channels - 1}.");

            _format = format;
            _targetChannel = targetChannel;
            _totalSamples = Math.Max(1, format.SampleRate * durationMs / 1000);
            _amplitude = (float)Math.Clamp(volume, 0.01, 1.0) * 0.15f;
        }

        public WaveFormat WaveFormat => _format;

        public int Read(byte[] buffer, int offset, int count)
        {
            var bytesPerFrame = _format.BlockAlign;
            var framesRequested = count / bytesPerFrame;
            var framesAvailable = _totalSamples - _samplePosition;
            var frames = Math.Min(framesRequested, framesAvailable);

            if (frames <= 0)
                return 0;

            var bytesWritten = frames * bytesPerFrame;
            Array.Clear(buffer, offset, bytesWritten);

            for (var frame = 0; frame < frames; frame++)
            {
                var t = (_samplePosition + frame) / (double)_format.SampleRate;
                var value = Math.Sin(2 * Math.PI * 440 * t) * _amplitude;
                var sampleOffset = offset + frame * bytesPerFrame + _targetChannel * (_format.BitsPerSample / 8);

                AudioSampleFormat.WriteSample(
                    buffer.AsSpan(sampleOffset, AudioSampleFormat.BytesPerSample(_format)),
                    _format,
                    (float)value);
            }

            _samplePosition += frames;
            return bytesWritten;
        }
    }

    private sealed class RoutedMonoWaveProvider : IWaveProvider
    {
        private readonly IWaveProvider _source;
        private readonly WaveFormat _targetFormat;
        private readonly int _targetChannel;
        private readonly float _volume;
        private readonly int _maxFrames;
        private int _framesRead;
        private readonly byte[] _sourceBuffer = new byte[4096];

        public RoutedMonoWaveProvider(
            IWaveProvider source,
            WaveFormat targetFormat,
            int targetChannel,
            double volume,
            int durationMs)
        {
            if (!AudioSampleFormat.IsSupported(targetFormat))
                throw new AudioDiagnosticException(
                    "UNSUPPORTED_FORMAT",
                    $"Diagnostic voice does not support the endpoint format {targetFormat}.");

            if (targetChannel < 0 || targetChannel >= targetFormat.Channels)
                throw new AudioDiagnosticException("INVALID_OUTPUT_CHANNEL", $"Target channel {targetChannel} is outside the stream channel range 0..{targetFormat.Channels - 1}.");

            _source = source;
            _targetFormat = targetFormat;
            _targetChannel = targetChannel;
            _volume = (float)Math.Clamp(volume, 0.01, 1.0);
            _maxFrames = Math.Max(1, targetFormat.SampleRate * durationMs / 1000);
        }

        public WaveFormat WaveFormat => _targetFormat;

        public int Read(byte[] buffer, int offset, int count)
        {
            var bytesPerFrame = _targetFormat.BlockAlign;
            var requestedFrames = count / bytesPerFrame;
            var frames = Math.Min(requestedFrames, _maxFrames - _framesRead);
            if (frames <= 0)
                return 0;

            var sourceBytesNeeded = frames * 2;
            var source = new byte[sourceBytesNeeded];
            var sourceRead = 0;

            while (sourceRead < sourceBytesNeeded)
            {
                var chunk = Math.Min(_sourceBuffer.Length, sourceBytesNeeded - sourceRead);
                var read = _source.Read(_sourceBuffer, 0, chunk);
                if (read <= 0)
                    break;
                Buffer.BlockCopy(_sourceBuffer, 0, source, sourceRead, read);
                sourceRead += read;
            }

            var bytesWritten = frames * bytesPerFrame;
            Array.Clear(buffer, offset, bytesWritten);

            for (var frame = 0; frame < frames; frame++)
            {
                var sourceSample = frame * 2 < sourceRead
                    ? BitConverter.ToInt16(source, frame * 2) / 32768f
                    : 0f;
                var value = sourceSample * _volume;
                var sampleOffset = offset + frame * bytesPerFrame + _targetChannel * (_targetFormat.BitsPerSample / 8);

                AudioSampleFormat.WriteSample(
                    buffer.AsSpan(sampleOffset, AudioSampleFormat.BytesPerSample(_targetFormat)),
                    _targetFormat,
                    value);
            }

            _framesRead += frames;
            return bytesWritten;
        }
    }
}

public sealed class AudioDiagnosticException : Exception
{
    public AudioDiagnosticException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}
