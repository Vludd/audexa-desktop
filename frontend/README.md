# Audexa

**Audio automation and control platform**

Audexa is a platform for managing audio playback, scenarios, schedules and audio zones in interactive installations, exhibitions, museums, visitor centers and other public spaces.

## Screenshots

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/8155be7a-92af-4478-91b4-10b350f46b4f"
    alt="Audexa Dashboard"
    width="100%"
  />
</p>

<table>
<tr>
<td width="50%">
  <img
    src="https://github.com/user-attachments/assets/8a917637-6464-4e51-bf5f-94958a666c0e"
    alt="Rooms"
    width="100%"
  />
</td>
<td width="50%">
  <img
    src="https://github.com/user-attachments/assets/dbc5634c-a7d7-4323-a0c5-49499ec4b301"
    alt="Scenarios"
    width="100%"
  />
</td>
</tr>

</table>

<details>
<summary>More screenshots</summary>

<br>

<table>

<tr>
<td width="50%">
  <img
    src="https://github.com/user-attachments/assets/87d1ce4d-efdd-462b-b52a-18368566cb82"
    alt="Scheduler"
    width="100%"
  />
</td>
<td width="50%">
  <img
    src="https://github.com/user-attachments/assets/e227bafd-f639-473d-91ad-fb56ed769cde"
    alt="Audio Files"
    width="100%"
  />
</td>
</tr>

<tr>
<td width="50%">
  <img
    src="https://github.com/user-attachments/assets/a08a9be1-74f4-44f6-8b61-40fd347a25a8"
    alt="Settings"
    width="100%"
  />
</td>
<td width="50%">
  <img
    src="https://github.com/user-attachments/assets/cc6c9c9b-1224-4dd5-84c9-63fcd5e68e05"
    alt="Logs"
    width="100%"
  />
</td>
</tr>

<tr>
<td width="50%">
  <img
    src="https://github.com/user-attachments/assets/30608a77-73a4-4eb8-880a-66975b32148a"
    alt="Logs"
    width="100%"
  />
</td>
</tr>

</table>

</details>

## Current status

The frontend is under active development. The **Audio Files** page is connected to the [Audexa backend](https://github.com/Vludd/audexa-backend) for listing, uploading, streaming, renaming, and deleting audio files. Other application areas are UI prototypes and are not yet backed by the API.

The backend currently provides a local REST API for audio file management. Room management, scenarios, schedules, playback engine controls, and other system features are planned in the backend and are not yet integrated with this frontend.

## Tech stack

* React, TypeScript, and Vite
* TanStack Query for API-backed audio library state
* ASP.NET Core Web API and SQLite in the [backend repository](https://github.com/Vludd/audexa-backend)

## Getting started

### Frontend

Requirements: Node.js and pnpm.

```sh
pnpm install
pnpm dev
```

Vite prints the local development URL when the server starts.

### Backend

The frontend expects the backend at `http://localhost:5081` by default. In a separate terminal, follow the setup instructions in the [backend README](https://github.com/Vludd/audexa-backend#readme); the short version is:

```sh
git clone https://github.com/Vludd/audexa-backend.git
cd audexa-backend
dotnet restore
dotnet ef database update
dotnet run
```

The backend README documents database migration setup and requirements. Its Swagger UI is available at `http://localhost:5081/swagger` while the backend is running in Development.

To use a different API address, create a `.env.local` file in the frontend project root:

```dotenv
VITE_API_URL=http://localhost:5081
```

Restart the Vite server after changing environment variables. The backend must allow requests from the frontend's development origin through its CORS configuration.

## Audio Files API integration

The frontend calls these backend endpoints:

| Operation | Endpoint |
| --- | --- |
| List audio files | `GET /api/audio` |
| Upload a file | `POST /api/audio/upload` (`multipart/form-data`, field `file`) |
| Stream playback | `GET /api/audio/{id}/stream` |
| Rename a file | `PUT /api/audio/{id}` |
| Delete a file | `DELETE /api/audio/{id}` |

Uploads are limited in the UI to MP3 and WAV files. The backend README documents a 500 MB upload limit. Audio is stored by the backend on the local machine; metadata is kept in SQLite. Playback streams from the backend and supports seeking through HTTP Range Requests.

## Available scripts

```sh
pnpm dev       # Start the Vite development server
pnpm build     # Create a production build
pnpm preview   # Preview the production build locally
pnpm lint      # Run ESLint
pnpm format    # Format files with oxfmt
```

## License

TBD
