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

export interface MediaHostPairingCreated {
  id: string
  pairingCode: string
  expiresAtUtc: string
}

export const mediaHostsApi = {
  getAll: () => apiRequest<MediaHost[]>("/api/media-hosts"),
  createPairing: (payload: { hostName: string; description?: string }) =>
    apiRequest<MediaHostPairingCreated>("/api/media-hosts/pairings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  rename: (hostId: string, name: string) =>
    apiRequest<void>(`/api/media-hosts/${hostId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  revoke: (hostId: string) =>
    apiRequest<void>(`/api/media-hosts/${hostId}`, {
      method: "DELETE",
    }),
  deleteRecord: (hostId: string) =>
    apiRequest<void>(`/api/media-hosts/${hostId}/record`, {
      method: "DELETE",
    }),
}

