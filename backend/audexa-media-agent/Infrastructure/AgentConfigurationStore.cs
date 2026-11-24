using System.Security.Cryptography;
using System.Text.Json;

namespace Audexa.MediaAgent.Infrastructure;

public sealed record AgentConfiguration(string MediaHostId, string BackendUrl, string HubPath);

public static class AgentConfigurationStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private static string DirectoryPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Audexa", "MediaAgent");

    private static string ConfigPath => Path.Combine(DirectoryPath, "config.json");

    public static AgentConfiguration? Load()
    {
        try
        {
            if (!File.Exists(ConfigPath))
                return null;

            var config = JsonSerializer.Deserialize<AgentConfiguration>(
                File.ReadAllText(ConfigPath));

            if (config is null ||
                !Guid.TryParse(config.MediaHostId, out _) ||
                !Uri.TryCreate(config.BackendUrl, UriKind.Absolute, out var backendUri) ||
                (backendUri.Scheme != Uri.UriSchemeHttp && backendUri.Scheme != Uri.UriSchemeHttps) ||
                string.IsNullOrWhiteSpace(CredentialStore.Load()))
                return null;

            return config;
        }
        catch
        {
            return null;
        }
    }

    public static void Save(AgentConfiguration configuration)
    {
        Directory.CreateDirectory(DirectoryPath);
        var temporaryPath = ConfigPath + ".tmp";
        File.WriteAllText(temporaryPath, JsonSerializer.Serialize(configuration, JsonOptions));
        File.Move(temporaryPath, ConfigPath, overwrite: true);
    }

    public static void Clear()
    {
        if (File.Exists(ConfigPath))
            File.Delete(ConfigPath);
        CredentialStore.Clear();
    }
}

public static class CredentialStore
{
    private static readonly byte[] Entropy = "Audexa.MediaAgent.Credential.v1"u8.ToArray();

    private static string CredentialPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Audexa", "MediaAgent", "credentials.dpapi");

    public static void Save(string secret)
    {
        var directory = Path.GetDirectoryName(CredentialPath)!;
        Directory.CreateDirectory(directory);
        var protectedBytes = ProtectedData.Protect(
            System.Text.Encoding.UTF8.GetBytes(secret),
            Entropy,
            DataProtectionScope.CurrentUser);
        var temporaryPath = CredentialPath + ".tmp";
        File.WriteAllBytes(temporaryPath, protectedBytes);
        File.Move(temporaryPath, CredentialPath, overwrite: true);
    }

    public static string? Load()
    {
        if (!File.Exists(CredentialPath))
            return null;

        var protectedBytes = File.ReadAllBytes(CredentialPath);
        var clearBytes = ProtectedData.Unprotect(
            protectedBytes,
            Entropy,
            DataProtectionScope.CurrentUser);
        return System.Text.Encoding.UTF8.GetString(clearBytes);
    }

    public static void Clear()
    {
        if (File.Exists(CredentialPath))
            File.Delete(CredentialPath);
    }
}
