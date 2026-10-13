import type { EntityId } from "./entity"

export interface ScenarioStep {
  id: string
  roomId: EntityId
  roomName: string
  audioFileId: EntityId | null
  file: string
  delay: number
  duration: number
}

export type ScenarioStatus = "active" | "inactive"
export type ScenarioPlayMode = "sequential" | "parallel"
export type ScenarioRepeat = "once" | "loop"

export interface Scenario {
  id: string
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
