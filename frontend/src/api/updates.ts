import { apiRequest } from "@/api/client"

export interface UpdateCheckResponse {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseNotes: string
  packageUrl: string
  sha256: string
}

let cachedUpdate: UpdateCheckResponse | null = null
let pendingRequest: Promise<UpdateCheckResponse> | null = null

export const updatesApi = {
  check: async (force = false): Promise<UpdateCheckResponse> => {
    if (!force && cachedUpdate) {
      return cachedUpdate
    }

    if (!force && pendingRequest) {
      return pendingRequest
    }

    const request = apiRequest<UpdateCheckResponse>("/api/updates/check")
    pendingRequest = request

    try {
      const result = await request
      cachedUpdate = result
      return result
    } finally {
      if (pendingRequest === request) {
        pendingRequest = null
      }
    }
  },

  getCached: (): UpdateCheckResponse | null => cachedUpdate,

  invalidateCache: () => {
    cachedUpdate = null
  },
}