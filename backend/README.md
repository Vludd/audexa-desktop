# Audexa Backend

Backend service for **Audexa** — a desktop audio control system for managing audio files, rooms, playback scenarios, and schedules.

The backend runs as a local ASP.NET Core process and provides a REST API for the React frontend.

## Tech Stack

- .NET 8
- ASP.NET Core Web API
- Entity Framework Core 8
- SQLite
- NAudio
- Swagger / OpenAPI

## Architecture

Audexa uses a local desktop architecture:

```text
┌─────────────────────────────┐
│       React Frontend        │
│   Vite + TypeScript         │
└──────────────┬──────────────┘
               │
          HTTP / REST
               │
               ▼
┌─────────────────────────────┐
│      Audexa Backend         │
│      ASP.NET Core           │
├─────────────────────────────┤
│ Controllers                 │
│ Services                    │
│ EF Core                     │
└──────────────┬──────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
    SQLite        Audio Files
     DB            AppData
```

The backend is designed to run locally alongside the desktop application and does not require an external database server.

## Project Structure

```text
audexa-backend/
├── Controllers/
│   ├── AudioFilesController.cs
│   └── HealthController.cs
├── Data/
│   └── AppDbContext.cs
├── DTOs/
│   └── AudioFiles/
│       ├── CreateAudioFileRequest.cs
│       ├── UpdateAudioFileRequest.cs
│       └── UploadAudioFileRequest.cs
├── Migrations/
│   └── ...
├── Models/
│   └── AudioFile.cs
├── Services/
│   ├── IAudioFileService.cs
│   └── AudioFileService.cs
├── Program.cs
├── appsettings.json
├── audexa-backend.csproj
└── audexa-backend.sln
```

## Requirements

- Windows
- .NET 8 SDK

Check the installed .NET version:

```powershell
dotnet --version
```

## Getting Started

### 1. Clone the repository

```powershell
git clone <repository-url>
cd audexa-backend
```

### 2. Restore dependencies

```powershell
dotnet restore
```

### 3. Build

```powershell
dotnet build
```

### 4. Apply database migrations

```powershell
dotnet ef database update
```

### 5. Run

```powershell
dotnet run
```

In the current development configuration, the API is available at:

```text
http://localhost:5081
```

Swagger UI:

```text
http://localhost:5081/swagger
```

## Database

Audexa uses SQLite.

The database is stored in:

```text
%APPDATA%\Audexa\audexa.db
```

For example:

```text
C:\Users\<User>\AppData\Roaming\Audexa\audexa.db
```

Entity Framework Core migrations are used to manage the database schema.

List migrations:

```powershell
dotnet ef migrations list
```

Create a migration:

```powershell
dotnet ef migrations add <MigrationName>
```

Apply migrations:

```powershell
dotnet ef database update
```

Remove the latest migration:

```powershell
dotnet ef migrations remove
```

Migration files are part of the source code and must be committed to Git.

## Audio Storage

Physical audio files are not stored inside SQLite.

They are stored in:

```text
%APPDATA%\Audexa\Audio\
```

Example:

```text
%APPDATA%
└── Audexa/
    ├── audexa.db
    └── Audio/
        ├── 4657b84b-2f6b-407f-9569-88efb8a5aab9.mp3
        └── ...
```

SQLite stores the audio metadata:

```text
AudioFile
├── Id
├── Name
├── FileName
├── StorageFileName
├── Format
├── Duration
├── Size
├── SampleRate
├── Channels
└── CreatedAt
```

`FileName` contains the original file name supplied by the user.

`StorageFileName` contains the internal UUID-based file name used on disk.

This prevents file name collisions when different files have the same original name.

## Audio Upload

Audio files are uploaded through:

```http
POST /api/audio/upload
```

Content type:

```text
multipart/form-data
```

Form field:

```text
file
```

Currently supported formats:

- WAV
- MP3

Maximum file size:

```text
500 MB
```

During upload, the backend:

1. Validates the file size.
2. Validates the file extension.
3. Generates a UUID.
4. Stores the file in `%APPDATA%\Audexa\Audio`.
5. Extracts audio metadata using NAudio.
6. Stores the metadata in SQLite.

Extracted metadata includes:

- duration;
- sample rate;
- channel count;
- file size;
- format.

## Audio Streaming

Audio files are streamed through:

```http
GET /api/audio/{id}/stream
```

The endpoint supports HTTP Range Requests, allowing:

- audio playback;
- seeking;
- rewinding and fast-forwarding;
- streaming without loading the entire file into memory.

## API

### Health

```http
GET /api/health
```

### Get all audio files

```http
GET /api/audio
```

### Get an audio file

```http
GET /api/audio/{id}
```

### Upload an audio file

```http
POST /api/audio/upload
```

### Stream an audio file

```http
GET /api/audio/{id}/stream
```

### Update an audio file

```http
PUT /api/audio/{id}
```

The current update operation changes the display name.

### Delete an audio file

```http
DELETE /api/audio/{id}
```

Deletion removes both the database record and the physical audio file.

## Development

```powershell
dotnet run
dotnet build
dotnet restore
```

Create a migration:

```powershell
dotnet ef migrations add <MigrationName>
```

Apply migrations:

```powershell
dotnet ef database update
```

## API Documentation

When running in the Development environment, Swagger UI is available at:

```text
http://localhost:5081/swagger
```

## Current Status

### Implemented

- [x] ASP.NET Core Web API
- [x] Health endpoint
- [x] CORS configuration
- [x] Entity Framework Core
- [x] SQLite
- [x] EF Core migrations
- [x] Audio file model
- [x] Audio file CRUD
- [x] Audio upload
- [x] Local audio file storage
- [x] UUID-based physical file names
- [x] Audio metadata extraction
- [x] MP3 support
- [x] WAV support
- [x] Audio streaming
- [x] HTTP Range support

### Planned

- [ ] Room management
- [ ] Scenario management
- [ ] Schedule management
- [ ] Audio file usage tracking
- [ ] Protection against deleting files used by rooms or scenarios
- [ ] SignalR integration
- [ ] Playback engine
- [ ] Audio device management
- [ ] Application logging
- [ ] Database relationships
- [ ] Production packaging

## Related Project

Audexa consists of several components:

```text
Audexa
├── audexa-frontend
│   └── React + Vite + TypeScript
├── audexa-backend
│   └── ASP.NET Core + SQLite
└── Desktop Shell
    └── C# + WebView2
```

The backend is designed to run as a local process alongside the desktop application.
