using Microsoft.Extensions.Hosting;

namespace audexa_backend.Services;

public sealed class MediaHostPresenceService(IServiceScopeFactory scopeFactory, ILogger<MediaHostPresenceService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var registry = scope.ServiceProvider.GetRequiredService<MediaHostRegistry>();
                await registry.MarkStaleOfflineAsync(DateTime.UtcNow.AddSeconds(-45), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Failed to refresh Media Host presence."); }
        }
    }
}
