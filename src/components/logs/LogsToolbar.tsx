import { Download, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { LogEntry } from "@/types"
import { exportLogs } from "@/lib/logger"
import { t, type TranslationKey } from "@/i18n"

export type LogFilter = "all" | "INFO" | "WARNING" | "ERROR"

interface Props {
  filter: LogFilter
  logs: LogEntry[]
  query: string
  includeDebug: boolean
  onQueryChange: (query: string) => void
  onFilterChange: (filter: LogFilter) => void
  onIncludeDebugChange: (include: boolean) => void
  // onRefresh?: () => void
  onExport?: () => void
  onClear?: () => void
}

const FILTERS: { value: LogFilter; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "logs.filters.all" },
  { value: "INFO", labelKey: "logs.filters.info" },
  { value: "WARNING", labelKey: "logs.filters.warning" },
  { value: "ERROR", labelKey: "logs.filters.error" },
]

const ACTIVE_CLASS: Record<LogFilter, string> = {
  all: "bg-primary text-primary-foreground",
  INFO: "bg-blue-600 text-white hover:bg-blue-700",
  WARNING: "bg-amber-500 text-white hover:bg-amber-600",
  ERROR: "bg-red-600 text-white hover:bg-red-700",
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}

export default function LogsToolbar({
  filter,
  logs,
  query,
  includeDebug,
  onQueryChange,
  onFilterChange,
  onIncludeDebugChange,
  // onRefresh,
  onExport,
  onClear,
}: Props) {
  const count = (level: LogFilter) => {
    if (level === "all") {
      return includeDebug
        ? logs.length
        : logs.filter((log) => log.level !== "DEBUG").length
    }

    return logs.filter((log) => log.level === level).length
  }

  const handleExport = () => {
    if (onExport) {
      onExport()
      return
    }

    const stamp = new Date().toISOString().replace(/:/g, "-")

    download(
      exportLogs("json"),
      `audexa-frontend-${stamp}.json`,
      "application/json;charset=utf-8",
    )
  }

  return (
    <div className="shrink-0 border-b bg-card px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 xl:max-w-[360px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("logs.filters.search")}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {FILTERS.map((item) => {
            const active = filter === item.value

            return (
              <Button
                key={item.value}
                variant={active ? "default" : "outline"}
                size="sm"
                className={active ? ACTIVE_CLASS[item.value] : ""}
                onClick={() => onFilterChange(item.value)}
              >
                {t(item.labelKey)} ({count(item.value)})
              </Button>
            )
          })}
        </div>

        <div className="ml-auto flex-1" />
{/* 
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-3.5" />
          {t("logs.filters.refresh")}
        </Button> */}

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-3.5" />
          {t("logs.filters.export")}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onClear}
        >
          <Trash2 className="size-3.5" />
          {t("logs.filters.clear")}
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-4 border-t pt-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("logs.filters.additional")}
        </span>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <input
            type="checkbox"
            checked={includeDebug}
            onChange={(event) =>
              onIncludeDebugChange(event.target.checked)
            }
            className="size-3.5 accent-primary"
          />

          <span>{t("logs.filters.includeDebug")}</span>
        </label>
      </div>
    </div>
  )
}