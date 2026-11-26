# Audexa Backend

The Backend is the local ASP.NET Core service used by Audexa Desktop and remote Media Agents. It provides REST APIs, SignalR hubs, SQLite persistence, media-file storage, playback coordination, scheduling, and Media Host management.

## Tech stack

- .NET 8 / ASP.NET Core Web API
- Entity Framework Core 8
- SQLite
- SignalR
- NAudio
- FFmpeg LGPL runtime for decoding embedded video soundtracks
- Swashbuckle / Swagger

## Project layout

```text
backend/
├── audexa-backend/
│   ├── Controllers/       # REST API endpoints
│   ├── Data/              # EF Core DbContext
│   ├── DTOs/              # API contracts
│   ├── Hubs/              # SignalR hubs
│   ├── Logging/           # JSONL file logger
│   ├── Migrations/        # EF Core migrations
│   ├── Models/            # Persistence models
│   ├── Services/          # Application and background services
│   ├── Program.cs
│   └── audexa-backend.csproj
├── audexa-media-agent/    # Separate Windows playback process
└── audexa-backend.sln
```

## Requirements

- Windows for the full audio-device and desktop playback workflow.
- .NET 8 SDK.
- EF Core CLI only when creating or managing migrations manually.

Check the installed SDK:

```powershell
dotnet --version
```

## Run locally

Run these commands from the repository root:

```powershell
dotnet restore .\backend\audexa-backend.sln
dotnet build .\backend\audexa-backend.sln
dotnet run --project .\backend\audexa-backend\audexa-backend.csproj
```

The Backend listens on all network interfaces so paired Media Agents can connect over the LAN. The default configuration is:

| Purpose | Protocol | Port |
|---|---:|---:|
| HTTP API and SignalR | TCP | `18080` |
| Media Agent discovery | UDP | `18081` |

The HTTP port can be changed with `Network:Port`; the discovery port can be changed with `Network:DiscoveryPort`.

The network boundary is enforced by the Backend:

- All ordinary REST endpoints and `/hubs/media-hosts-ui` accept loopback connections only (`127.0.0.1` / `::1`). This includes the Desktop UI, administration, library, playback, settings, logs, diagnostics, and update APIs.
- Only explicitly marked Media Agent endpoints are reachable over the LAN: one-time pairing, saved-credential validation, protected video download, and `/hubs/media-hosts`.
- Every Media Agent endpoint still validates its one-time pairing code or device-specific credential. Marking an endpoint as LAN-accessible does not disable its authentication.
- UDP discovery remains available on the LAN and only returns a candidate Backend address; it is not authentication.

Configure Windows Firewall to allow TCP `18080` and UDP `18081` only on the intended Private network profile/subnet. Do not expose these ports through a router or public firewall.

Swagger UI is enabled in the Development environment at `http://localhost:18080/swagger`.

### Database migrations

The Backend applies EF Core migrations automatically during startup. A separate `database update` step is not required for normal local startup.

To manage migrations manually, install `dotnet-ef` compatible with EF Core 8 and run from the repository root:

```powershell
dotnet ef migrations list --project .\backend\audexa-backend\audexa-backend.csproj
dotnet ef migrations add <MigrationName> --project .\backend\audexa-backend\audexa-backend.csproj
dotnet ef database update --project .\backend\audexa-backend\audexa-backend.csproj
dotnet ef migrations remove --project .\backend\audexa-backend\audexa-backend.csproj
```

Commit migration source files together with the model changes that require them.

## API areas

The controllers expose the following API groups:

| Route | Purpose |
|---|---|
| `/api/health` | Backend health |
| `/api/audio` | Audio library: metadata, upload, stream, rename, delete |
| `/api/video` | Video library: metadata, upload, stream, Agent download, rename, gain, delete |
| `/api/rooms` | Room management |
| `/api/scenarios` | Scenario management and validation |
| `/api/schedules` | Schedule management |
| `/api/playback` | Playback state, sessions, and playback commands |
| `/api/audio-devices` | Audio device enumeration |
| `/api/settings/audio` | Audio configuration and output mappings |
| `/api/audio-system` | Audio system status |
| `/api/audio-diagnostics` | Output diagnostics |
| `/api/media-hosts` | Media Host registry, pairing, and remote playback commands |
| `/api/logs` | Backend log retrieval and clearing |
| `/api/updates` | Update availability check |

SignalR endpoints:

- `/hubs/media-hosts` — authenticated Media Agent connection.
- `/hubs/media-hosts-ui` — Frontend updates about Media Hosts and playback commands.

For exact request and response contracts, use the DTOs and controller actions in `audexa-backend/`. Swagger is available in Development.

## Pairing and Media Host security

Media Agents are paired individually:

1. An administrator creates a pairing invitation from the local Audexa UI.
2. The invitation code expires after five minutes and can be used only once.
3. The Agent exchanges the code for a device-specific secret.
4. The Backend stores a hash of that secret; the Agent stores the secret protected with Windows DPAPI (`CurrentUser`).
5. Agent SignalR connections and protected media downloads are validated against the individual credential.

All administrative Media Host management endpoints are loopback-only. The LAN pairing endpoint accepts only a short-lived, single-use code and is rate-limited per remote IP. Saved-credential validation, Agent SignalR connections, and protected video downloads require the paired host's individual secret.

UDP discovery on port `18081` only returns a candidate Backend address. It is not authentication. The current Backend uses HTTP rather than TLS, so pairing codes and Agent credentials must only traverse a trusted LAN. Do not expose the Backend or pairing flow to an untrusted network until HTTPS with appropriate certificate validation or pinning is implemented.

See [Media Agent README](audexa-media-agent/README.md) for the Agent-side setup and recovery procedure.

## Data locations

The Backend stores persistent data under `%APPDATA%\Audexa\` for the Windows account running the Backend:

| Path | Contents |
|---|---|
| `audexa.db` | SQLite database |
| `Audio\` | Uploaded audio files |
| `Video\` | Uploaded video files |
| `Logs\` | Backend JSONL logs |

Media files are stored on disk; SQLite stores their metadata and storage file names. Back up the complete application data directory before maintenance or migration work.

## Development notes

- The solution file is `backend/audexa-backend.sln`.
- The Backend project is `backend/audexa-backend/audexa-backend.csproj`.
- The Media Agent is a separate project and is published separately from the Backend.
- Video `RoomOutput` decodes the first embedded soundtrack with the bundled FFmpeg runtime and routes it through the same mapped NAudio outputs as regular audio. FFmpeg's LGPL third-party notice is copied beside the Backend publish output.
- Keep API DTOs, Frontend API clients, and SignalR event contracts in sync.
- Add and commit EF Core migrations when changing the persistence model.
- Never commit local databases, uploaded media, pairing codes, credentials, or machine-specific `appsettings.json` files.
