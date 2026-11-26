using audexa_backend.Data;
using audexa_backend.Services;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using audexa_backend.Logging;
using audexa_backend.Hubs;
using audexa_backend.Security;
using System.Net;

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
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("media-host-pair", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});
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
builder.Services.AddScoped<MediaHostPairingService>();
builder.Services.AddSingleton<PlaybackCommandRegistry>();
builder.Services.AddSingleton<MediaPlaybackStateRegistry>();
builder.Services.AddSingleton<MediaScenarioPlaybackService>();
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

// Resolve endpoint metadata before applying the network access boundary.
app.UseRouting();

// The Desktop UI and all administrative REST endpoints are loopback-only.
// Only explicitly marked Media Agent endpoints may be reached over the LAN;
// those endpoints must enforce their own pairing/device credentials.
app.Use(async (context, next) =>
{
    var endpoint = context.GetEndpoint();
    if (endpoint is not null &&
        endpoint.Metadata.GetMetadata<LanAccessibleAttribute>() is null &&
        !IsLoopback(context.Connection.RemoteIpAddress))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new
        {
            message = "This endpoint is available only to the local Audexa Desktop application."
        });
        return;
    }

    await next();
});

app.UseCors("Frontend");
app.UseRateLimiter();

app.MapControllers();
app.MapHub<MediaHostHub>("/hubs/media-hosts")
    .WithMetadata(new LanAccessibleAttribute());
app.MapHub<MediaHostsUiHub>("/hubs/media-hosts-ui");

app.Run();

static bool IsLoopback(IPAddress? address)
{
    if (address is null)
        return false;

    if (address.IsIPv4MappedToIPv6)
        address = address.MapToIPv4();

    return IPAddress.IsLoopback(address);
}