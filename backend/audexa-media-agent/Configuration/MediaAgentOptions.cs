namespace Audexa.MediaAgent.Configuration;

public sealed class MediaAgentOptions
{
    public string BackendUrl { get; set; } = "http://127.0.0.1:5081";
    public string HubPath { get; set; } = "/hubs/media-hosts";
    public string SharedToken { get; set; } = string.Empty;
    public int HeartbeatIntervalSeconds { get; set; } = 15;
    public int DisplayRefreshIntervalSeconds { get; set; } = 10;
}
