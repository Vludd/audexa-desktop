using Audexa.MediaAgent;
using Audexa.MediaAgent.Configuration;
using Audexa.MediaAgent.Display;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

builder.Configuration.AddJsonFile(
    "appsettings.json",
    optional: false,
    reloadOnChange: true
);

builder.Services.Configure<MediaAgentOptions>(
    builder.Configuration.GetSection("MediaAgent")
);

builder.Services.AddSingleton<DisplayEnumerator>();
builder.Services.AddHostedService<MediaAgentWorker>();

var host = builder.Build();

await host.RunAsync();