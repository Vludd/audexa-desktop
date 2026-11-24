using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Audexa.MediaAgent.Infrastructure;

public sealed record PairingRequest(
    [property: JsonPropertyName("pairingCode")] string PairingCode,
    [property: JsonPropertyName("machineName")] string MachineName,
    [property: JsonPropertyName("agentVersion")] string AgentVersion);

public sealed record PairingResponse(
    [property: JsonPropertyName("mediaHostId")] Guid MediaHostId,
    [property: JsonPropertyName("accessToken")] string AccessToken,
    [property: JsonPropertyName("backendUrl")] string BackendUrl,
    [property: JsonPropertyName("hubPath")] string HubPath);

public static class PairingClient
{
    public static async Task<bool> ValidateSavedCredentialAsync(
        string backendUrl,
        Guid mediaHostId,
        string accessToken,
        CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(backendUrl, UriKind.Absolute, out var baseUri) ||
            (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps))
            throw new InvalidOperationException("Сохранён адрес Backend с некорректным HTTP(S)-URL.");

        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
        var endpoint = new Uri(
            new Uri(baseUri.ToString().TrimEnd('/') + "/"),
            $"api/media-hosts/{mediaHostId:D}/agent-credential");
        using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        request.Headers.Add("X-Audexa-Agent-Token", accessToken);

        using var response = await client.SendAsync(request, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
            response.StatusCode == System.Net.HttpStatusCode.Forbidden ||
            response.StatusCode == System.Net.HttpStatusCode.NotFound)
            return false;

        response.EnsureSuccessStatusCode();
        return true;
    }

    public static async Task<PairingResponse> PairAsync(
        string backendUrl,
        string pairingCode,
        string agentVersion,
        CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(backendUrl, UriKind.Absolute, out var baseUri) ||
            (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps))
            throw new InvalidOperationException("Укажите корректный HTTP(S)-адрес Backend.");

        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        var endpoint = new Uri(new Uri(baseUri.ToString().TrimEnd('/') + "/"), "api/media-hosts/pair");
        using var response = await client.PostAsJsonAsync(
            endpoint,
            new PairingRequest(pairingCode.Trim(), Environment.MachineName, agentVersion),
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                response.StatusCode == System.Net.HttpStatusCode.Unauthorized
                    ? "Код подключения неверный, просрочен или уже использован."
                    : $"Backend отклонил сопряжение ({(int)response.StatusCode}). {error}");
        }

        return await response.Content.ReadFromJsonAsync<PairingResponse>(
                   cancellationToken: cancellationToken)
               ?? throw new InvalidOperationException("Backend вернул пустой ответ при сопряжении.");
    }
}
