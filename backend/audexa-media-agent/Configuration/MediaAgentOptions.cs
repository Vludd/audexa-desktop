namespace Audexa.MediaAgent.Configuration;

public sealed class MediaAgentOptions
{
    public string BackendUrl { get; set; } = string.Empty;
    public string HubPath { get; set; } = "/hubs/media-hosts";
    public string MediaHostId { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public int HeartbeatIntervalSeconds { get; set; } = 15;
    public int DisplayRefreshIntervalSeconds { get; set; } = 10;
    public bool DiscoveryEnabled { get; set; } = true;
    public int DiscoveryPort { get; set; } = 18081;
    public int DiscoveryTimeoutSeconds { get; set; } = 5;
    public int DiscoveryRetryIntervalSeconds { get; set; } = 15;
}
