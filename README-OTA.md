# Audexa Desktop — Build and OTA

## Runtime layout
- Desktop shell: `Audexa.Desktop.exe`
- Frontend: `frontend/`
- Backend: `backend/`
- Updater: `updater/`
- Persistent application data, SQLite database, logs, media and Backend secrets: `%APPDATA%\Audexa`

The packaged Backend listens on TCP `18080` (REST API and SignalR) and UDP `18081` (Media Agent discovery). Discovery uses the shared Agent token and is intended for the same LAN broadcast domain.

## Production Backend configuration

The Desktop application creates `%APPDATA%\Audexa\backend-settings.json` on first launch and generates a cryptographically random 256-bit `MediaHosts.AgentToken`. If a legacy installation contains a valid `backend\appsettings.json`, Desktop migrates it to this persistent location. The file is outside the install directory and is not replaced by OTA updates.

To provision a Media Agent, copy `MediaHosts.AgentToken` from the Backend host's `backend-settings.json` into `MediaAgent.SharedToken` in the Agent machine's local `appsettings.json`. Never commit either file or include the token in release assets. The release build removes any developer-local Backend `appsettings.json` from the publish output.

## Build on Windows

Prerequisites: .NET 8 SDK, Node.js 22+, pnpm 11.15.1, Inno Setup 6 and WebView2 Runtime.

```powershell
.\scripts\build.ps1 -Version 1.1.0

& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" /DAppVersion=1.1.0 "installer\Audexa.iss"
```

The build script runs updater transaction regression tests, builds the frontend, and publishes Backend, Desktop and Updater with the same version.

## GitHub release

Run the `Build release` workflow manually and provide `1.1.0` as the version. The workflow validates that `v1.1.0` does not already exist, builds the payload, compiles the installer, generates `latest.json` with the SHA-256 of the update ZIP, and publishes the release assets.

## OTA behavior

The updater validates the release manifest and package hash, stages the archive, creates a backup of the current installation, applies the new files and writes `.audexa-managed-files.json`. The updater first launches an isolated bootstrap copy from `%TEMP%`, so the installed `updater/Audexa.Updater.exe` can also be replaced. If installation fails, the previous files, including the previous Updater executable, are restored from backup.

Legacy `backend/appsettings.json` is deliberately preserved during stale-file cleanup until Desktop has migrated it to `%APPDATA%\Audexa\backend-settings.json`.

## Release verification checklist

- [ ] Install 1.1.0 cleanly on a Windows test machine.
- [ ] Confirm the Backend settings file is created and contains a non-placeholder token.
- [ ] Configure the Media Agent with the same token and verify discovery, SignalR connection and video download.
- [ ] Verify the app version is 1.1.0 in Settings.
- [ ] Publish a later test version and verify OTA upgrade, including the Updater executable.
- [ ] Verify SQLite, audio files, video files and Backend settings survive OTA.
- [ ] Test a failed update and confirm rollback restores the previous installation.

Do not publish a release until these checks pass on Windows.
