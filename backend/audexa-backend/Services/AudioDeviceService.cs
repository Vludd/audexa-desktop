using NAudio.CoreAudioApi;
using NAudio.Wave;
using System.Runtime.InteropServices;
using System.Reflection;

namespace audexa_backend.Services;

public sealed class AudioDeviceService : IAudioDeviceService
{
    public AudioDevicesResponse GetDevices()
    {
        if (!OperatingSystem.IsWindows())
        {
            return new AudioDevicesResponse(
                Supported: false,
                Devices: [],
                Error: "Audio device enumeration is supported on Windows only.");
        }

        var devices = new List<AudioDeviceDto>();
        string? enumerationError = null;
        var wasapiRenderFound = false;

        try
        {
            using var enumerator = new MMDeviceEnumerator();

            foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.All))
            {
                if (device.State != DeviceState.Active)
                    continue;

                try
                {
                    var audioInfo = GetWasapiAudioInfo(device);
                    var outputCount = GetChannelCount(device);
                    var outputs = CreateGenericChannels(device.ID, outputCount, "output", "OUT");

                    devices.Add(new AudioDeviceDto(
                        $"wasapi:render:{device.ID}",
                        device.FriendlyName,
                        "WASAPI",
                        "Windows Audio",
                        "online",
                        outputCount,
                        0,
                        outputs,
                        [],
                        audioInfo.SampleRate,
                        audioInfo.BufferSize));

                    wasapiRenderFound = true;
                }
                catch (Exception ex)
                {
                    enumerationError ??= $"WASAPI device '{device.ID}' could not be read: {ex.Message}";
                }
            }
        }
        catch (Exception ex)
        {
            enumerationError ??= $"WASAPI render enumeration failed: {ex.Message}";
        }

        if (!wasapiRenderFound)
        {
            try
            {
                var deviceCount = WaveInterop.waveOutGetNumDevs();
                for (var index = 0; index < deviceCount; index++)
                {
                    var result = WaveInterop.waveOutGetDevCaps(
                        new IntPtr(index),
                        out var capabilities,
                        Marshal.SizeOf<WaveOutCapabilities>());

                    if (result != NAudio.MmResult.NoError)
                    {
                        throw new InvalidOperationException(
                            $"Could not read WinMM device {index}: {result}.");
                    }

                    var outputCount = Math.Max(1, capabilities.Channels);
                    var deviceId = $"waveout:{index}";

                    devices.Add(new AudioDeviceDto(
                        deviceId,
                        capabilities.ProductName,
                        "WaveOut",
                        "Windows Multimedia",
                        "online",
                        outputCount,
                        0,
                        CreateGenericChannels(deviceId, outputCount, "output", "OUT"),
                        [],
                        null,
                        null));
                }
            }
            catch (Exception ex)
            {
                enumerationError ??= $"WinMM fallback enumeration failed: {ex.Message}";
            }
        }

        try
        {
            using var enumerator = new MMDeviceEnumerator();

            foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.All))
            {
                if (device.State != DeviceState.Active)
                    continue;

                try
                {
                    var inputCount = GetChannelCount(device);
                    var inputs = CreateGenericChannels(device.ID, inputCount, "input", "IN");

                    devices.Add(new AudioDeviceDto(
                        $"wasapi:capture:{device.ID}",
                        device.FriendlyName,
                        "WASAPI",
                        "Windows Audio",
                        "online",
                        0,
                        inputCount,
                        [],
                        inputs,
                        null,
                        null));
                }
                catch (Exception ex)
                {
                    enumerationError ??= $"WASAPI capture device '{device.ID}' could not be read: {ex.Message}";
                }
            }
        }
        catch (Exception ex)
        {
            enumerationError ??= $"WASAPI capture enumeration failed: {ex.Message}";
        }

        try
        {
            foreach (var driverName in AsioOut.GetDriverNames())
            {
                try
                {
                    using var asio = new AsioOut(driverName);
                    var audioInfo = GetAsioAudioInfo(asio);

                    var outputs = Enumerable
                        .Range(0, asio.DriverOutputChannelCount)
                        .Select(index => new AudioChannelDto(
                            $"{driverName}:out:{index}",
                            index,
                            SafeGetOutputChannelName(asio, index),
                            "output"))
                        .ToArray();

                    var inputs = Enumerable
                        .Range(0, asio.DriverInputChannelCount)
                        .Select(index => new AudioChannelDto(
                            $"{driverName}:in:{index}",
                            index,
                            SafeGetInputChannelName(asio, index),
                            "input"))
                        .ToArray();

                    devices.Add(new AudioDeviceDto(
                        $"asio:{driverName}",
                        driverName,
                        "ASIO",
                        driverName,
                        "online",
                        outputs.Length,
                        inputs.Length,
                        outputs,
                        inputs,
                        audioInfo.SampleRate,
                        audioInfo.BufferSize));
                }
                catch (Exception ex)
                {
                    devices.Add(new AudioDeviceDto(
                        $"asio:{driverName}",
                        driverName,
                        "ASIO",
                        driverName,
                        "offline",
                        0,
                        0,
                        [],
                        [],
                        null,
                        null));

                    enumerationError ??= ex.Message;
                }
            }
        }
        catch (Exception ex)
        {
            enumerationError ??= ex.Message;
        }

        return new AudioDevicesResponse(true, devices, enumerationError);
    }

    public AudioDeviceDto? FindDevice(string deviceId)
    {
        return GetDevices().Devices.FirstOrDefault(device => device.Id == deviceId);
    }

    public bool HasOutput(string deviceId, string outputId)
    {
        var device = FindDevice(deviceId);
        return device?.Outputs.Any(output => output.Id == outputId) == true;
    }

    public bool IsDeviceAvailable(string deviceId)
    {
        if (!OperatingSystem.IsWindows()) return false;

        // Check membership in the current ACTIVE render endpoint collection.
        // GetDevice(id).State can report a stale MMDevice as Active after the
        // endpoint has disappeared from the active collection. The dashboard's
        // device status is based on enumeration, so playback must use the same
        // source of truth to avoid a permanent Playing state after unplugging.
        if (deviceId.StartsWith("wasapi:render:", StringComparison.Ordinal))
        {
            var endpointId = deviceId["wasapi:render:".Length..];
            try
            {
                using var enumerator = new MMDeviceEnumerator();
                var activeEndpoints = enumerator.EnumerateAudioEndPoints(
                    DataFlow.Render,
                    DeviceState.Active);

                foreach (var endpoint in activeEndpoints)
                {
                    using (endpoint)
                    {
                        if (string.Equals(endpoint.ID, endpointId, StringComparison.OrdinalIgnoreCase))
                            return true;
                    }
                }

                return false;
            }
            catch
            {
                // Fail closed: enumeration failure must never be interpreted as
                // confirmation that an output is available.
                return false;
            }
        }

        if (deviceId.StartsWith("waveout:", StringComparison.Ordinal))
        {
            if (!int.TryParse(deviceId["waveout:".Length..], out var deviceNumber)) return false;
            return deviceNumber >= 0 && deviceNumber < WaveInterop.waveOutGetNumDevs();
        }

        // ASIO drivers do not expose a consistent lightweight availability API.
        // PlaybackStopped exceptions remain the primary signal for ASIO failures.
        return deviceId.StartsWith("asio:", StringComparison.Ordinal);
    }

    private static (int? SampleRate, int? BufferSize) GetWasapiAudioInfo(MMDevice device)
    {
        try
        {
            var audioClient = device.AudioClient;
            var sampleRate = audioClient.MixFormat.SampleRate;
            var defaultPeriod = audioClient.DefaultDevicePeriod;
            var bufferSize = sampleRate > 0 && defaultPeriod > 0
                ? (int)Math.Round(sampleRate * (double)defaultPeriod / 10_000_000d)
                : (int?)null;

            return (sampleRate > 0 ? sampleRate : null, bufferSize);
        }
        catch
        {
            return (null, null);
        }
    }

    private static (int? SampleRate, int? BufferSize) GetAsioAudioInfo(AsioOut asio)
    {
        // NAudio 2.x's AsioOut facade does not expose these capabilities publicly.
        // Read them from its underlying ASIO driver when available; keep null if
        // a driver does not expose the expected API rather than inventing values.
        try
        {
            var driverField = typeof(AsioOut)
                .GetFields(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)
                .FirstOrDefault(field => field.FieldType.Name.Contains("ASIODriver", StringComparison.OrdinalIgnoreCase));

            var driver = driverField?.GetValue(asio);
            if (driver is null)
                return (null, null);

            int? sampleRate = null;
            int? bufferSize = null;
            var driverType = driver.GetType();

            var sampleRateMethod = driverType.GetMethod(
                "getSampleRate",
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                binder: null,
                types: Type.EmptyTypes,
                modifiers: null);

            var sampleRateValue = sampleRateMethod?.Invoke(driver, null);
            if (sampleRateValue is double rate && rate > 0)
                sampleRate = (int)Math.Round(rate);
            else if (sampleRateValue is float floatRate && floatRate > 0)
                sampleRate = (int)Math.Round(floatRate);
            else if (sampleRateValue is int integerRate && integerRate > 0)
                sampleRate = integerRate;

            var bufferMethod = driverType.GetMethod(
                "getBufferSize",
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);

            if (bufferMethod is not null)
            {
                var args = new object?[] { 0, 0, 0, 0 };
                bufferMethod.Invoke(driver, args);
                if (args[2] is int preferredBuffer && preferredBuffer > 0)
                    bufferSize = preferredBuffer;
            }

            return (sampleRate, bufferSize);
        }
        catch
        {
            return (null, null);
        }
    }

    private static int GetChannelCount(MMDevice device)
    {
        try
        {
            return Math.Max(1, device.AudioClient.MixFormat.Channels);
        }
        catch
        {
            return 2;
        }
    }

    private static AudioChannelDto[] CreateGenericChannels(
        string deviceId,
        int count,
        string direction,
        string prefix)
    {
        return Enumerable.Range(0, count)
            .Select(index => new AudioChannelDto(
                $"{deviceId}:{direction}:{index}",
                index,
                $"{prefix} {index + 1:00}",
                direction))
            .ToArray();
    }

    private static string SafeGetOutputChannelName(AsioOut asio, int index)
    {
        try
        {
            var name = asio.AsioOutputChannelName(index);
            return string.IsNullOrWhiteSpace(name) ? $"OUT {index + 1:00}" : name;
        }
        catch
        {
            return $"OUT {index + 1:00}";
        }
    }

    private static string SafeGetInputChannelName(AsioOut asio, int index)
    {
        try
        {
            var name = asio.AsioInputChannelName(index);
            return string.IsNullOrWhiteSpace(name) ? $"IN {index + 1:00}" : name;
        }
        catch
        {
            return $"IN {index + 1:00}";
        }
    }
}
