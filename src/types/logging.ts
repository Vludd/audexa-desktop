export type LogLevel = "INFO" | "WARNING" | "ERROR" | "DEBUG"

export type LogSource = "APP" | "API" | "AUDIO" | "UI" | "NETWORK" | "SCHEDULE" | "SYSTEM"

export interface LogEntry {
  id: string
  timestamp: string
  time: string
  level: LogLevel
  source: LogSource
  event: string
  message: string
  context?: Record<string, unknown>
}
