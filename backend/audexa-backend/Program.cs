using audexa_backend.Data;
using audexa_backend.Services;
using Microsoft.EntityFrameworkCore;
using audexa_backend.Logging;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://127.0.0.1:5081");

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

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "https://appassets.audexa")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite($"Data Source={databasePath}"));

builder.Services.AddScoped<IAudioFileService, AudioFileService>();
builder.Services.AddSingleton<IAudioDeviceService, AudioDeviceService>();
builder.Services.AddScoped<IAudioSettingsService, AudioSettingsService>();
builder.Services.AddScoped<IAudioDiagnosticsService, AudioDiagnosticsService>();
builder.Services.AddScoped<RoomService>();
builder.Services.AddScoped<ScenarioService>();
builder.Services.AddScoped<ScheduleService>();
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

app.Run();