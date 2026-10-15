import { apiRequest } from "@/api/client"
import type { SystemStatus } from "@/types/system"

export interface BackendSystemStatus extends Omit<SystemStatus, "lastUpdated"> {
  lastUpdated: string
}

export const audioSystemApi = {
  getStatus(): Promise<BackendSystemStatus> {
    return apiRequest<BackendSystemStatus>("/api/audio-system/status")
  },
}
