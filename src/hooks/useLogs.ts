import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"

import {
  clearLogs as clearStoredLogs,
  getLogs,
  logger,
  removeLog as removeStoredLog,
  subscribeLogs,
} from "@/lib/logger"
import { apiRequest } from "@/api/client"
import type { LogEntry } from "@/types"

export function useLogs() {
  const localLogs = useSyncExternalStore(subscribeLogs, getLogs, getLogs)
  const [backendLogs, setBackendLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    let disposed = false
    let requestInFlight = false

    const refreshBackendLogs = async () => {
      if (requestInFlight) return
      requestInFlight = true
      try {
        const records = await apiRequest<LogEntry[]>("/api/logs?limit=1000")
        if (!disposed) setBackendLogs(records)
      } catch {
        // apiRequest already records connection/HTTP failures in the frontend log.
      } finally {
        requestInFlight = false
      }
    }

    void refreshBackendLogs()
    const interval = window.setInterval(() => void refreshBackendLogs(), 5000)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [])

  const logs = useMemo(() => {
    const merged = new Map<string, LogEntry>()
    for (const entry of backendLogs) merged.set(`backend:${entry.id}`, entry)
    for (const entry of localLogs) merged.set(`frontend:${entry.id}`, entry)
    return [...merged.values()].sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
    )
  }, [backendLogs, localLogs])

  const addLog = useCallback(
    (...args: Parameters<typeof logger.info>) => logger.info(...args),
    [],
  )

  const removeLog = useCallback((id: string) => {
    removeStoredLog(id)
  }, [])

  const clearLogs = useCallback(() => {
    clearStoredLogs()
    void apiRequest<void>("/api/logs", { method: "DELETE" })
      .then(() => setBackendLogs([]))
      .catch(() => {
        logger.warn("API", "logs.backend_clear_failed", "Не удалось очистить журнал Backend")
      })
  }, [])

  return { logs, addLog, removeLog, clearLogs }
}
