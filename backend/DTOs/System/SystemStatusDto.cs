namespace audexa_backend.DTOs.System;

public sealed record SystemStatusDto(
    string State,
    string Backend,
    string? Device,
    string? DeviceId,
    bool Online,
    int Outputs,
    int AvailableOutputs,
    int MappedOutputs,
    int Mappings,
    int? SampleRate,
    int? BufferSize,
    string Engine,
    string? Error,
    DateTime LastUpdated);
