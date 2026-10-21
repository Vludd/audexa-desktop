using audexa_backend.Data;
using audexa_backend.DTOs.Settings;
using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace audexa_backend.Services;

public sealed class AudioSettingsService : IAudioSettingsService
{
    private static readonly Guid ConfigurationId =
        Guid.Parse("6d7c1f5b-6c83-4e0d-8a4a-5b7c5f4b7f01");

    private readonly AppDbContext _db;
    private readonly IAudioDeviceService _audioDeviceService;

    public AudioSettingsService(AppDbContext db, IAudioDeviceService audioDeviceService)
    {
        _db = db;
        _audioDeviceService = audioDeviceService;
    }

    public async Task<AudioSettingsDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var configuration = await _db.AudioConfigurations
            .AsNoTracking()
            .Include(x => x.Mappings)
            .SingleOrDefaultAsync(x => x.Id == ConfigurationId, cancellationToken);

        if (configuration is null)
        {
            return new AudioSettingsDto(1, null, [], null);
        }

        return ToDto(configuration);
    }

    public async Task<AudioSettingsDto> SaveAsync(
        UpdateAudioSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(request);

        var requestedMappings = request.Mappings ?? [];
        var mappings = requestedMappings
            .Where(x => x.OutputId is not null)
            .GroupBy(x => new { x.RoomId, x.OutputId })
            .Select(x => x.First())
            .ToList();

        var outputIds = mappings
            .Select(x => x.OutputId!)
            .ToList();

        // Load the persisted configuration before validating the request.
        // A configured device may legitimately be disconnected; persistence
        // must not depend on the device being physically present right now.
        var persistedConfiguration = await _db.AudioConfigurations
            .AsNoTracking()
            .Include(x => x.Mappings)
            .SingleOrDefaultAsync(x => x.Id == ConfigurationId, cancellationToken);

        var duplicateOutput = outputIds
            .GroupBy(x => x, StringComparer.Ordinal)
            .FirstOrDefault(group => group.Count() > 1);

        if (duplicateOutput is not null)
        {
            throw new AudioSettingsValidationException(
                "OUTPUT_ALREADY_ASSIGNED",
                $"Output '{duplicateOutput.Key}' is assigned to more than one room.");
        }

        var mappingsToPersist = mappings;
        var translationOutputToPersist = request.TranslationOutputId;

        if (request.DeviceId is not null)
        {
            var deviceForPersistenceCheck = _audioDeviceService.FindDevice(request.DeviceId);
            var isUnavailable = deviceForPersistenceCheck is null ||
                                !string.Equals(deviceForPersistenceCheck.Status, "online", StringComparison.OrdinalIgnoreCase);
            var isSameConfiguredDevice = string.Equals(
                persistedConfiguration?.DeviceId,
                request.DeviceId,
                StringComparison.Ordinal);

            if (isUnavailable && isSameConfiguredDevice && persistedConfiguration is not null)
            {
                // Keep the last known mapping while the hardware is disconnected.
                // Mapping changes require the device to be available so that output
                // ids can be validated against the actual interface.
                mappingsToPersist = persistedConfiguration.Mappings
                    .Select(x => new AudioOutputMappingDto(x.RoomId, x.OutputId))
                    .ToList();
                translationOutputToPersist = persistedConfiguration.TranslationOutputId;
            }
        }

        if (request.DeviceId is null)
        {
            if (outputIds.Count > 0 || request.TranslationOutputId is not null)
            {
                throw new AudioSettingsValidationException(
                    "DEVICE_REQUIRED",
                    "An audio device must be selected before assigning outputs.");
            }
        }
        else
        {
            var device = _audioDeviceService.FindDevice(request.DeviceId);

            if (device is null || !string.Equals(device.Status, "online", StringComparison.OrdinalIgnoreCase))
            {
                // The device can be saved while disconnected. If this is an
                // already configured device, keep its persisted mappings intact.
                // For a new/unseen device we cannot safely validate output ids,
                // so require an empty mapping until the device is available.
                var isSameConfiguredDevice = string.Equals(
                    persistedConfiguration?.DeviceId,
                    request.DeviceId,
                    StringComparison.Ordinal);

                if (!isSameConfiguredDevice && (outputIds.Count > 0 || request.TranslationOutputId is not null))
                {
                    throw new AudioSettingsValidationException(
                        "DEVICE_UNAVAILABLE",
                        $"Audio device '{request.DeviceId}' is not currently available. Connect it before assigning outputs.");
                }
            }
            else
            {
                foreach (var outputId in outputIds)
                {
                    if (!device.Outputs.Any(output => string.Equals(output.Id, outputId, StringComparison.Ordinal)))
                    {
                        throw new AudioSettingsValidationException(
                            "OUTPUT_NOT_FOUND",
                            $"Output '{outputId}' does not belong to the selected audio device.");
                    }
                }

                if (request.TranslationOutputId is not null &&
                    !device.Outputs.Any(output => string.Equals(output.Id, request.TranslationOutputId, StringComparison.Ordinal)))
                {
                    throw new AudioSettingsValidationException(
                        "TRANSLATION_OUTPUT_NOT_FOUND",
                        $"Translation output '{request.TranslationOutputId}' does not belong to the selected audio device.");
                }
            }
        }

        if (request.TranslationOutputId is not null &&
            outputIds.Contains(request.TranslationOutputId, StringComparer.Ordinal))
        {
            throw new AudioSettingsValidationException(
                "OUTPUT_ALREADY_ASSIGNED",
                "Translation output cannot be assigned to a room at the same time.");
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        var configuration = await _db.AudioConfigurations
            .Include(x => x.Mappings)
            .SingleOrDefaultAsync(
                x => x.Id == ConfigurationId,
                cancellationToken);

        if (configuration is null)
        {
            configuration = new AudioConfiguration
            {
                Id = ConfigurationId,
                Version = 1,
            };

            _db.AudioConfigurations.Add(configuration);
        }

        configuration.Version = 1;
        configuration.DeviceId = request.DeviceId;
        configuration.TranslationOutputId = translationOutputToPersist;
        configuration.UpdatedAt = DateTime.UtcNow;

        // Remove old mappings first.
        // This avoids transient UNIQUE constraint violations when
        // an existing room/output assignment is changed.
        var existingMappings = configuration.Mappings.ToList();

        if (existingMappings.Count > 0)
        {
            _db.OutputMappings.RemoveRange(existingMappings);
            await _db.SaveChangesAsync(cancellationToken);
        }

        foreach (var mapping in mappingsToPersist.Where(x => x.OutputId is not null))
        {
            _db.OutputMappings.Add(new OutputMapping
            {
                Id = Guid.NewGuid(),
                AudioConfigurationId = ConfigurationId,
                RoomId = mapping.RoomId,
                OutputId = mapping.OutputId!,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        // Return the actual persisted state from SQLite.
        return await GetAsync(cancellationToken);
    }

    private static void ValidateRequest(UpdateAudioSettingsRequest request)
    {
        if (request.Version != 1)
        {
            throw new AudioSettingsValidationException(
                "UNSUPPORTED_VERSION",
                $"Audio settings version '{request.Version}' is not supported.");
        }

        var mappings = request.Mappings ?? [];

        if (mappings.Any(x => x.RoomId == Guid.Empty))
        {
            throw new AudioSettingsValidationException(
                "INVALID_ROOM_ID",
                "RoomId must be a valid UUID.");
        }

        if (mappings.Any(x => x.OutputId is not null && string.IsNullOrWhiteSpace(x.OutputId)))
        {
            throw new AudioSettingsValidationException(
                "INVALID_OUTPUT_ID",
                "OutputId cannot be empty.");
        }
    }

    private static AudioSettingsDto ToDto(AudioConfiguration configuration)
    {
        return new AudioSettingsDto(
            configuration.Version,
            configuration.DeviceId,
            configuration.Mappings
                .OrderBy(x => x.RoomId)
                .ThenBy(x => x.OutputId)
                .Select(x => new AudioOutputMappingDto(x.RoomId, x.OutputId))
                .ToList(),
            configuration.TranslationOutputId);
    }
}

public sealed class AudioSettingsValidationException : Exception
{
    public AudioSettingsValidationException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}
