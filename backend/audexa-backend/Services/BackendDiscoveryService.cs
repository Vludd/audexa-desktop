using System.Net;
using System.Net.Sockets;
using System.Text;

using Microsoft.Extensions.Hosting;

namespace audexa_backend.Services;

/// <summary>
/// Answers first-run discovery requests. The response returns only a candidate
/// Backend address; it is not an authentication mechanism.
/// Protocol: AUDEXA|1|PAIR_REQUEST|nonce
/// </summary>
public sealed class BackendDiscoveryService : BackgroundService
{
    private const string ProtocolMagic = "AUDEXA";
    private const string ProtocolVersion = "1";

    private readonly ILogger<BackendDiscoveryService> _logger;
    private readonly int _discoveryPort;
    private readonly int _httpPort;

    public BackendDiscoveryService(IConfiguration configuration, ILogger<BackendDiscoveryService> logger)
    {
        _logger = logger;
        _discoveryPort = configuration.GetValue<int?>("Network:DiscoveryPort") ?? 18081;
        _httpPort = configuration.GetValue<int?>("Network:Port") ?? 18080;

        if (_discoveryPort is < 1 or > 65535)
            throw new InvalidOperationException("Network:DiscoveryPort must be between 1 and 65535.");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var udp = new UdpClient(new IPEndPoint(IPAddress.Any, _discoveryPort));
        _logger.LogInformation(
            "Backend Discovery listening on UDP 0.0.0.0:{Port}; HTTP port={HttpPort}",
            _discoveryPort,
            _httpPort);

        while (!stoppingToken.IsCancellationRequested)
        {
            UdpReceiveResult received;
            try
            {
                received = await udp.ReceiveAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (ObjectDisposedException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Backend Discovery receive failed.");
                continue;
            }

            try
            {
                var request = Encoding.UTF8.GetString(received.Buffer).Split('|');
                if (request.Length != 4 ||
                    request[0] != ProtocolMagic ||
                    request[1] != ProtocolVersion ||
                    request[2] != "PAIR_REQUEST" ||
                    !Guid.TryParseExact(request[3], "N", out _))
                {
                    continue;
                }

                var nonce = request[3];
                var machineName = Environment.MachineName;
                var machineNameBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(machineName));

                // Discovery only returns a candidate address. Pairing-code validation
                // and device authentication happen over HTTP, not UDP.
                var response = string.Join('|',
                    ProtocolMagic, ProtocolVersion, "PAIR_RESPONSE",
                    nonce, _httpPort, machineNameBase64);

                var responseBytes = Encoding.UTF8.GetBytes(response);
                await udp.SendAsync(responseBytes, received.RemoteEndPoint, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Could not answer a Backend Discovery request from {RemoteEndpoint}.",
                    received.RemoteEndPoint);
            }
        }
    }
}
