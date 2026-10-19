import type { LogEntry, LogLevel, LogSource } from "@/types"
import { formatTime as formatLocalizedTime, t } from "@/i18n"

const STORAGE_KEY = "audexa.frontend.logs.v1"
const SETTINGS_STORAGE_KEY = "audexa.frontend.logging.settings.v1"

const LOG_RETENTION_DAYS = 7
const MAX_LOGS = 2000
const MAX_LOG_STORAGE_BYTES = 2 * 1024 * 1024
const MAX_CONTEXT_CHARS = 12_000
const LOG_EMIT_DELAY_MS = 100
const LOG_PERSIST_DELAY_MS = 750
const LOG_RETENTION_MS = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000

type LogContext = Record<string, unknown>

type LogInput = {
  level: LogLevel
  source: LogSource
  event: string
  message: string
  context?: LogContext
}

export interface LoggingSettings {
  level: LogLevel
}

export type LogStorageInfo = {
  type: "localStorage"
  label: string
  description: string
}

const DEFAULT_LOGGING_SETTINGS: LoggingSettings = {
  level: "INFO",
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
}

let loggingSettings = loadLoggingSettings()
let entries: LogEntry[] = loadLogs()
let entriesSize = entries.reduce(
  (total, entry) => total + estimateEntryBytes(entry),
  0,
)
let pendingEntries: LogEntry[] = []
let pendingEntriesSize = 0
let emitTimer: ReturnType<typeof setTimeout> | undefined
let persistTimer: ReturnType<typeof setTimeout> | undefined
const loadedEntryCount = entries.length

const listeners = new Set<() => void>()
const settingsListeners = new Set<() => void>()

function isLogLevel(value: unknown): value is LogLevel {
  return (
    value === "DEBUG" ||
    value === "INFO" ||
    value === "WARNING" ||
    value === "ERROR"
  )
}

function loadLoggingSettings(): LoggingSettings {
  if (typeof window === "undefined") {
    return DEFAULT_LOGGING_SETTINGS
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)

    if (!raw) {
      return DEFAULT_LOGGING_SETTINGS
    }

    const parsed = JSON.parse(raw)

    if (parsed && typeof parsed === "object" && isLogLevel(parsed.level)) {
      return {
        level: parsed.level,
      }
    }
  } catch {
    // Fall back to defaults.
  }

  return DEFAULT_LOGGING_SETTINGS
}

function persistLoggingSettings() {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(loggingSettings),
    )
  } catch {
    // Logging settings must never break the application.
  }
}

function emitSettings() {
  settingsListeners.forEach((listener) => listener())
}

export function getLoggingSettings(): LoggingSettings {
  return loggingSettings
}

export function setLoggingLevel(level: LogLevel) {
  if (loggingSettings.level === level) {
    return
  }

  loggingSettings = {
    ...loggingSettings,
    level,
  }

  persistLoggingSettings()
  emitSettings()
}

export function subscribeLoggingSettings(listener: () => void) {
  settingsListeners.add(listener)

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SETTINGS_STORAGE_KEY) {
      return
    }

    loggingSettings = loadLoggingSettings()
    listener()
  }

  window.addEventListener("storage", handleStorage)

  return () => {
    settingsListeners.delete(listener)

    window.removeEventListener("storage", handleStorage)
  }
}

/**
 * Logs are currently persisted in browser localStorage.
 * Do not report a file path until a real file-backed logging adapter exists.
 */
export function getLogStorageInfo(): LogStorageInfo {
  return {
    type: "localStorage",
    label: t("settings.logging.storage.localStorage"),
    description: t("settings.logging.storage.localStorageDescription"),
  }
}

function shouldWrite(level: LogLevel) {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[loggingSettings.level]
}

function loadLogs(): LogEntry[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return cleanupLogs(parsed.filter(isLogEntry))
  } catch {
    return []
  }
}

function isLogEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== "object") {
    return false
  }

  const entry = value as Partial<LogEntry>

  return (
    typeof entry.id === "string" &&
    typeof entry.timestamp === "string" &&
    typeof entry.time === "string" &&
    isLogLevel(entry.level) &&
    typeof entry.source === "string" &&
    typeof entry.event === "string" &&
    typeof entry.message === "string"
  )
}

function cleanupLogs(logs: LogEntry[]): LogEntry[] {
  const cutoff = Date.now() - LOG_RETENTION_MS

  return logs
    .filter((entry) => {
      const timestamp = Date.parse(entry.timestamp)

      if (Number.isNaN(timestamp)) {
        return false
      }

      return timestamp >= cutoff
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(-MAX_LOGS)
}

function persist() {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Logging must never break the application
    // if localStorage is unavailable.
  }
}

function persistNow() {
  if (persistTimer !== undefined) {
    clearTimeout(persistTimer)
    persistTimer = undefined
  }
  persist()
}

function emit() {
  listeners.forEach((listener) => listener())
}

function estimateEntryBytes(entry: LogEntry) {
  return JSON.stringify(entry).length * 2
}

function trimEntries() {
  const cutoff = Date.now() - LOG_RETENTION_MS
  let firstRetainedIndex = 0

  while (firstRetainedIndex < entries.length) {
    const timestamp = Date.parse(entries[firstRetainedIndex].timestamp)
    const expired = Number.isNaN(timestamp) || timestamp < cutoff

    if (
      !expired &&
      entries.length - firstRetainedIndex <= MAX_LOGS &&
      entriesSize <= MAX_LOG_STORAGE_BYTES
    ) {
      break
    }

    entriesSize -= estimateEntryBytes(entries[firstRetainedIndex])
    firstRetainedIndex += 1
  }

  if (firstRetainedIndex > 0) {
    entries = entries.slice(firstRetainedIndex)
  }
}

trimEntries()
if (entries.length !== loadedEntryCount) {
  persist()
}

function flushPendingEntries() {
  if (emitTimer !== undefined) {
    clearTimeout(emitTimer)
    emitTimer = undefined
  }

  if (pendingEntries.length === 0) {
    return
  }

  entries = entries.concat(pendingEntries)
  entriesSize += pendingEntriesSize
  pendingEntries = []
  pendingEntriesSize = 0
  trimEntries()
  emit()

  if (persistTimer === undefined) {
    persistTimer = setTimeout(() => {
      persistTimer = undefined
      persist()
    }, LOG_PERSIST_DELAY_MS)
  }
}

function scheduleLogFlush() {
  if (emitTimer === undefined) {
    emitTimer = setTimeout(flushPendingEntries, LOG_EMIT_DELAY_MS)
  }
}

function flushLogs() {
  flushPendingEntries()
  persistNow()
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushLogs)
}

function formatTime(timestamp: Date) {
  return formatLocalizedTime(timestamp)
}

function sanitizeContext(context?: LogContext) {
  if (!context) {
    return undefined
  }

  try {
    const serialized = JSON.stringify(context)

    if (serialized.length <= MAX_CONTEXT_CHARS) {
      return context
    }

    return {
      truncated: true,
      preview: serialized.slice(0, MAX_CONTEXT_CHARS),
    }
  } catch {
    return {
      serializationError: t("logs.messages.contextSerializationError"),
    }
  }
}

function write(input: LogInput) {
  /*
   * Log level is a recording threshold.
   *
   * DEBUG   -> DEBUG + INFO + WARNING + ERROR
   * INFO    -> INFO + WARNING + ERROR
   * WARNING -> WARNING + ERROR
   * ERROR   -> ERROR
   */

  if (!shouldWrite(input.level)) {
    return undefined
  }

  const now = new Date()

  const entry: LogEntry = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,

    timestamp: now.toISOString(),

    time: formatTime(now),

    level: input.level,

    source: input.source,

    event: input.event,

    message: input.message,

    context: sanitizeContext(input.context),
  }

  pendingEntries.push(entry)
  pendingEntriesSize += estimateEntryBytes(entry)
  scheduleLogFlush()

  return entry
}

export const logger = {
  debug(
    source: LogSource,
    event: string,
    message: string,
    context?: LogContext,
  ) {
    return write({
      level: "DEBUG",
      source,
      event,
      message,
      context,
    })
  },

  info(
    source: LogSource,
    event: string,
    message: string,
    context?: LogContext,
  ) {
    return write({
      level: "INFO",
      source,
      event,
      message,
      context,
    })
  },

  warn(
    source: LogSource,
    event: string,
    message: string,
    context?: LogContext,
  ) {
    return write({
      level: "WARNING",
      source,
      event,
      message,
      context,
    })
  },

  error(
    source: LogSource,
    event: string,
    message: string,
    context?: LogContext,
  ) {
    return write({
      level: "ERROR",
      source,
      event,
      message,
      context,
    })
  },
}

export function getLogs() {
  return entries
}

export function clearLogs() {
  pendingEntries = []
  pendingEntriesSize = 0

  if (emitTimer !== undefined) {
    clearTimeout(emitTimer)
    emitTimer = undefined
  }

  entries = []
  entriesSize = 0

  persistNow()
  emit()
}

export function removeLog(id: string) {
  flushPendingEntries()
  entries = entries.filter((entry) => entry.id !== id)
  entriesSize = entries.reduce(
    (total, entry) => total + estimateEntryBytes(entry),
    0,
  )

  persistNow()
  emit()
}

export function subscribeLogs(listener: () => void) {
  listeners.add(listener)

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) {
      return
    }

    entries = loadLogs()
    entriesSize = entries.reduce(
      (total, entry) => total + estimateEntryBytes(entry),
      0,
    )

    listener()
  }

  window.addEventListener("storage", handleStorage)

  return () => {
    listeners.delete(listener)

    window.removeEventListener("storage", handleStorage)
  }
}

export function exportLogs(format: "json" | "csv" | "txt" = "json") {
  const logs = pendingEntries.length ? entries.concat(pendingEntries) : entries

  if (format === "json") {
    return JSON.stringify(logs, null, 2)
  }

  if (format === "txt") {
    return logs
      .map(
        (entry) =>
          `${entry.timestamp} [${entry.level}] [${entry.source}] ${entry.event}: ${entry.message}`,
      )
      .join("\n")
  }

  const header = "timestamp,time,level,source,event,message"

  const rows = logs.map((entry) =>
    [
      entry.timestamp,
      entry.time,
      entry.level,
      entry.source,
      entry.event,
      entry.message,
    ]
      .map(csvEscape)
      .join(","),
  )

  return [header, ...rows].join("\n")
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}
