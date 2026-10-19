import { apiRequest } from "@/api/client"

export type AudioTestMode = "voice" | "tone"

export interface AudioTestRequest {
  deviceId: string
  outputId: string
  mode: AudioTestMode
  durationMs: number
  volume: number
}

export interface AudioTestResponse {
  ok: boolean
  outputId: string
  message?: string
}

export const audioDiagnosticsApi = {
  async testOutput(request: AudioTestRequest) {
    return apiRequest<AudioTestResponse>(
      "/api/audio-diagnostics/test-output",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    )
  },

  async testOutputs(
    request: Omit<AudioTestRequest, "outputId"> & {
      outputIds: string[]
    },
  ) {
    return apiRequest<AudioTestResponse[]>(
      "/api/audio-diagnostics/test-outputs",
      {
        method: "POST",
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(60_000),
      },
    )
  },
}
