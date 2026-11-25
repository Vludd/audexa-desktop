import { apiRequest } from "@/api/client"

export interface PlaybackState {
  hostId: string
  displayKey: string
  state: string
  media: string | null
  positionMs: number
  durationMs: number
  volume: number
  isMuted: boolean
  error: string | null
  updatedAtUtc: string
}

export type PlaybackAction =
  | "play"
  | "pause"
  | "resume"
  | "stop"
  | "close"
  | "seek"
  | "volume"
  | "mute"

export interface PlaybackCommandPayload {
  action: PlaybackAction
  displayKey: string
  videoFileId?: string
  positionMs?: number
  volume?: number
  muted?: boolean
}

export interface PlaybackCommandUpdate {
  commandId: string
  hostId: string
  displayKey: string
  status: string
  error: string | null
}

export const mediaHostPlaybackApi = {
  command: (hostId: string, payload: PlaybackCommandPayload) =>
    apiRequest<{ commandId: string; status: string }>(
      `/api/media-hosts/${hostId}/playback`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
}
