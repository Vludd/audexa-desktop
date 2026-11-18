using Audexa.MediaAgent;
using Audexa.MediaAgent.Configuration;
using Audexa.MediaAgent.Display;
using Audexa.MediaAgent.Playback;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

builder.Configuration.AddJsonFile(
    "appsettings.json",
    optional: false,
    reloadOnChange: true
);

// Environment variables must be added AFTER appsettings.json so that
// MediaAgent__SharedToken overrides the JSON configuration value.
builder.Configuration.AddEnvironmentVariables();

builder.Services.Configure<MediaAgentOptions>(
    builder.Configuration.GetSection("MediaAgent")
);

builder.Services.AddSingleton<DisplayEnumerator>();
builder.Services.AddSingleton<PlaybackUiThread>();
builder.Services.AddSingleton<LibVlcPlayerManager>();
builder.Services.AddHostedService<MediaAgentWorker>();

var host = builder.Build();

await host.RunAsync();