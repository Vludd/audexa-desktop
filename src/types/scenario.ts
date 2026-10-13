import type { EntityId } from "./entity"

export interface ScenarioStep {
  id: number
  roomId: EntityId
  roomName: string
  audioFileId: EntityId | null
  file: string
  volume: number
  delay: number
  duration: number
}

export type ScenarioStatus = "active" | "inactive"
export type ScenarioPlayMode = "sequential" | "parallel"
export type ScenarioRepeat = "once" | "loop"

export interface Scenario {
  id: number
  name: string
  description: string
  steps: ScenarioStep[]
  status: ScenarioStatus
  playMode: ScenarioPlayMode
  repeat: ScenarioRepeat
  autoStart: boolean
  stopPrevious: boolean
  syncTranslation: boolean
  crossfade: boolean
  notifications: boolean
}
