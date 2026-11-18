namespace Audexa.MediaAgent.Infrastructure;

public static class HostIdentity
{
    public static string GetOrCreate()
    {
        var directory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Audexa");
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "media-host-id");

        if (File.Exists(path))
        {
            var existing = File.ReadAllText(path).Trim();
            if (Guid.TryParse(existing, out var parsed))
                return parsed.ToString("D");
        }

        var id = Guid.NewGuid().ToString("D");
        File.WriteAllText(path, id);
        return id;
    }
}
