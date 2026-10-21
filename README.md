[English](README.md) | [Русский](README.ru.md)

# Audexa

**Desktop audio control and automation platform**

Audexa is a Windows desktop application for managing audio libraries and coordinating audio playback in rooms and zones. It is designed for exhibitions, museums, visitor centers, interactive installations, and other public spaces.

**You can install Audexa from a ready-to-use release or build it from source.**

<p>
  <a href="https://github.com/Vludd/audexa-desktop/releases/latest"><strong>Download the latest release</strong></a>
  ·
  <a href="https://github.com/Vludd/audexa-desktop/releases">All releases</a>
</p>

## Download and install

Audexa is distributed as a standalone Windows x64 desktop application. You do not need Git, Node.js, or the .NET SDK to install a published release.

1. Open the [latest GitHub Release](https://github.com/Vludd/audexa-desktop/releases/latest).
2. Under **Assets**, download `Audexa-Setup-<version>-x64.exe`.
3. Run the installer and follow its instructions.
4. Launch Audexa from the installed application or its shortcut.

The release may also provide a ZIP package for users who prefer an archive distribution. Use the installer for the standard installation.

### Updating Audexa

Audexa can check for official releases from inside the application. When an update is available, open **Settings → Audexa Updates**, check for updates, and select **Install update**.

You can also download the installer from a newer [GitHub Release](https://github.com/Vludd/audexa-desktop/releases) and run it manually.

> **Note:** Published builds are intended for Windows x64. Back up important application data before manual maintenance or troubleshooting.

## Features

- Audio library management: upload, browse, stream, rename, and delete audio files.
- Audio metadata extraction, including duration, sample rate, channel count, format, and file size.
- Local persistence with SQLite and audio files stored separately on disk.
- Desktop UI hosted by a C# shell using WebView2.
- In-app checks for official releases and installation of updates.
- HTTP Range support for audio streaming and seeking.

## Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/52c5dd8a-10b1-4498-ad73-faeeb2910eff" alt="Audexa dashboard" width="100%" />
</p>

<table>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/3533995e-054d-4679-a8b1-ad3b192eabae" alt="Rooms" width="100%" /></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/dac02966-d285-4457-a833-32df37f8c56b" alt="Scenarios" width="100%" /></td>
  </tr>
</table>

<details>
  <summary>More screenshots</summary>
  <br />
  <table>
    <tr>
      <td width="50%"><img src="https://github.com/user-attachments/assets/638e22c9-bdf2-410a-8ac4-9bc8fd10af11" alt="Schedule" width="100%" /></td>
      <td width="50%"><img src="https://github.com/user-attachments/assets/c1797f4b-b5c3-4814-813e-4f4c8b083377" alt="Audio files" width="100%" /></td>
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

Audexa runs locally on Windows. The React interface is hosted by the desktop shell, while the ASP.NET Core backend runs as a local process. The frontend communicates with the backend over HTTP/REST. The backend stores structured data in SQLite and audio files separately in the user's application data directory.

```text
┌───────────────────────────────────────────┐
│              Audexa Desktop               │
│          C# / WebView2 shell              │
│  ┌─────────────────────────────────────┐  │
│  │ React + TypeScript + Vite frontend  │  │
│  └──────────────────┬──────────────────┘  │
└─────────────────────┼─────────────────────┘
                      │ HTTP / REST
                      ▼
┌───────────────────────────────────────────┐
│         ASP.NET Core backend              │
│     Controllers · Services · EF Core      │
└─────────────────────┬─────────────────────┘
                      │
              ┌───────┴────────┐
              ▼                ▼
         SQLite database   Audio files
                           stored locally
```

The updater installs official application releases. The repository's GitHub Actions workflow handles release packaging.

## Repository layout

```text
audexa-desktop/
├── frontend/           # React, TypeScript, Vite UI
├── backend/            # ASP.NET Core API, EF Core, SQLite
├── desktop/            # Windows desktop shell and updater projects
├── scripts/            # Build and packaging scripts
└── .github/workflows/  # CI and release workflows
```

Exact subdirectories may evolve as the application develops.

## Tech stack

**Frontend**
- React, TypeScript, Vite
- TanStack Query
- Tailwind CSS and shadcn/ui

**Backend**
- .NET 8
- ASP.NET Core Web API
- Entity Framework Core 8
- SQLite
- NAudio

**Desktop and updates**
- C#
- WebView2
- Self-contained .NET publishing for Windows
- GitHub Releases for official release distribution

## Development

This section is for contributors who want to run or modify Audexa from source. These tools are **not required** to install a published release.

### Requirements

For local development on Windows:

- Git
- Node.js (LTS recommended)
- pnpm
- .NET 8 SDK
- WebView2 Runtime, if not already installed

Some desktop packaging workflows are Windows-specific.

### 1. Clone the monorepo

```powershell
git clone https://github.com/Vludd/audexa-desktop.git
cd audexa-desktop
```

### 2. Start the backend

Open a terminal at the repository root:

```powershell
cd backend
dotnet restore
dotnet build
dotnet run
```

The development API is configured to use:

```text
http://localhost:5081
```

Swagger UI is available at `http://localhost:5081/swagger` when the backend runs in the Development environment.

If database migrations need to be applied manually, install the EF Core CLI tool and run this from the backend project directory:

```powershell
dotnet ef database update
```

### 3. Start the frontend

In a second terminal, from the repository root:

```powershell
cd frontend
pnpm install
pnpm dev
```

Vite prints the local development URL in the terminal.

The frontend uses `http://localhost:5081` by default. To override the API address, create `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:5081
```

Restart Vite after changing environment variables. The backend CORS configuration must allow the frontend development origin.

### 4. Build and lint the frontend

From `frontend/`:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm lint
```

Available frontend scripts:

```powershell
pnpm dev       # Start the Vite development server
pnpm build     # Create a production build
pnpm preview   # Preview the production build locally
pnpm lint      # Run ESLint
pnpm format    # Format files with oxfmt
```

### 5. Build the backend

From `backend/`:

```powershell
dotnet restore
dotnet build
```

Run any test projects included in the checked-out revision before submitting changes.

### 6. Build the desktop application

The repository includes a PowerShell build script:

```powershell
.\scripts\build.ps1
```

Run it from the repository root. Check the script in the current revision for supported parameters and build outputs. The GitHub Actions release workflow is the reference for producing official release artifacts.

## Local data storage

The backend documentation describes the current audio-library storage convention as:

```text
%APPDATA%\Audexa\
├── audexa.db
└── Audio\
    └── <UUID-based audio files>
```

SQLite stores audio metadata; audio binaries are stored separately. UUID-based storage names avoid collisions when uploaded files have the same original filename.

> Back up the application data directory before manually changing files or testing recovery/update behavior. Do not assume that uninstalling or reinstalling preserves data unless that behavior has been explicitly verified.

## Audio library API

The current audio-library integration uses these endpoints:

| Operation | Method and endpoint |
|---|---|
| Health check | `GET /api/health` |
| List audio files | `GET /api/audio` |
| Get an audio file | `GET /api/audio/{id}` |
| Upload an audio file | `POST /api/audio/upload` |
| Stream audio | `GET /api/audio/{id}/stream` |
| Rename an audio file | `PUT /api/audio/{id}` |
| Delete an audio file | `DELETE /api/audio/{id}` |

Uploads use `multipart/form-data` with the field name `file`. The documented supported formats are MP3 and WAV, with a backend upload limit of 500 MB. Streaming supports HTTP Range Requests, allowing seeking without loading the entire file into memory.

## Releases

Official releases are published on [GitHub Releases](https://github.com/Vludd/audexa-desktop/releases). The release workflow packages the application and publishes release assets, including the Windows installer, ZIP package, and update metadata consumed by the in-app updater.

For release creation and troubleshooting, see `.github/workflows/release.yml` and the repository's scripts. When changing the updater, test successful installation, application relaunch, user-data preservation, and failure/rollback behavior.

## Development notes

- Keep frontend and backend API contracts aligned when changing audio-library behavior.
- Commit EF Core migration files when changing the database schema.
- Keep user data outside the application installation directory.
- Do not commit local databases, uploaded audio, secrets, or machine-specific configuration.
- Validate normal update installation and failure/rollback behavior when changing the updater.

## License

No license has been specified yet.
