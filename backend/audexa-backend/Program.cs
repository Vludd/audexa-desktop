using audexa_backend.Data;
using audexa_backend.Services;
using Microsoft.EntityFrameworkCore;
using audexa_backend.Logging;
using audexa_backend.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Audexa Backend listens on all network interfaces so Media Agents can
// connect from other machines on the local network. The port is configurable.
var backendPort = builder.Configuration.GetValue<int?>("Network:Port") ?? 18080;

if (backendPort is < 1 or > 65535)
{
    throw new InvalidOperationException(
        "Network:Port must be between 1 and 65535.");
}

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 4L * 1024 * 1024 * 1024;
    options.ListenAnyIP(backendPort);
});

// Database Path

var appDataPath = Environment.GetFolderPath(
    Environment.SpecialFolder.ApplicationData);

var audexaDataPath = Path.Combine(appDataPath, "Audexa");

Directory.CreateDirectory(audexaDataPath);
var logDirectory = Path.Combine(audexaDataPath, "Logs");
Directory.CreateDirectory(logDirectory);

var databasePath = Path.Combine(audexaDataPath, "audexa.db");

// Persistent operational logs (daily JSONL files, 5 MB per file, 14-day retention).
var fileLoggerProvider = new JsonFileLoggerProvider(logDirectory);
builder.Logging.AddProvider(fileLoggerProvider);
builder.Services.AddSingleton(fileLoggerProvider);

// Services

builder.Services.AddControllers();
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "https://appassets.audexa")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite($"Data Source={databasePath}"));

builder.Services.AddScoped<IAudioFileService, AudioFileService>();
builder.Services.AddScoped<VideoFileService>();
builder.Services.AddSingleton<IAudioDeviceService, AudioDeviceService>();
builder.Services.AddScoped<IAudioSettingsService, AudioSettingsService>();
builder.Services.AddScoped<IAudioDiagnosticsService, AudioDiagnosticsService>();
builder.Services.AddScoped<RoomService>();
builder.Services.AddScoped<ScenarioService>();
builder.Services.AddScoped<ScheduleService>();
builder.Services.AddScoped<MediaHostRegistry>();
builder.Services.AddSingleton<PlaybackCommandRegistry>();
builder.Services.AddHostedService<MediaHostPresenceService>();
builder.Services.AddHostedService<BackendDiscoveryService>();
builder.Services.AddSingleton<IPlaybackEngine, PlaybackEngine>();
builder.Services.AddHostedService<ScenarioSchedulerService>();

var app = builder.Build();

// Apply database migrations on startup so packaged desktop deployments do not
// require a separate EF CLI step.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// HTTP pipeline

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Audexa runs as a local desktop backend.
// The React frontend connects to the loopback HTTP endpoint.
app.UseCors("Frontend");

app.UseAuthorization();

app.MapControllers();
app.MapHub<MediaHostHub>("/hubs/media-hosts");
app.MapHub<MediaHostsUiHub>("/hubs/media-hosts-ui");

app.Run();