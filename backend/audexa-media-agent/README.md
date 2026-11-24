# Audexa Media Agent

Media Agent is a separate Windows process installed on a playback computer. It runs in the interactive Windows user session, enumerates the host's displays, connects to Audexa Backend, and controls playback on those displays.

The Agent is distributed separately from the Audexa Desktop installer.

## Requirements

- Windows x64.
- .NET 8 runtime is included in the self-contained release package.
- The Agent must run in the interactive Windows user session; it is not designed to run as a Windows Service in Session 0.

The Agent uses LibVLC. Its release is published as a folder-based self-contained application rather than a single-file executable so native libraries and plugins remain available beside the executable.

## Install and first pairing

1. Download `Audexa-MediaAgent-<version>-win-x64.zip` from the [Audexa GitHub release](https://github.com/Vludd/audexa-desktop/releases).
2. Extract the archive to a stable local directory on the playback computer.
3. In Audexa Desktop, open **Media Hosts** and create a pairing invitation using **Подключить агент**.
4. Enter a descriptive host name and create the invitation. The code is valid for five minutes and can be used once.
5. Start `Audexa.MediaAgent.exe` on the playback computer.
6. The Agent attempts to discover the Backend using UDP broadcast. If discovery does not work, enter the Backend URL manually (for example, `http://192.168.1.10:18080`).
7. Enter the one-time pairing code in the Agent setup window.

After successful pairing, the Agent stores its Backend URL, Media Host ID, and hub path under `%APPDATA%\Audexa\MediaAgent\`. The device credential is stored separately in `credentials.dpapi` and protected with Windows DPAPI (`CurrentUser`).

**Run the Agent under the same Windows user account after pairing.** DPAPI CurrentUser-protected credentials cannot be moved to another Windows account by copying the files.

## Network

| Purpose | Protocol | Default port |
|---|---:|---:|
| Backend HTTP API and SignalR | TCP | `18080` |
| Backend discovery | UDP | `18081` |

UDP broadcast discovery does not cross VLANs or routed network boundaries. When the Agent is on another subnet, enter the Backend URL manually and ensure the required TCP route and firewall rules are in place.

Discovery only provides a candidate Backend address; it does not authenticate the Backend.

## Credential lifecycle and recovery

- Pairing invitations expire after five minutes and are single-use.
- Each paired Media Host receives an individual credential. There is no shared token intended for all Agents.
- On startup, the Agent validates its saved credential before opening its SignalR connection.
- If the Backend is temporarily unreachable, the Agent retains its local pairing data and retries. A network outage must not be treated as credential revocation.
- If the Backend reports that the credential is invalid, revoked, or the host record no longer exists, the Agent clears its saved pairing state and returns to first-run pairing.
- If an administrator revokes a connected host, the Agent receives a revocation event and clears its local pairing state.

To pair a revoked or removed host again, create a new invitation in Audexa and complete the pairing steps above.

## Local files

The current user's roaming application data directory contains:

```text
%APPDATA%\Audexa\MediaAgent\
├── config.json
└── credentials.dpapi
```

- `config.json` contains the Backend URL, Media Host ID, and SignalR hub path.
- `credentials.dpapi` contains the DPAPI-protected device credential.

Do not copy these files to another computer or Windows account. Do not publish or share `credentials.dpapi`.

## Build and publish from source

Run from the repository root:

```powershell
dotnet restore .\backend\audexa-media-agent\Audexa.MediaAgent.csproj

dotnet publish .\backend\audexa-media-agent\Audexa.MediaAgent.csproj `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=false `
  -o .\publish\media-agent
```

Keep `PublishSingleFile=false`: LibVLC native libraries and plugins must remain available as files alongside the Agent executable.

The complete release build is orchestrated by `scripts/build.ps1`. It publishes the Agent into `publish/media-agent`, copies `appsettings.example.json` and this README, and the release workflow packages the folder as `Audexa-MediaAgent-<version>-win-x64.zip`.

## Security

The current Backend/Agent transport uses HTTP. Pairing codes and device credentials can be observed by an attacker who can monitor an untrusted network path. Use the initial implementation only on a trusted LAN. Before deploying across untrusted networks, implement HTTPS with trusted certificate validation or certificate pinning.

Do not distribute developer-local `appsettings.json` files. The release package intentionally contains `appsettings.example.json`, not machine-specific configuration or credentials.
