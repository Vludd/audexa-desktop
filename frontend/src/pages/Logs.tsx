import { useMemo, useState } from "react"

import type { LogEntry } from "@/types"
import Header from "@/components/Header"
import { t } from "@/i18n"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { useConfirm } from "@/hooks/useConfirm"
import LogsToolbar, { type LogFilter } from "@/components/logs/LogsToolbar"
import LogViewer from "@/components/logs/LogViewer"

interface Props {
  logs: LogEntry[]
  onClear?: () => void
}

export default function Logs({ logs, onClear }: Props) {
  const [filter, setFilter] = useState<LogFilter>("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [includeDebug, setIncludeDebug] = useState(true)
  const confirmation = useConfirm()

  const handleClear = () => {
    if (!onClear) {
      return
    }

    confirmation.confirm({
      title: t("logs.confirmClear.title"),
      description: t("logs.confirmClear.description"),
      confirmLabel: t("logs.filters.clear"),
      variant: "destructive",
      onConfirm: onClear,
    })
  }

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

        if (sourceFilter !== "all" && log.source !== sourceFilter) {
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
  }, [filter, includeDebug, logs, query, sourceFilter])

  const handleExport = () => {
    const stamp = new Date().toISOString().replace(/:/g, "-")
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `audexa-logs-${stamp}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title={t("pages.logs.title")}
        subtitle={t("pages.logs.subtitle")}
      />

      <LogsToolbar
        filter={filter}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        logs={logs}
        query={query}
        includeDebug={includeDebug}
        onQueryChange={setQuery}
        onFilterChange={setFilter}
        onIncludeDebugChange={setIncludeDebug}
        onClear={handleClear}
        onExport={handleExport}
      />

      <main className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <div className="min-h-0 flex-1">
          <LogViewer logs={filtered} />
        </div>

        <div className="shrink-0 text-xs text-muted-foreground">
          {t("pages.logs.records")}: {filtered.length} / {logs.length}
        </div>
      </main>

      <ConfirmDialog
        open={confirmation.open}
        onOpenChange={(open) => {
          if (!open) confirmation.close()
        }}
        title={confirmation.options?.title ?? ""}
        description={confirmation.options?.description}
        confirmLabel={confirmation.options?.confirmLabel}
        variant={confirmation.options?.variant}
        loading={confirmation.loading}
        onConfirm={confirmation.handleConfirm}
      />
    </div>
  )
}
