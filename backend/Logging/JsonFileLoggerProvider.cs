using System.Collections.Concurrent;
using System.Text.Json;

namespace audexa_backend.Logging;

public sealed class JsonFileLoggerProvider : ILoggerProvider
{
    private readonly string _directory;
    private readonly object _writeLock = new();
    private readonly ConcurrentDictionary<string, FileLogger> _loggers = new();
    private const long MaxFileBytes = 5 * 1024 * 1024;
    private const int RetentionDays = 14;
    private DateTime _lastCleanupUtc = DateTime.UtcNow;

    public JsonFileLoggerProvider(string directory)
    {
        _directory = directory;
        Directory.CreateDirectory(_directory);
        CleanupOldFiles();
    }

    public ILogger CreateLogger(string categoryName) =>
        _loggers.GetOrAdd(categoryName, category => new FileLogger(this, category));

    internal void Write(string category, LogLevel level, EventId eventId, string message, Exception? exception)
    {
        if (level < LogLevel.Information) return;

        var record = new BackendLogRecord(
            DateTimeOffset.Now,
            level.ToString().ToUpperInvariant(),
            ResolveSource(category),
            string.IsNullOrWhiteSpace(eventId.Name) ? ResolveEvent(category, level) : eventId.Name!,
            message,
            category,
            eventId.Id,
            exception?.GetType().Name,
            exception?.Message);

        var line = JsonSerializer.Serialize(record);
        lock (_writeLock)
        {
            try
            {
                if (DateTime.UtcNow - _lastCleanupUtc >= TimeSpan.FromHours(1))
                {
                    CleanupOldFiles();
                    _lastCleanupUtc = DateTime.UtcNow;
                }

                var path = Path.Combine(_directory, $"audexa-backend-{DateTime.Now:yyyyMMdd}.jsonl");
                if (File.Exists(path) && new FileInfo(path).Length + System.Text.Encoding.UTF8.GetByteCount(line) > MaxFileBytes)
                    path = Path.Combine(_directory, $"audexa-backend-{DateTime.Now:yyyyMMdd}-{DateTime.Now:HHmmss}.jsonl");
                File.AppendAllText(path, line + Environment.NewLine);
            }
            catch
            {
                // Logging must never crash the application.
            }
        }
    }

    public IReadOnlyList<BackendLogRecord> ReadRecent(int limit = 1000)
    {
        var records = new List<BackendLogRecord>();
        foreach (var file in Directory.EnumerateFiles(_directory, "audexa-backend-*.jsonl").OrderByDescending(file => File.GetLastWriteTimeUtc(file)))
        {
            try
            {
                foreach (var line in File.ReadLines(file).Reverse())
                {
                    try
                    {
                        var item = JsonSerializer.Deserialize<BackendLogRecord>(line);
                        if (item is not null) records.Add(item);
                    }
                    catch (JsonException) { }
                    if (records.Count >= Math.Clamp(limit, 1, 5000)) break;
                }
            }
            catch (IOException) { }
            if (records.Count >= Math.Clamp(limit, 1, 5000)) break;
        }
        return records.OrderByDescending(x => x.Timestamp).Take(Math.Clamp(limit, 1, 5000)).ToList();
    }

    public void Clear()
    {
        lock (_writeLock)
        {
            foreach (var file in Directory.EnumerateFiles(_directory, "audexa-backend-*.jsonl"))
            {
                try { File.Delete(file); }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
    }

    private void CleanupOldFiles()
    {
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        foreach (var file in Directory.EnumerateFiles(_directory, "audexa-backend-*.jsonl"))
        {
            try { if (File.GetLastWriteTimeUtc(file) < cutoff) File.Delete(file); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    private static string ResolveSource(string category) =>
        category.Contains("ScenarioScheduler", StringComparison.OrdinalIgnoreCase) ? "SCHEDULE" :
        category.Contains("Playback", StringComparison.OrdinalIgnoreCase) ? "AUDIO" :
        category.Contains("Controller", StringComparison.OrdinalIgnoreCase) ? "API" : "SYSTEM";

    private static string ResolveEvent(string category, LogLevel level)
    {
        var name = category.Split('.').LastOrDefault() ?? "backend";
        return $"backend.{name.ToLowerInvariant()}.{level.ToString().ToLowerInvariant()}";
    }

    public void Dispose()
    {
        foreach (var logger in _loggers.Values) logger.Dispose();
        _loggers.Clear();
    }

    private sealed class FileLogger(JsonFileLoggerProvider owner, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;
        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;
            owner.Write(category, logLevel, eventId, formatter(state, exception), exception);
        }
        public void Dispose() { }
    }

    private sealed class NullScope : IDisposable
    {
        public static readonly NullScope Instance = new();
        public void Dispose() { }
    }
}

public sealed record BackendLogRecord(
    DateTimeOffset Timestamp,
    string Level,
    string Source,
    string Event,
    string Message,
    string Category,
    int EventId,
    string? ExceptionType,
    string? ExceptionMessage);
