export type ScheduleRepeat = "daily" | "weekly" | "once"
export type ScheduleStatus = "active" | "inactive"
export type Weekday =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun"

export interface ScheduleItem {
  id: number
  enabled: boolean
  time: string
  scenarioId: string
  scenarioName: string
  days: Weekday[]
  repeat: ScheduleRepeat
  executionDate: string | null
  lastTriggeredAt: string | null
  lastExecutionStatus: string | null
  nextRun: string
  status: ScheduleStatus
}

export interface ScheduleFormData {
  time: string
  scenarioId: string
  scenarioName: string
  days: Weekday[]
  repeat: ScheduleRepeat
  enabled: boolean
  executionDate: string | null
}
