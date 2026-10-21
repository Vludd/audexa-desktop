import type { EntityId } from "./entity"

export interface AudioFile {
  id: EntityId
  name: string
  filename: string
  format: string
  sampleRate: number
  channels: number
  duration: number
  size: number
  volumeDb: number
  createdAt: string
}
