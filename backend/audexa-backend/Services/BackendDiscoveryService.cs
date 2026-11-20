using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;

using Microsoft.Extensions.Hosting;

namespace audexa_backend.Services;

/// <summary>
/// Answers authenticated UDP discovery requests from Audexa Media Agents.
/// Protocol: AUDEXA|1|REQUEST|nonce
/// Response: AUDEXA|1|RESPONSE|nonce|httpPort|base64(machineName)|hmacSha256
/// </summary>
public sealed class BackendDiscoveryService : BackgroundService
{
    private const string ProtocolMagic = "AUDEXA";
    private const string ProtocolVersion = "1";

    private readonly ILogger<BackendDiscoveryService> _logger;
    private readonly int _discoveryPort;
    private readonly int _httpPort;
    private readonly byte[] _agentToken;

    public BackendDiscoveryService(IConfiguration configuration, ILogger<BackendDiscoveryService> logger)
    {
        _logger = logger;
        _discoveryPort = configuration.GetValue<int?>("Network:DiscoveryPort") ?? 18081;
        _httpPort = configuration.GetValue<int?>("Network:Port") ?? 18080;
        _agentToken = Encoding.UTF8.GetBytes(
            configuration["MediaHosts:AgentToken"] ?? string.Empty);

        if (_discoveryPort is < 1 or > 65535)
            throw new InvalidOperationException("Network:DiscoveryPort must be between 1 and 65535.");

        if (_agentToken.Length == 0)
            _logger.LogWarning("Backend Discovery is disabled because MediaHosts:AgentToken is not configured.");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (_agentToken.Length == 0)
            return;

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
                    request[2] != "REQUEST" ||
                    !Guid.TryParseExact(request[3], "N", out _))
                {
                    continue;
                }

                var nonce = request[3];
                var machineName = Environment.MachineName;
                var machineNameBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(machineName));
                var signedPayload = $"{nonce}|{_httpPort}|{machineName}";
                var signature = Convert.ToHexString(
                    HMACSHA256.HashData(_agentToken, Encoding.UTF8.GetBytes(signedPayload)));

                var response = string.Join('|',
                    ProtocolMagic,
                    ProtocolVersion,
                    "RESPONSE",
                    nonce,
                    _httpPort,
                    machineNameBase64,
                    signature);

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
