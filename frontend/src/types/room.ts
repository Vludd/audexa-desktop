import type { EntityId } from "./entity"

export type RoomStatus =
  | "idle"
  | "playing"
  | "paused"
  | "stopped"
  | "waiting"
  | "error"

export type RoomOperation =
  | "starting"
  | "stopping"
  | "pausing"

export interface Room {
  id: EntityId
  name: string
  status: RoomStatus
  operation?: RoomOperation
  volume: number
  position: number
  duration: number
}
