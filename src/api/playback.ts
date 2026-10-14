import { apiRequest } from "@/api/client"
import type { RoomStatus } from "@/types"

export interface PlaybackRoomState {
  roomId: string
  status: Exclude<RoomStatus, "idle" | "paused">
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
  status: "pending" | "playing" | "paused" | "waiting" | "finished" | "stopped" | "error"
  delayMs: number
  delayRemainingSeconds: number
  positionSeconds: number
  durationSeconds: number
  outputId: string | null
  error: string | null
}

export interface PlaybackState {
  status: "idle" | "starting" | "playing" | "paused" | "waiting" | "stopped" | "error"
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

export const playbackApi = {
  getState() {
    return apiRequest<PlaybackState>("/api/playback")
  },

  startScenario(id: string) {
    return apiRequest<PlaybackState>(`/api/playback/scenarios/${id}/start`, {
      method: "POST",
    })
  },

  pause() {
    return apiRequest<PlaybackState>("/api/playback/pause", { method: "POST" })
  },

  resume() {
    return apiRequest<PlaybackState>("/api/playback/resume", { method: "POST" })
  },

  stop() {
    return apiRequest<PlaybackState>("/api/playback/stop", {
      method: "POST",
    })
  },

  stopRoom(id: string) {
    return apiRequest<PlaybackState>(`/api/playback/rooms/${id}/stop`, {
      method: "POST",
    })
  },

  setRoomVolume(id: string, value: number) {
    return apiRequest<PlaybackState>(`/api/playback/rooms/${id}/volume`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    })
  },

  setAudioGain(id: string, value: number) {
    return apiRequest<PlaybackState>(`/api/playback/audio/${id}/gain`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    })
  },
}
