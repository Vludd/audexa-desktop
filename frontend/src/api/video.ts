import { apiRequest, apiUrl } from "@/api/client"

export interface VideoFile {
  id: string
  name: string
  fileName: string
  storageFileName: string
  format: string
  size: number
  durationMs: number | null
  width: number | null
  height: number | null
  sha256: string
  createdAt: string
}

export interface UpdateVideoFileRequest {
  name: string
}

export const videoApi = {
  getAll(): Promise<VideoFile[]> {
    return apiRequest<VideoFile[]>("/api/video")
  },

  async upload(file: File): Promise<VideoFile> {
    const form = new FormData()
    form.append("file", file)
    return apiRequest<VideoFile>("/api/video/upload", {
      method: "POST",
      body: form,
      // Video uploads may exceed the default short API request timeout.
      signal: AbortSignal.timeout(30 * 60 * 1000),
    })
  },

  update(id: string, request: UpdateVideoFileRequest): Promise<VideoFile> {
    return apiRequest<VideoFile>(`/api/video/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
    })
  },

  delete(id: string): Promise<void> {
    return apiRequest<void>(`/api/video/${id}`, { method: "DELETE" })
  },

  getStreamUrl(id: string): string {
    return apiUrl(`/api/video/${id}/stream`)
  },
}
