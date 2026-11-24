# Audexa — Build, Release, and OTA

This document describes the Windows build and release process implemented by the repository's PowerShell build script, Inno Setup definition, and GitHub Actions workflow.

## Build outputs

The repository produces these components:

| Component | Build output | Distribution |
|---|---|---|
| Frontend | `publish/frontend/` | Included in Desktop installer and OTA package |
| Backend | `publish/backend/` | Included in Desktop installer and OTA package |
| Desktop Shell | `publish/desktop/` | Included in Desktop installer and OTA package |
| Updater | `publish/updater/` | Included in Desktop installer and OTA package |
| Media Agent | `publish/media-agent/` | Separate Media Agent ZIP |

The Windows installer and OTA package contain the Desktop Shell, Frontend, Backend, and Updater. The Media Agent is packaged separately for installation on remote playback computers.

## Toolchain

The release workflow currently configures:

- Windows runner.
- Node.js 22.
- pnpm 11.15.1.
- .NET 8 SDK.
- Inno Setup 6.

For local builds, use the same major toolchain versions. WebView2 Runtime is required on machines running the desktop application if it is not already installed.

## Local build

Run from the repository root in PowerShell:

```powershell
.\scripts\build.ps1 -Version 1.2.3
```

The script:

1. Checks that pnpm and the frontend lockfile are available.
2. Runs `tests/Audexa.Updater.Tests` in Release configuration.
3. Installs frontend dependencies using `pnpm install --frozen-lockfile`.
4. Builds the Frontend into `frontend/dist`.
5. Publishes Backend, Desktop Shell, and Updater as self-contained `win-x64` applications.
6. Publishes Media Agent as a self-contained folder-based application (`PublishSingleFile=false`) to keep LibVLC native files available.
7. Copies the Agent example configuration and README into its publish directory.
8. Verifies that the expected executables and frontend entry point exist.

The result is written to `publish/`.

### Compile the Windows installer

After the build script completes, compile the installer from the repository root:

```powershell
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" /DAppVersion=1.2.3 "installer\Audexa.iss"
```

Use the same version in both commands. The installer is written to `artifacts/installer/`.

The Inno Setup definition includes the Desktop Shell, Frontend, Backend, and Updater. It does not install the Media Agent.

## GitHub release workflow

The workflow is `.github/workflows/release.yml` and is named **Build release**. It is started manually with a `MAJOR.MINOR.PATCH` version, for example `1.2.3`.

The workflow:

1. Checks out the repository and configures Node.js, pnpm, .NET, and Inno Setup.
2. Validates the version and rejects a version tag that already exists.
3. Runs `scripts/build.ps1`.
4. Creates the Desktop OTA archive `Audexa-Update-<version>-win-x64.zip`.
5. Creates the separate Agent archive `Audexa-MediaAgent-<version>-win-x64.zip`.
6. Compiles `Audexa-Setup-<version>-x64.exe`.
7. Generates `latest.json` with the release version, package URL, SHA-256 hash, and release notes.
8. Publishes the files as a GitHub Release tagged `v<version>`.

The release assets currently include:

- `Audexa-Setup-<version>-x64.exe`
- `Audexa-Update-<version>-win-x64.zip`
- `Audexa-MediaAgent-<version>-win-x64.zip`
- `latest.json`

The workflow builds the production Frontend but does not run the standalone `pnpm lint` command. Run lint separately when validating Frontend changes.

## OTA manifest

The application reads `latest.json`. Its required properties are:

- `version`
- `packageUrl`
- `sha256`
- `releaseNotes`

See [OTA manifest format](../ota/README.md) for the JSON example and URL constraints.

The Desktop Shell validates the manifest version, the official GitHub release URL pattern, and the SHA-256 value before starting the Updater.

## OTA package layout

The update ZIP is structured with `Audexa.Desktop.exe` at the archive root and the other components in their respective folders:

```text
Audexa-Update-<version>-win-x64.zip
├── Audexa.Desktop.exe
├── backend/
│   └── audexa-backend.exe
├── frontend/
│   └── index.html
└── updater/
    └── Audexa.Updater.exe
```

The update package does not contain the Media Agent. Agent updates are distributed as a separate ZIP and must be deployed to the remote playback hosts separately.

Do not include developer-local `appsettings.json`, credentials, pairing codes, local databases, or user media in release packages.

## Update and rollback behavior

The Desktop Shell downloads `latest.json`, checks that the advertised version is newer, validates the package URL and SHA-256 field, then starts `Audexa.Updater.exe`.

The Updater:

- downloads the update archive;
- validates the downloaded package hash;
- stages and validates archive contents and managed paths;
- creates a backup of the current installation before applying changes;
- applies the new files and updates its managed-file inventory;
- attempts to restore the previous installation if applying the update fails.

Persistent application data is stored under `%APPDATA%\Audexa\`, outside the installation directory, and must not be included in the OTA payload.

The updater has regression tests in `tests/Audexa.Updater.Tests/`. Run them before changing update transaction behavior:

```powershell
dotnet test .\tests\Audexa.Updater.Tests\Audexa.Updater.Tests.csproj -c Release
```

## Release verification checklist

- [ ] Build from a clean checkout using the documented toolchain.
- [ ] Confirm the build script completes its updater tests.
- [ ] Confirm the installer contains the Desktop Shell, Frontend, Backend, and Updater.
- [ ] Confirm the Media Agent ZIP contains its executable, native dependencies, and example configuration.
- [ ] Install on a clean Windows x64 test machine and launch Audexa.
- [ ] Confirm Backend health and Frontend connectivity.
- [ ] Pair a new Media Agent using a newly generated one-time code.
- [ ] Verify display discovery, SignalR connection, and playback operations.
- [ ] Verify the application update check and a successful OTA update.
- [ ] Verify SQLite data and media files remain intact after updating.
- [ ] Revoke a Media Host and verify that its old credential is rejected.
- [ ] Verify that a revoked Agent returns to first-run pairing.
- [ ] Test an update failure and verify rollback.

Do not publish a release until the relevant checks pass on a Windows test machine.
