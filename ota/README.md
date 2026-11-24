# OTA release manifest

The Desktop Shell reads `latest.json` to discover the latest Audexa update. The release workflow generates this file and publishes it alongside the update ZIP.

## Schema

```json
{
  "version": "1.2.3",
  "packageUrl": "https://github.com/Vludd/audexa-desktop/releases/download/v1.2.3/Audexa-Update-1.2.3-win-x64.zip",
  "sha256": "64-character-hexadecimal-SHA256-hash",
  "releaseNotes": "See the GitHub release notes."
}
```

| Property | Description |
|---|---|
| `version` | Release version in `MAJOR.MINOR.PATCH` format |
| `packageUrl` | HTTPS URL of the matching update ZIP in the official GitHub repository |
| `sha256` | SHA-256 hash of the exact update ZIP, represented as 64 hexadecimal characters |
| `releaseNotes` | Short release note or pointer to the GitHub release notes |

The property names are case-insensitive when deserialized by the application. The release workflow emits the lowercase names shown above.

## URL and package constraints

The current Desktop Shell and Updater accept update packages hosted at the official repository release path:

```text
https://github.com/Vludd/audexa-desktop/releases/download/v<version>/Audexa-Update-<version>-win-x64.zip
```

The release tag version and archive version must match. The Updater verifies the downloaded archive against `sha256` before applying it.

The update ZIP contains the Desktop Shell at its root and the `backend/`, `frontend/`, and `updater/` directories. The Media Agent is distributed separately and is not part of this OTA archive.

## Generation

The `.github/workflows/release.yml` workflow calculates the SHA-256 hash of the generated update ZIP and writes `latest.json`. Do not manually reuse a hash from a different build or archive.
