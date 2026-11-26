using System.Security.Cryptography;
using System.Text;
using audexa_backend.Data;
using audexa_backend.DTOs;
using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace audexa_backend.Services;

public sealed class MediaHostPairingService(AppDbContext db)
{
    private static readonly char[] CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".ToCharArray();

    public async Task<MediaHostPairingCreatedDto> CreateAsync(
        CreateMediaHostPairingDto request,
        CancellationToken ct)
    {
        var name = Required(request.HostName, 200, nameof(request.HostName));
        var description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();

        if (description?.Length > 1000)
            throw new ArgumentException("Description cannot exceed 1000 characters.");

        // 60 bits of entropy; the code is short-lived and the pair endpoint is rate-limited.
        var code = GenerateCode();
        var now = DateTime.UtcNow;
        var pairing = new MediaHostPairing
        {
            Id = Guid.NewGuid(),
            CodeHash = Hash(NormalizeCode(code)),
            HostName = name,
            Description = description,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddMinutes(5)
        };

        db.MediaHostPairings.Add(pairing);
        await db.SaveChangesAsync(ct);

        return new MediaHostPairingCreatedDto(pairing.Id, code, pairing.ExpiresAtUtc);
    }

    public async Task<IReadOnlyList<MediaHostPairingDto>> GetAllAsync(CancellationToken ct)
    {
        var rows = await db.MediaHostPairings.AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(50)
            .ToListAsync(ct);

        return rows.Select(x => new MediaHostPairingDto(
            x.Id, x.HostName, x.Description,
            DateTime.SpecifyKind(x.CreatedAtUtc, DateTimeKind.Utc),
            DateTime.SpecifyKind(x.ExpiresAtUtc, DateTimeKind.Utc),
            x.UsedAtUtc is null ? null : DateTime.SpecifyKind(x.UsedAtUtc.Value, DateTimeKind.Utc),
            x.RevokedAtUtc is null ? null : DateTime.SpecifyKind(x.RevokedAtUtc.Value, DateTimeKind.Utc)))
            .ToArray();
    }

    public async Task RevokePairingAsync(Guid id, CancellationToken ct)
    {
        var row = await db.MediaHostPairings.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (row is null)
            throw new KeyNotFoundException("Pairing invitation was not found.");

        if (row.UsedAtUtc is null)
        {
            row.RevokedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task<MediaHostPairResponse> PairAsync(
        MediaHostPairRequest request,
        string backendUrl,
        CancellationToken ct)
    {
        var code = NormalizeCode(request.PairingCode);
        if (code.Length != 12 || code.Any(c => !CodeAlphabet.Contains(c)))
            throw new InvalidPairingCodeException();

        var machineName = Required(request.MachineName, 200, nameof(request.MachineName));
        var agentVersion = Required(request.AgentVersion, 64, nameof(request.AgentVersion));
        var codeHash = Hash(code);
        var now = DateTime.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var pairing = await db.MediaHostPairings
            .SingleOrDefaultAsync(x => x.CodeHash == codeHash, ct);

        if (pairing is null ||
            pairing.UsedAtUtc is not null ||
            pairing.RevokedAtUtc is not null ||
            pairing.ExpiresAtUtc <= now)
        {
            throw new InvalidPairingCodeException();
        }

        // Conditional update makes consumption one-time even when two agents race.
        var consumed = await db.MediaHostPairings
            .Where(x => x.Id == pairing.Id &&
                        x.UsedAtUtc == null &&
                        x.RevokedAtUtc == null &&
                        x.ExpiresAtUtc > now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.UsedAtUtc, now), ct);

        if (consumed != 1)
            throw new InvalidPairingCodeException();

        var hostId = Guid.NewGuid();
        var secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var host = new MediaHost
        {
            Id = hostId,
            Name = pairing.HostName,
            MachineName = machineName,
            AgentVersion = agentVersion,
            Status = "Offline",
            CreatedAtUtc = now,
            LastSeenAtUtc = now
        };

        db.MediaHosts.Add(host);
        db.MediaHostCredentials.Add(new MediaHostCredential
        {
            Id = Guid.NewGuid(),
            MediaHostId = hostId,
            SecretHash = Hash(secret),
            CreatedAtUtc = now
        });

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new MediaHostPairResponse(hostId, secret, backendUrl.TrimEnd('/'), "/hubs/media-hosts");
    }

    public async Task<bool> ValidateCredentialAsync(Guid hostId, string? suppliedSecret, CancellationToken ct)
    {
        if (hostId == Guid.Empty || string.IsNullOrWhiteSpace(suppliedSecret))
            return false;

        var suppliedHash = Hash(suppliedSecret);
        var credential = await db.MediaHostCredentials
            .Include(x => x.MediaHost)
            .Where(x => x.MediaHostId == hostId && x.RevokedAtUtc == null)
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (credential is null || credential.MediaHost.Status == "Disabled")
            return false;

        var expectedBytes = Convert.FromHexString(credential.SecretHash);
        var suppliedBytes = Convert.FromHexString(suppliedHash);
        if (!CryptographicOperations.FixedTimeEquals(expectedBytes, suppliedBytes))
            return false;

        credential.LastUsedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<IReadOnlyList<Guid>> DeleteUnpairedHostsAsync(CancellationToken ct)
    {
        // Legacy hosts created before one-time pairing have no credential records.
        // Keep every host that has ever received a credential, including disabled hosts.
        var hosts = await db.MediaHosts
            .Include(x => x.Displays)
            .Include(x => x.Credentials)
            .Where(x => !x.Credentials.Any() &&
                        !db.ScenarioSteps.Any(step => step.MediaHostId == x.Id))
            .ToListAsync(ct);

        if (hosts.Count == 0)
            return Array.Empty<Guid>();

        var ids = hosts.Select(x => x.Id).ToArray();
        db.MediaHosts.RemoveRange(hosts);
        await db.SaveChangesAsync(ct);
        return ids;
    }

    public async Task<bool> DeleteRevokedHostAsync(Guid hostId, CancellationToken ct)
    {
        var host = await db.MediaHosts
            .Include(x => x.Credentials)
            .SingleOrDefaultAsync(x => x.Id == hostId, ct);

        if (host is null)
            return false;

        // Never delete an agent that still has an active credential.
        if (host.Credentials.Any(x => x.RevokedAtUtc is null))
            throw new InvalidOperationException(
                "The Media Host must be unpaired before it can be removed.");

        // ScenarioSteps intentionally use Restrict for MediaHostId: deleting a host
        // must not silently delete or corrupt scenario steps that target its displays.
        // Check this explicitly so the API can return an actionable 409 instead of
        // leaking a SQLite foreign-key exception as HTTP 500.
        var scenarioUsages = await db.ScenarioSteps
            .AsNoTracking()
            .Where(x => x.MediaHostId == hostId)
            .Select(x => new
            {
                x.ScenarioId,
                ScenarioName = x.Scenario.Name,
                x.Order
            })
            .OrderBy(x => x.ScenarioName)
            .ThenBy(x => x.Order)
            .ToListAsync(ct);

        if (scenarioUsages.Count > 0)
        {
            var scenarioDetails = scenarioUsages
                .GroupBy(x => new { x.ScenarioId, x.ScenarioName })
                .Select(group => $"'{group.Key.ScenarioName}' ({group.Count()} step(s))");

            throw new InvalidOperationException(
                $"Cannot delete Media Host '{host.Name}' because it is referenced by scenario(s): " +
                $"{string.Join(", ", scenarioDetails)}. Reassign or remove the Media Host from those scenario steps first.");
        }

        db.MediaHosts.Remove(host);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task RevokeHostAsync(Guid hostId, CancellationToken ct)
    {
        var host = await db.MediaHosts
            .Include(x => x.Credentials)
            .SingleOrDefaultAsync(x => x.Id == hostId, ct);

        if (host is null)
            throw new KeyNotFoundException("Media Host was not found.");

        var now = DateTime.UtcNow;
        host.Status = "Disabled";
        foreach (var credential in host.Credentials.Where(x => x.RevokedAtUtc == null))
            credential.RevokedAtUtc = now;

        await db.SaveChangesAsync(ct);
    }

    private static string GenerateCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(12);
        // 12 symbols from an ambiguity-free alphabet, 60 effective bits.
        var chars = new char[12];
        for (var i = 0; i < chars.Length; i++)
            chars[i] = CodeAlphabet[bytes[i % bytes.Length] & 31];
        return new string(chars, 0, 6) + "-" + new string(chars, 6, 6);
    }

    private static string NormalizeCode(string? code) =>
        (code ?? string.Empty).Replace("-", string.Empty, StringComparison.Ordinal)
            .Replace(" ", string.Empty, StringComparison.Ordinal)
            .Trim().ToUpperInvariant();

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static string Required(string? value, int maxLength, string field)
    {
        var normalized = value?.Trim();
        if (string.IsNullOrWhiteSpace(normalized) || normalized.Length > maxLength)
            throw new ArgumentException($"{field} is required and must be at most {maxLength} characters.");
        return normalized;
    }
}

public sealed class InvalidPairingCodeException : Exception
{
    public InvalidPairingCodeException() : base("The pairing code is invalid, expired, revoked, or already used.") { }
}
