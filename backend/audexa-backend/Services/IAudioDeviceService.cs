namespace audexa_backend.Services;

public interface IAudioDeviceService
{
    AudioDevicesResponse GetDevices();

    AudioDeviceDto? FindDevice(string deviceId);

    bool HasOutput(string deviceId, string outputId);

    bool IsDeviceAvailable(string deviceId);
}

public sealed record AudioDevicesResponse(
    bool Supported,
    IReadOnlyList<AudioDeviceDto> Devices,
    string? Error);

public sealed record AudioDeviceDto(
    string Id,
    string Name,
    string Type,
    string Driver,
    string Status,
    int OutputCount,
    int InputCount,
    IReadOnlyList<AudioChannelDto> Outputs,
    IReadOnlyList<AudioChannelDto> Inputs,
    int? SampleRate = null,
    int? BufferSize = null);

public sealed record AudioChannelDto(
    string Id,
    int Index,
    string Name,
    string Direction);
