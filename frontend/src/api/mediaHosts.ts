import { apiRequest } from "@/api/client"

export interface DisplayDevice {
  id: string
  displayKey: string
  deviceName: string
  friendlyName: string
  width: number
  height: number
  refreshRate: number
  isPrimary: boolean
}

export interface MediaHost {
  id: string
  name: string
  machineName: string
  agentVersion: string
  status: "Online" | "Offline" | string
  ipAddress: string | null
  lastSeenAtUtc: string
  displays: DisplayDevice[]
}

export const mediaHostsApi = {
  getAll: () => apiRequest<MediaHost[]>("/api/media-hosts"),
}

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
  filePath?: string
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

export const playbackApi = {
  command: (hostId: string, payload: PlaybackCommandPayload) =>
    apiRequest<{ commandId: string; status: string }>(`/api/media-hosts/${hostId}/playback`, {
      method: "POST", body: JSON.stringify(payload),
    }),
}
