import { createContext } from "react"

import type { AudioDevice } from "@/api/audioDevices"
import type { AudioSettingsConfig } from "@/api/audioSettings"
import type { SystemStatus } from "@/types/system"

export interface AudioSystemContextValue {
  devices: AudioDevice[]
  supported: boolean
  config: AudioSettingsConfig | null
  selectedDevice: AudioDevice | null
  status: SystemStatus
  isLoading: boolean
  isSaving: boolean
  error: string | null
  refresh: () => Promise<void>
  saveConfig: (config: AudioSettingsConfig) => Promise<AudioSettingsConfig>
  selectDevice: (deviceId: string) => Promise<AudioSettingsConfig>
}

export const AudioSystemContext = createContext<AudioSystemContextValue | null>(
  null,
)
