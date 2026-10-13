import { apiRequest } from "@/api/client"

export type AudioDeviceStatus = "online" | "offline"

export interface AudioChannel {
  id: string
  index: number
  name: string
  direction: "input" | "output"
}

export interface AudioDevice {
  id: string
  name: string
  type: string
  driver: string
  status: AudioDeviceStatus
  outputCount: number
  inputCount: number
  outputs: AudioChannel[]
  inputs: AudioChannel[]
  sampleRate: number | null
  bufferSize: number | null
}

interface AudioDevicesResponse {
  supported: boolean
  devices: AudioDevice[]
  error?: string | null
}

export const audioDevicesApi = {
  async getAll(): Promise<AudioDevicesResponse> {
    return apiRequest<AudioDevicesResponse>("/api/audio-devices")
  },
}
