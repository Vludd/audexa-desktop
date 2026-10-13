export type AudioSystemState =
  | "unconfigured"
  | "initializing"
  | "ready"
  | "degraded"
  | "disconnected"
  | "error"

export interface SystemStatus {
  state: AudioSystemState
  device: string | null
  deviceId: string | null
  online: boolean
  outputs: number
  availableOutputs: number
  mappedOutputs: number
  mappings: number
  sampleRate: number | null
  bufferSize: number | null
  engine: "stopped" | "starting" | "running" | "error"
  error: string | null
}
