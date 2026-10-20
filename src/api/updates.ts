import { apiRequest } from "@/api/client"

export interface UpdateCheckResponse {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseNotes: string
  packageUrl: string
  sha256: string
}

export const updatesApi = {
  check: () => apiRequest<UpdateCheckResponse>("/api/updates/check"),
}
