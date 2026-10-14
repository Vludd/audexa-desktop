import { apiRequest } from "@/api/client"

export interface PlaybackRoomState {
  roomId: string
  status: "playing" | "waiting" | "stopped" | "error"
  scenarioId: string | null
  scenarioName: string | null
  audioFileId: string | null
  audioFileName: string | null
  outputId: string | null
  step: number
  totalSteps: number
  positionSeconds: number
  durationSeconds: number
  error: string | null
}

export interface PlaybackState {
  status: "idle" | "starting" | "playing" | "waiting" | "stopped" | "error"
  scenarioId: string | null
  scenarioName: string | null
  currentStep: number
  totalSteps: number
  startedAt: string | null
  finishedAt: string | null
  rooms: PlaybackRoomState[]
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
}
