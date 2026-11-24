[English](README.md) | [Русский](README.ru.md)

# Audexa

**Windows desktop platform for audio automation and distributed playback**

Audexa is designed for museums, exhibitions, visitor centers, interactive installations, and other public spaces. It combines an audio library, playback rooms, scenarios, schedules, and remote playback hosts in one desktop application.

[Download the latest release](https://github.com/Vludd/audexa-desktop/releases/latest) · [All releases](https://github.com/Vludd/audexa-desktop/releases)

## Features

- **Audio library** — upload, browse, stream, rename, and delete audio files.
- **Rooms** — configure playback destinations and output assignments.
- **Scenarios** — create reusable sequences of playback steps.
- **Schedules** — configure scheduled scenario execution.
- **Playback control** — control playback and monitor active sessions.
- **Media Hosts** — register and manage remote playback computers.
- **Media Agent** — run playback on remote Windows hosts and report their displays and playback state.
- **Video library** — store and distribute video files to Media Agents.
- **Settings and diagnostics** — configure audio devices and inspect diagnostics and logs.
- **In-app updates** — check for and install published Audexa releases.

## Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/52c5dd8a-10b1-4498-ad73-faeeb2910eff" alt="Audexa dashboard" width="100%" />
</p>

<table>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/3533995e-054d-4679-8a1b-ad3b192eabae" alt="Rooms" width="100%" /></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/dac02966-d285-4457-a833-32df37f8c56b" alt="Scenarios" width="100%" /></td>
  </tr>
</table>

<details>
  <summary>More screenshots</summary>
  <br />
  <table>
    <tr>
      <td width="50%"><img src="https://github.com/user-attachments/assets/638e22c9-bdf2-410a-8ac4-9bc8fd10af11" alt="Schedule" width="100%" /></td>
      <td width="50%"><img src="https://github.com/user-attachments/assets/c1797f4b-b5c3-4814-813e-4f4c8b083377" alt="Audio library" width="100%" /></td>
    </tr>
    <tr>
      <td width="50%"><img src="https://github.com/user-attachments/assets/9e196fca-340d-4e42-9c67-b7ee2d2da07a" alt="Settings" width="100%" /></td>
      <td width="50%"><img src="https://github.com/user-attachments/assets/439b3b7c-b0fe-42d5-b485-fdb2e5de184c" alt="Event log" width="100%" /></td>
    </tr>
    <tr>
      <td colspan="2"><img src="https://github.com/user-attachments/assets/c6c7f979-501a-4984-95c8-65ddfd431ce7" alt="Additional application view" width="100%" /></td>
    </tr>
  </table>
</details>

## Architecture

Audexa is composed of four cooperating parts:

- **Desktop Shell** — a C# Windows application that hosts the frontend through WebView2 and starts the local Backend process.
- **Frontend** — the React and TypeScript user interface.
- **Backend** — an ASP.NET Core process providing the REST API, SignalR hubs, persistence, scheduling, and playback coordination.
- **Media Agent** — a separate Windows process installed on each remote playback host. It connects to the Backend and controls playback on the host's displays.

```text
┌────────────────────────────────────────────┐
│              Audexa Desktop                │
│  ┌──────────────────────────────────────┐  │
│  │       React + TypeScript UI          │  │
│  │              WebView2                │  │
│  └───────────────────┬──────────────────┘  │
│              C# Desktop Shell             │
│                      │                    │
│               local HTTP API              │
│                      ▼                    │
│              ASP.NET Core Backend         │
│                REST + SignalR             │
└──────────────────────┬────────────────────┘
                       │ LAN: HTTP + SignalR
             ┌─────────┴─────────┐
             ▼                   ▼
       SQLite + media       Remote Windows host
       files on disk          Media Agent
                              └─ displays / playback
```

### Media Agent pairing and network

- Backend HTTP API and SignalR use TCP port `18080` by default.
- Backend discovery uses UDP port `18081` by default.
- UDP discovery only helps an Agent locate a Backend; it does not authenticate the Backend.
- Each Agent is paired with a one-time code that expires after five minutes. Pairing creates an individual credential for that host.
- The Agent protects its credential with Windows DPAPI (`CurrentUser`) under `%APPDATA%\Audexa\MediaAgent`.
- The current Backend configuration uses HTTP. Keep Backend and Agent traffic on a trusted LAN; do not expose pairing or device credentials to untrusted networks. HTTPS with proper certificate validation or pinning is required before such deployment.

See [Media Agent documentation](backend/audexa-media-agent/README.md) for setup and recovery details.

## Install

Audexa is distributed for Windows x64. To install a published desktop release:

1. Open the [latest GitHub release](https://github.com/Vludd/audexa-desktop/releases/latest).
2. Download `Audexa-Setup-<version>-x64.exe` from the release assets.
3. Run the installer.

The Media Agent is distributed separately as `Audexa-MediaAgent-<version>-win-x64.zip`. Extract it on each playback computer and follow the [Media Agent setup guide](backend/audexa-media-agent/README.md).

## Repository layout

```text
audexa-desktop/
├── frontend/                    # React + TypeScript UI
│   └── docs/                    # Frontend-specific engineering notes
├── backend/
│   ├── audexa-backend/          # ASP.NET Core API and services
│   └── audexa-media-agent/      # Remote Windows playback agent
├── desktop/
│   ├── Audexa.Desktop/          # C# WebView2 desktop shell
│   └── Audexa.Updater/          # Windows updater executable
├── src/Audexa.UpdateCore/       # Transactional update implementation
├── tests/                       # Updater tests
├── scripts/                     # Build scripts
├── installer/                   # Inno Setup installer definition
├── ota/                         # Update manifest documentation
├── docs/                        # Build, release, and OTA documentation
└── .github/workflows/           # GitHub Actions release workflow
```

## Developer documentation

| Document | Scope |
|---|---|
| [Frontend README](frontend/README.md) | Frontend setup, development server, API configuration, and scripts |
| [Backend README](backend/README.md) | Backend setup, API areas, database, storage, and pairing |
| [Media Agent README](backend/audexa-media-agent/README.md) | Agent setup, pairing, network, publishing, and recovery |
| [Build and release guide](docs/BUILD-OTA.md) | Local build, installer, release workflow, and updater |
| [OTA manifest format](ota/README.md) | `latest.json` schema consumed by the updater |
| [Settings persistence inventory](frontend/docs/settings-persistence.md) | Verified frontend/backend persistence behavior |

## Quick development start

Requirements and exact build/release steps are documented in [Build and release](docs/BUILD-OTA.md). For a local frontend/backend session:

```powershell
# Terminal 1 — from the repository root
dotnet run --project .\backend\audexa-backend\audexa-backend.csproj

# Terminal 2 — from the repository root
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

The Backend applies EF Core migrations automatically on startup. The frontend development server runs on `http://localhost:5173`; the API defaults to `http://127.0.0.1:18080`.

## Local data

The Backend stores application data under `%APPDATA%\Audexa\`:

- `audexa.db` — SQLite database.
- `Audio\` — uploaded audio files.
- `Video\` — uploaded video files.
- `Logs\` — Backend JSONL logs.

The Media Agent stores its configuration and DPAPI-protected credential under `%APPDATA%\Audexa\MediaAgent\` for the Windows user that runs the Agent.

Back up this directory before manual maintenance. Do not store user data in the installation directory.

## License

No license has been specified yet.
