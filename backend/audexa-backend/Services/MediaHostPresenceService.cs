using audexa_backend.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace audexa_backend.Services;

public sealed class MediaHostPresenceService(
    IServiceScopeFactory scopeFactory,
    IHubContext<MediaHostsUiHub> uiHub,
    ILogger<MediaHostPresenceService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();

                var registry = scope.ServiceProvider
                    .GetRequiredService<MediaHostRegistry>();

                var offlineHostIds = await registry.MarkStaleOfflineAsync(
                    DateTime.UtcNow.AddSeconds(-45),
                    stoppingToken);

                foreach (var hostId in offlineHostIds)
                {
                    await uiHub.Clients.All.SendAsync(
                        "MediaHostUpdated",
                        hostId,
                        "Offline",
                        stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Failed to refresh Media Host presence.");
            }
        }
    }
}