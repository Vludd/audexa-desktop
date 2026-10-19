import type { AudioFile } from "@/types"
import { apiRequest, apiUrl } from "@/api/client"

interface BackendAudioFile {
  id: string
  name: string
  fileName: string
  storageFileName: string
  format: string
  duration: string
  size: number
  sampleRate: number
  channels: number
  volume: number
  volumeDb: number
  createdAt: string
}

export interface CreateAudioFileRequest {
  name: string
  fileName: string
  format: string
  duration: string
  size: number
  sampleRate: number
  channels: number
  volumeDb?: number
}

export interface UpdateAudioFileRequest {
  name: string
  volumeDb: number
}

function parseDuration(value: string): number {
  const parts = value.split(":")

  if (parts.length !== 3) {
    return 0
  }

  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  const seconds = Number(parts[2])

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return 0
  }

  return hours * 3600 + minutes * 60 + seconds
}

function mapAudioFile(
  file: BackendAudioFile,
): AudioFile {
  return {
    id: file.id,
    name: file.name,
    filename: file.fileName,
    format: file.format,
    sampleRate: file.sampleRate,
    channels: file.channels,
    duration: parseDuration(file.duration),
    size: file.size,
    volumeDb: file.volumeDb,
    createdAt: file.createdAt,
  }
}

export const audioApi = {
  async getAll(): Promise<AudioFile[]> {
    const files =
      await apiRequest<BackendAudioFile[]>(
        "/api/audio",
      )

    return files.map(mapAudioFile)
  },

  async getById(id: string): Promise<AudioFile> {
    const file =
      await apiRequest<BackendAudioFile>(
        `/api/audio/${id}`,
      )

    return mapAudioFile(file)
  },

  async create(
    request: CreateAudioFileRequest,
  ): Promise<AudioFile> {
    const file =
      await apiRequest<BackendAudioFile>(
        "/api/audio",
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      )

    return mapAudioFile(file)
  },

  async upload(file: File): Promise<AudioFile> {
    const formData = new FormData()

    formData.append("file", file)

    const uploadedFile =
      await apiRequest<BackendAudioFile>(
        "/api/audio/upload",
        {
          method: "POST",
          body: formData,
        },
      )

    return mapAudioFile(uploadedFile)
  },

  getStreamUrl(id: string): string {
    return apiUrl(`/api/audio/${id}/stream`)
  },

  async update(
    id: string,
    request: UpdateAudioFileRequest,
  ): Promise<AudioFile> {
    const file =
      await apiRequest<BackendAudioFile>(
        `/api/audio/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(request),
        },
      )

    return mapAudioFile(file)
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>(
      `/api/audio/${id}`,
      {
        method: "DELETE",
      },
    )
  },
}