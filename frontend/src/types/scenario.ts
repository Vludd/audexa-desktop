import type { EntityId } from "./entity"

export interface ScenarioStep {
  id: string
  roomId: EntityId
  roomName: string
  audioFileId: EntityId | null
  file: string
  delay: number
  duration: number
  translationAudioFileId: EntityId | null
  translationFile: string
  translationDuration: number
  videoFileId: EntityId | null
  videoName: string
  mediaHostId: EntityId | null
  mediaHostName: string
  displayKey: string | null
  videoAudioMode: "Muted" | "HostOutput" | "RoomOutput" | null
}

export type ScenarioStatus = "active" | "inactive"
export type ScenarioPlayMode = "sequential"
export type ScenarioRepeat = "once" | "loop"

export interface Scenario {
  id: string
  name: string
  description: string
  steps: ScenarioStep[]
  status: ScenarioStatus
  playMode: ScenarioPlayMode
  repeat: ScenarioRepeat
  stopPrevious: boolean
}
