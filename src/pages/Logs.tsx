import { useMemo, useState } from "react"

import type { LogEntry } from "@/types"
import Header from "@/components/Header"
import { t } from "@/i18n"
import LogsToolbar, { type LogFilter } from "@/components/logs/LogsToolbar"
import LogViewer from "@/components/logs/LogViewer"

interface Props {
  logs: LogEntry[]
  onClear?: () => void
}

export default function Logs({ logs, onClear }: Props) {
  const [filter, setFilter] = useState<LogFilter>("all")
  const [query, setQuery] = useState("")
  const [includeDebug, setIncludeDebug] = useState(false)

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return logs
      .filter((log) => {
        if (!includeDebug && filter === "all" && log.level === "DEBUG") {
          return false
        }

        const matchesLevel = filter === "all" || log.level === filter

        if (!matchesLevel) {
          return false
        }

        if (!normalizedQuery) {
          return true
        }

        return [
          log.message,
          log.event,
          log.source,
          JSON.stringify(log.context ?? {}),
        ].some((value) => value.toLowerCase().includes(normalizedQuery))
      })
      .reverse()
  }, [filter, includeDebug, logs, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title={t("pages.logs.title")}
        subtitle={t("pages.logs.subtitle")}
      />

      <LogsToolbar
        filter={filter}
        logs={logs}
        query={query}
        includeDebug={includeDebug}
        onQueryChange={setQuery}
        onFilterChange={setFilter}
        onIncludeDebugChange={setIncludeDebug}
        onClear={onClear}
      />

      <main className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <div className="min-h-0 flex-1">
          <LogViewer logs={filtered} />
        </div>

        <div className="shrink-0 text-xs text-muted-foreground">
          {t("pages.logs.records")}: {filtered.length} / {logs.length}
        </div>
      </main>
    </div>
  )
}
