import { apiRequest } from "@/api/client"
import type { RoomStatus } from "@/types"

export type PlaybackStatus =
  | "idle"
  | "starting"
  | "playing"
  | "paused"
  | "waiting"
  | "stopped"
  | "error"

export type PlaybackStepStatus =
  | "pending"
  | "playing"
  | "paused"
  | "waiting"
  | "finished"
  | "stopped"
  | "error"

export interface PlaybackRoomState {
  roomId: string
  status: RoomStatus
  scenarioId: string | null
  scenarioName: string | null
  audioFileId: string | null
  audioFileName: string | null
  outputId: string | null
  step: number
  totalSteps: number
  positionSeconds: number
  durationSeconds: number
  volume: number
  audioGainDb: number
  error: string | null
}

export interface PlaybackStepState {
  step: number
  roomId: string
  roomName: string
  audioFileId: string
  audioFileName: string
  status: PlaybackStepStatus
  delayMs: number
  delayRemainingSeconds: number
  positionSeconds: number
  durationSeconds: number
  outputId: string | null
  error: string | null
}

export interface PlaybackState {
  status: PlaybackStatus
  scenarioId: string | null
  scenarioName: string | null
  currentStep: number
  nextStep: number | null
  totalSteps: number
  startedAt: string | null
  finishedAt: string | null
  rooms: PlaybackRoomState[]
  steps: PlaybackStepState[]
  error: string | null
}

export interface PlaybackSession {
  sessionId: string
  state: PlaybackState
}

const PLAYBACK_STATUSES = new Set<PlaybackStatus>([
  "idle", "starting", "playing", "paused", "waiting", "stopped", "error",
])
const ROOM_STATUSES = new Set<RoomStatus>([
  "idle", "playing", "paused", "stopped", "waiting", "error",
])
const STEP_STATUSES = new Set<PlaybackStepStatus>([
  "pending", "playing", "paused", "waiting", "finished", "stopped", "error",
])

function assertPlaybackState(value: PlaybackState): PlaybackState {
  if (!value || !PLAYBACK_STATUSES.has(value.status)) {
    throw new Error(`Неизвестный статус воспроизведения: ${String(value?.status)}`)
  }

  for (const room of value.rooms ?? []) {
    if (!ROOM_STATUSES.has(room.status)) {
      throw new Error(`Неизвестный статус комнаты ${room.roomId}: ${String(room.status)}`)
    }
  }

  for (const step of value.steps ?? []) {
    if (!STEP_STATUSES.has(step.status)) {
      throw new Error(`Неизвестный статус шага ${step.step}: ${String(step.status)}`)
    }
  }

  return value
}

async function requestPlaybackState(
  path: string,
  init?: RequestInit,
): Promise<PlaybackState> {
  return assertPlaybackState(await apiRequest<PlaybackState>(path, init))
}

export const playbackApi = {
  getState() {
    return requestPlaybackState("/api/playback")
  },

  async getSessions(): Promise<PlaybackSession[]> {
    const sessions = await apiRequest<PlaybackSession[]>("/api/playback/sessions")
    return sessions.map((session) => ({ ...session, state: assertPlaybackState(session.state) }))
  },

  startScenario(id: string) {
    return requestPlaybackState(`/api/playback/scenarios/${id}/start`, {
      method: "POST",
    })
  },

  pause() {
    return requestPlaybackState("/api/playback/pause", { method: "POST" })
  },

  pauseSession(sessionId: string) {
    return apiRequest<PlaybackSession[]>(`/api/playback/sessions/${sessionId}/pause`, { method: "POST" })
  },

  resume() {
    return requestPlaybackState("/api/playback/resume", { method: "POST" })
  },

  resumeSession(sessionId: string) {
    return apiRequest<PlaybackSession[]>(`/api/playback/sessions/${sessionId}/resume`, { method: "POST" })
  },

  stop() {
    return requestPlaybackState("/api/playback/stop", { method: "POST" })
  },

  stopSession(sessionId: string) {
    return apiRequest<PlaybackSession[]>(`/api/playback/sessions/${sessionId}/stop`, { method: "POST" })
  },

  skipStep(roomId: string) {
    return requestPlaybackState(`/api/playback/steps/${roomId}/skip`, {
      method: "POST",
    })
  },

  setRoomVolume(id: string, value: number) {
    return requestPlaybackState(`/api/playback/rooms/${id}/volume`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    })
  },

  setAudioGain(id: string, value: number) {
    return requestPlaybackState(`/api/playback/audio/${id}/gain`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    })
  },
}
