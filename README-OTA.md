# Audexa Desktop + OTA starter

This starter includes the supplied frontend/backend sources plus a first-pass Windows Desktop Shell, updater, Inno Setup script and GitHub Actions release workflow.

## Decisions
- Per-user install under `%LOCALAPPDATA%\Programs\Audexa`; no elevation required.
- Persistent DB/logs remain in `%APPDATA%\Audexa`.
- Backend binds to `127.0.0.1:5081`.
- Frontend is served from WebView2 virtual host `https://appassets.audexa/`.
- Manual install: checks for a release at launch and offers a button-driven update.
- Update ZIP SHA-256 is checked before staging.

## Required configuration
1. In `desktop/Audexa.Desktop/MainForm` (currently in `Program.cs`), replace `OWNER/REPO` in `ManifestUrl` with the actual GitHub repository.
2. Set the release version consistently in the Desktop project assembly version and Inno Setup version.
3. Make GitHub repository public or configure authenticated private-release access (the current updater assumes public HTTPS downloads).
4. Ensure the ZIP has a single, consistent root layout. Do not publish this draft to users before completing the security checklist below.

## Build on Windows
Prerequisites: .NET 8 SDK, Node.js 22+, Inno Setup 6, WebView2 Runtime (typically present on current Windows 10/11; bundle/validate if needed).

```powershell
./scripts/build.ps1
iscc installer/Audexa.iss
```

The current script prepares payloads; it is a scaffold, not a verified production installer. Run and test on a clean Windows VM.

## Important limitations before production
- Replace placeholder GitHub owner/repository and version plumbing.
- Sign binaries/installer with Authenticode and verify signature in updater. SHA-256 alone is not publisher authentication.
- Add safe ZIP-entry validation **before extraction** (the current sample validates after extraction and must not be used as a security boundary).
- Implement rollback for newly created files and removed/renamed files; the current backup logic only restores overwritten files.
- Fix release ZIP layout to have one `publish/` payload root matching the install layout; current workflow packaging is an initial draft and needs smoke-testing.
- Add download progress/cancellation and structured updater logs.
- Test active playback shutdown, interrupted download, locked files, no disk space, malformed manifest, invalid hash, corrupt ZIP and rollback.
- Add a signed manifest or verify the release asset's Authenticode signature; never trust an unsigned manifest from a compromised release channel.
- Add a robust singleton/port ownership strategy before binding localhost, to avoid collisions with another local process.
- Review backend CORS/host restrictions and confirm WebView2 requests work under the virtual host origin.
