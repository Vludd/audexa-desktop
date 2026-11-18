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
