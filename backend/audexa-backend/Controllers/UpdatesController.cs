using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/updates")]
public sealed partial class UpdatesController : ControllerBase
{
    private const string ManifestUrl =
        "https://github.com/Vludd/audexa-desktop/releases/latest/download/latest.json";

    private const string ReleaseBaseUrl =
        "https://github.com/Vludd/audexa-desktop/releases/download/";

    private static readonly HttpClient HttpClient = new()
    {
        Timeout = TimeSpan.FromSeconds(15),
    };

    [GeneratedRegex("^[a-fA-F0-9]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex Sha256Regex();

    [HttpGet("check")]
    [ProducesResponseType<UpdateCheckResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<UpdateCheckResponse>> Check(
        CancellationToken cancellationToken)
    {
        ReleaseManifest? manifest;

        try
        {
            using var response = await HttpClient.GetAsync(
                ManifestUrl,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            response.EnsureSuccessStatusCode();

            await using var stream =
                await response.Content.ReadAsStreamAsync(cancellationToken);

            manifest = await JsonSerializer.DeserializeAsync<ReleaseManifest>(
                stream,
                new JsonSerializerOptions(JsonSerializerDefaults.Web),
                cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (
            ex is HttpRequestException or
            TaskCanceledException or
            JsonException)
        {
            return Problem(
                statusCode: StatusCodes.Status502BadGateway,
                title: "Не удалось получить информацию об обновлении.",
                detail: "Проверьте подключение к интернету и повторите попытку.");
        }

        if (!IsValidManifest(manifest, out var latestVersion))
        {
            return Problem(
                statusCode: StatusCodes.Status502BadGateway,
                title: "Некорректный манифест обновления.");
        }

        var currentVersionText = GetCurrentVersion();

        if (!Version.TryParse(currentVersionText, out var currentVersion))
        {
            return Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Не удалось определить текущую версию Audexa.");
        }

        // IsValidManifest гарантирует, что обязательные поля не пусты.
        var packageUrl = manifest!.PackageUrl!;
        var sha256 = manifest.Sha256!;

        return Ok(new UpdateCheckResponse(
            CurrentVersion: currentVersionText,
            LatestVersion: manifest.Version!,
            UpdateAvailable: latestVersion > currentVersion,
            ReleaseNotes: manifest.ReleaseNotes ?? string.Empty,
            PackageUrl: packageUrl,
            Sha256: sha256.ToLowerInvariant()));
    }

    private static bool IsValidManifest(
        ReleaseManifest? manifest,
        out Version latestVersion)
    {
        latestVersion = new Version(0, 0, 0);

        if (manifest is null ||
            string.IsNullOrWhiteSpace(manifest.Version) ||
            !Version.TryParse(manifest.Version, out var parsedVersion) ||
            parsedVersion.Revision > 0 ||
            parsedVersion.Build < 0 ||
            string.IsNullOrWhiteSpace(manifest.PackageUrl) ||
            string.IsNullOrWhiteSpace(manifest.Sha256) ||
            !Sha256Regex().IsMatch(manifest.Sha256))
        {
            return false;
        }

        var expectedPath =
            $"/Vludd/audexa-desktop/releases/download/v{manifest.Version}/" +
            $"Audexa-Update-{manifest.Version}-win-x64.zip";

        if (!Uri.TryCreate(manifest.PackageUrl, UriKind.Absolute, out var packageUri) ||
            !string.Equals(
                packageUri.Scheme,
                Uri.UriSchemeHttps,
                StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(
                packageUri.Host,
                "github.com",
                StringComparison.OrdinalIgnoreCase) ||
            packageUri.Port != 443 ||
            !string.Equals(
                packageUri.AbsolutePath,
                expectedPath,
                StringComparison.Ordinal) ||
            !string.IsNullOrEmpty(packageUri.Query) ||
            !string.IsNullOrEmpty(packageUri.Fragment))
        {
            return false;
        }

        latestVersion = parsedVersion;
        return true;
    }

    private static string GetCurrentVersion()
    {
        var assembly = Assembly.GetExecutingAssembly();

        var informationalVersion = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;

        var version = informationalVersion?.Split('+', 2)[0];

        if (!string.IsNullOrWhiteSpace(version) &&
            Version.TryParse(version, out _))
        {
            return version;
        }

        var assemblyVersion = assembly.GetName().Version;

        return assemblyVersion is not null
            ? $"{assemblyVersion.Major}.{assemblyVersion.Minor}.{Math.Max(assemblyVersion.Build, 0)}"
            : "1.0.0";
    }

    private sealed record ReleaseManifest(
        string? Version,
        string? PackageUrl,
        string? Sha256,
        string? ReleaseNotes);
}

public sealed record UpdateCheckResponse(
    string CurrentVersion,
    string LatestVersion,
    bool UpdateAvailable,
    string ReleaseNotes,
    string PackageUrl,
    string Sha256);