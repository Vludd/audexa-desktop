using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;

using Microsoft.Extensions.Logging;

namespace Audexa.MediaAgent.Infrastructure;

public sealed record DiscoveredBackend(Uri BaseUri, string MachineName);

public static class BackendDiscoveryClient
{
    private const string ProtocolMagic = "AUDEXA";
    private const string ProtocolVersion = "1";

    public static async Task<DiscoveredBackend?> DiscoverAsync(
        int discoveryPort,
        int timeoutSeconds,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var nonce = Guid.NewGuid().ToString("N");
        var request = Encoding.UTF8.GetBytes(
            string.Join('|', ProtocolMagic, ProtocolVersion, "PAIR_REQUEST", nonce));

        using var udp = new UdpClient(new IPEndPoint(IPAddress.Any, 0));
        udp.EnableBroadcast = true;

        var broadcasts = GetBroadcastAddresses();
        if (broadcasts.Count == 0)
        {
            logger.LogWarning("Backend Discovery found no active IPv4 broadcast interfaces.");
            return null;
        }

        foreach (var broadcast in broadcasts)
        {
            try
            {
                await udp.SendAsync(request, new IPEndPoint(broadcast, discoveryPort), cancellationToken);
                logger.LogDebug("Sent Backend Discovery request to {Address}:{Port}.", broadcast, discoveryPort);
            }
            catch (Exception ex) when (ex is SocketException or NetworkInformationException or ObjectDisposedException)
            {
                logger.LogDebug(ex, "Could not send discovery request to {Address}.", broadcast);
            }
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(timeoutSeconds, 1, 30)));

        var candidates = new Dictionary<string, DiscoveredBackend>(StringComparer.OrdinalIgnoreCase);
        while (!timeout.IsCancellationRequested)
        {
            UdpReceiveResult received;
            try
            {
                received = await udp.ReceiveAsync(timeout.Token);
            }
            catch (OperationCanceledException) when (timeout.IsCancellationRequested)
            {
                break;
            }
            catch (SocketException ex)
            {
                logger.LogDebug(ex, "Backend Discovery receive failed.");
                break;
            }

            if (!TryParseResponse(received.Buffer, nonce, out var port, out var machineName))
                continue;

            var identity = $"{machineName}:{port}";
            if (!candidates.ContainsKey(identity))
            {
                var address = received.RemoteEndPoint.Address;
                candidates.Add(identity, new DiscoveredBackend(
                    new UriBuilder(Uri.UriSchemeHttp, address.ToString(), port).Uri,
                    machineName));
            }
        }

        if (candidates.Count == 0)
            return null;

        if (candidates.Count > 1)
        {
            logger.LogWarning(
                "Backend Discovery found multiple servers: {Servers}. Configure MediaAgent:BackendUrl or remove the duplicate Backend instance.",
                string.Join(", ", candidates.Keys));
            return null;
        }

        return candidates.Values.Single();
    }

    private static bool TryParseResponse(
        byte[] buffer,
        string expectedNonce,
        out int port,
        out string machineName)
    {
        port = 0;
        machineName = string.Empty;

        var fields = Encoding.UTF8.GetString(buffer).Split('|');
        if (fields.Length != 6 ||
            fields[0] != ProtocolMagic ||
            fields[1] != ProtocolVersion ||
            fields[2] != "PAIR_RESPONSE" ||
            !string.Equals(fields[3], expectedNonce, StringComparison.Ordinal) ||
            !int.TryParse(fields[4], out port) || port is < 1 or > 65535)
        {
            return false;
        }

        try
        {
            machineName = Encoding.UTF8.GetString(Convert.FromBase64String(fields[5]));
            return !string.IsNullOrWhiteSpace(machineName);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static IReadOnlyList<IPAddress> GetBroadcastAddresses()
    {
        var result = new HashSet<IPAddress>();

        foreach (var networkInterface in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (networkInterface.OperationalStatus != OperationalStatus.Up ||
                networkInterface.NetworkInterfaceType == NetworkInterfaceType.Loopback)
            {
                continue;
            }

            IPInterfaceProperties properties;
            try
            {
                properties = networkInterface.GetIPProperties();
            }
            catch (NetworkInformationException)
            {
                continue;
            }

            foreach (var unicast in properties.UnicastAddresses)
            {
                if (unicast.Address.AddressFamily != AddressFamily.InterNetwork ||
                    unicast.IPv4Mask is null ||
                    IPAddress.IsLoopback(unicast.Address) ||
                    unicast.Address.GetAddressBytes()[0] == 169)
                {
                    continue;
                }

                var addressBytes = unicast.Address.GetAddressBytes();
                var maskBytes = unicast.IPv4Mask.GetAddressBytes();
                var broadcastBytes = new byte[4];

                for (var i = 0; i < broadcastBytes.Length; i++)
                    broadcastBytes[i] = (byte)(addressBytes[i] | (maskBytes[i] ^ 0xFF));

                var broadcast = new IPAddress(broadcastBytes);
                if (!broadcast.Equals(unicast.Address))
                    result.Add(broadcast);
            }
        }

        return result.ToArray();
    }
}
