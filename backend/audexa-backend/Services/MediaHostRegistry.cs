using audexa_backend.Data;
using audexa_backend.DTOs;
using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace audexa_backend.Services;

public sealed class MediaHostRegistry(AppDbContext db)
{
    public async Task<MediaHost> RegisterAsync(MediaHostRegistrationDto request, string? ipAddress, CancellationToken ct)
    {
        if (request.HostId == Guid.Empty) throw new ArgumentException("HostId must be a non-empty UUID.");
        var host = await db.MediaHosts.Include(x => x.Displays).SingleOrDefaultAsync(x => x.Id == request.HostId, ct);
        if (host is null)
        {
            host = new MediaHost { Id = request.HostId, CreatedAtUtc = DateTime.UtcNow };
            db.MediaHosts.Add(host);
        }
        host.Name = Required(request.Name, 200, nameof(request.Name));
        host.MachineName = Required(request.MachineName, 200, nameof(request.MachineName));
        host.AgentVersion = Required(request.AgentVersion, 64, nameof(request.AgentVersion));
        host.IpAddress = ipAddress;
        host.Status = "Online";
        host.LastSeenAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return host;
    }

    public async Task<bool> HeartbeatAsync(Guid hostId, string? ipAddress, CancellationToken ct)
    {
        var host = await db.MediaHosts.FindAsync([hostId], ct);
        if (host is null) return false;
        host.Status = "Online"; host.LastSeenAtUtc = DateTime.UtcNow; host.IpAddress = ipAddress;
        await db.SaveChangesAsync(ct); return true;
    }

    public async Task<bool> UpdateDisplaysAsync(
        Guid hostId,
        IReadOnlyCollection<DisplayReportDto> reports,
        CancellationToken ct)
    {
        if (reports.Count > 32)
            throw new ArgumentException("A host cannot report more than 32 displays.");

        var host = await db.MediaHosts
            .Include(x => x.Displays)
            .SingleOrDefaultAsync(x => x.Id == hostId, ct);

        if (host is null)
            return false;

        var normalizedReports = new Dictionary<string, DisplayReportDto>(
            StringComparer.OrdinalIgnoreCase);

        foreach (var report in reports)
        {
            var key = Required(report.DisplayKey, 256, nameof(report.DisplayKey));

            if (!normalizedReports.TryAdd(key, report))
                throw new ArgumentException($"Duplicate display key: {key}");

            if (report.Width < 0 || report.Height < 0 || report.RefreshRate < 0)
                throw new ArgumentException(
                    "Display dimensions and refresh rate cannot be negative.");

            Required(report.DeviceName, 256, nameof(report.DeviceName));
            Required(report.FriendlyName, 256, nameof(report.FriendlyName));
        }

        var existingDisplays = host.Displays
            .ToDictionary(
                x => x.DisplayKey,
                StringComparer.OrdinalIgnoreCase);

        foreach (var (key, report) in normalizedReports)
        {
            if (!existingDisplays.TryGetValue(key, out var display))
            {
                display = new DisplayDevice
                {
                    Id = Guid.NewGuid(),
                    MediaHostId = hostId,
                    DisplayKey = key
                };

                db.DisplayDevices.Add(display);
            }
            else
            {
                existingDisplays.Remove(key);
            }

            display.DeviceName = report.DeviceName.Trim();
            display.FriendlyName = report.FriendlyName.Trim();
            display.Width = report.Width;
            display.Height = report.Height;
            display.RefreshRate = report.RefreshRate;
            display.IsPrimary = report.IsPrimary;
            display.UpdatedAtUtc = DateTime.UtcNow;
        }

        foreach (var staleDisplay in existingDisplays.Values)
        {
            db.DisplayDevices.Remove(staleDisplay);
        }

        host.Status = "Online";
        host.LastSeenAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return true;
    }

    public async Task<MediaHost?> GetByIdAsync(Guid hostId, CancellationToken ct) =>
        await db.MediaHosts.AsNoTracking().SingleOrDefaultAsync(x => x.Id == hostId, ct);

    public async Task<IReadOnlyList<MediaHostDto>> GetAllAsync(CancellationToken ct) => await db.MediaHosts
        .AsNoTracking().Include(x => x.Displays).OrderBy(x => x.Name)
        .Select(x => new MediaHostDto(x.Id, x.Name, x.MachineName, x.AgentVersion, x.Status, x.IpAddress, x.LastSeenAtUtc,
            x.Displays.OrderBy(d => d.DisplayKey).Select(d => new DisplayDeviceDto(d.Id, d.DisplayKey, d.DeviceName, d.FriendlyName, d.Width, d.Height, d.RefreshRate, d.IsPrimary)).ToList()))
        .ToListAsync(ct);

    public async Task<IReadOnlyList<Guid>> MarkStaleOfflineAsync(
        DateTime thresholdUtc,
        CancellationToken ct)
    {
        var stale = await db.MediaHosts
            .Where(x => x.Status == "Online" && x.LastSeenAtUtc < thresholdUtc)
            .ToListAsync(ct);

        foreach (var host in stale)
        {
            host.Status = "Offline";
        }

        if (stale.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        return stale.Select(x => x.Id).ToList();
    }

    private static string Required(string? value, int maxLength, string field)
    {
        var normalized = value?.Trim();
        if (string.IsNullOrWhiteSpace(normalized) || normalized.Length > maxLength) throw new ArgumentException($"{field} is required and must be at most {maxLength} characters.");
        return normalized;
    }
}
