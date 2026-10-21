# Audexa settings and persistence inventory

This document records the persistence behavior verified in the current Frontend and Backend source.

| Setting / data | Source of truth | Storage / contract | Restored after restart | Notes |
|---|---|---|---|---|
| Selected audio device | Backend | SQLite `AudioConfiguration.DeviceId`; `GET/PUT /api/settings/audio` | Yes | The saved device remains configured when physically disconnected. |
| Room-to-output assignments | Backend | SQLite `OutputMapping`; included in `AudioSettingsDto.Mappings` | Yes | Multiple output mappings for one room are supported. A physical output is unique across rooms. |
| Translation output | Backend | SQLite `AudioConfiguration.TranslationOutputId`; `GET/PUT /api/settings/audio` | Yes | Must not conflict with a room output. |
| Room volume | Backend | SQLite `Room.Volume`; room API | Yes | Persistent room property, edited from the room/dashboard UI. |
| Audio-file gain / volume | Backend | SQLite `AudioFile.Volume` and `AudioFile.VolumeDb`; audio-file/playback APIs | Yes | `VolumeDb` is the current gain value used by the updated model; confirm all UI labels refer to the intended scale. |
| Scenario name and description | Backend | SQLite `Scenario`; scenarios API | Yes | Autosaved from the scenario editor when the scenario is valid for persistence. |
| Scenario enabled status, play mode, repeat and `StopPrevious` | Backend | SQLite `Scenario.Status`, `PlayMode`, `Repeat`, `StopPrevious`; scenarios API | Yes | These are supported fields in the current DTO and persistence model. |
| Scenario steps and delays | Backend | SQLite `ScenarioStep`; scenarios API | Yes | Delays are sent as milliseconds and represented as seconds in the Frontend. |
| Schedule configuration | Backend | SQLite `Schedule`; schedule API | Yes | Includes time, scenario, weekdays, repeat and enabled state. |
| Theme | Frontend | `localStorage` key `audexa-theme` | Yes, when browser storage is available | Values: `light`, `dark`, `system`. If storage is unavailable, the app uses system theme for the current session. |
| UI language | Frontend | `localStorage` key `audexa.locale` | Yes, when browser storage is available | Supported persistent values in the current selector: `ru`, `en`. |
| Frontend log threshold | Frontend | `localStorage` key `audexa.frontend.logging.settings.v1` | Yes, when browser storage is available | Values: `DEBUG`, `INFO`, `WARNING`, `ERROR`; default `INFO`. |
| Frontend log entries | Frontend | `localStorage` key `audexa.frontend.logs.v1` | Yes, when browser storage is available | Retention is limited by age, count and approximate storage size in `src/lib/logger.ts`. This is not a Backend/file log. |
| Settings page cache | Frontend cache only | `localStorage` key `audexa.settings.cache.v1` | Used for initial display, not authoritative | Contains cached audio device metadata and audio settings. Backend remains the source of truth. |
| Application startup / recovery toggles | Planned, not active | Displayed in Settings as disabled controls; no persistence or runtime behavior is wired yet | No | Intended for the future standalone desktop package. Keep disabled until startup/recovery behavior is implemented end-to-end. |
| `autoStart`, `syncTranslation`, `crossfade`, `notifications` scenario fields | Not supported by the scenario API contract | Removed from the Frontend scenario model | No | Do not reintroduce these as scenario settings without implementing them end-to-end. |

## Error behavior

- Browser storage reads/writes for theme and language must not prevent the application from running. Defaults remain active for the current session if storage is unavailable.
- Failure to save Backend-owned settings must remain visible to the user and must not be shown as success.
- Cached values are a convenience for initial display only; they must not overwrite a newer value returned by Backend.
- The UI must not claim logs are file-backed unless a real file persistence adapter is implemented.
