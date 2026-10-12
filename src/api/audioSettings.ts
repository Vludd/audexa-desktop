import { apiRequest } from "@/api/client"

export interface AudioOutputMapping {
  roomId: string
  outputId: string | null
}

export interface AudioSettingsConfig {
  version: 1
  deviceId: string | null
  mappings: AudioOutputMapping[]
  translationOutputId: string | null
}

export const audioSettingsApi = {
  async get(): Promise<AudioSettingsConfig> {
    return apiRequest<AudioSettingsConfig>(
      "/api/settings/audio",
    )
  },

  async save(
    config: AudioSettingsConfig,
  ): Promise<AudioSettingsConfig> {
    return apiRequest<AudioSettingsConfig>(
      "/api/settings/audio",
      {
        method: "PUT",
        body: JSON.stringify(config),
      },
    )
  },
}