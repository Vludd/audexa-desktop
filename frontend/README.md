# Audexa Frontend

React-интерфейс настольного приложения Audexa. В установленной версии он загружается Desktop Shell через WebView2; при разработке запускается отдельным Vite dev server.

## Tech stack

- React 19
- TypeScript
- Vite
- TanStack Query
- SignalR client
- Tailwind CSS 4
- Base UI and Lucide React

## Requirements

Use the toolchain versions configured by the repository release workflow:

- Node.js 22
- pnpm 11.15.1

From the `frontend/` directory, install dependencies:

```powershell
pnpm install --frozen-lockfile
```

## Development

Start the Vite server:

```powershell
pnpm dev
```

Vite listens on `http://localhost:5173` (`strictPort` is enabled). The server binds to `0.0.0.0`, so it is also reachable from other devices on the network unless restricted by the host firewall.

The Frontend API client defaults to:

```text
http://127.0.0.1:18080
```

To override the API base URL, create `frontend/.env.local`:

```dotenv
VITE_API_URL=http://127.0.0.1:18080
```

Restart Vite after changing environment variables. The Backend CORS policy must allow the origin from which the development UI is served. The current Backend configuration allows `http://localhost:5173`.

## Build and checks

Run from `frontend/`:

```powershell
pnpm build
pnpm lint
pnpm format
pnpm preview
```

Available scripts:

| Command | Purpose |
|---|---|
| `pnpm dev` | Start Vite development server |
| `pnpm build` | Create the production bundle in `dist/` |
| `pnpm preview` | Preview the production bundle |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format files with oxfmt |

The root `scripts/build.ps1` runs the frozen-lockfile install and production build as part of the complete Windows application build.

## Application integration

The Frontend communicates with the local Backend through HTTP APIs and SignalR. Current application areas include Dashboard, Rooms, Scenarios, Schedule, Audio Files, Settings, Logs, and Media Hosts.

The Frontend is not a standalone product build: the Windows Desktop Shell serves the generated `dist/` assets through WebView2 and starts the Backend process.

## Persistence notes

The Backend is the source of truth for rooms, scenarios, schedules, audio/video metadata, audio settings, and playback-related state. The Frontend also uses browser `localStorage` for selected UI preferences and frontend logs.

See [Settings and persistence inventory](docs/settings-persistence.md) for the verified list of settings, storage locations, and error behavior.
