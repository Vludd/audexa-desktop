import { Download, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LogEntry } from "@/types"
import { exportLogs } from "@/lib/logger"
import { t, type TranslationKey } from "@/i18n"

export type LogFilter = "all" | "INFO" | "WARNING" | "ERROR"

interface Props {
  filter: LogFilter
  sourceFilter: string
  onSourceFilterChange: (source: string) => void
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

const SOURCE_FILTERS: { value: string; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "logs.filters.allSources" },
  { value: "SYSTEM", labelKey: "logs.filters.sourceSystem" },
  { value: "AUDIO", labelKey: "logs.filters.sourceAudio" },
  { value: "SCHEDULE", labelKey: "logs.filters.sourceSchedule" },
  { value: "API", labelKey: "logs.filters.sourceApi" },
  { value: "NETWORK", labelKey: "logs.filters.sourceNetwork" },
  { value: "APP", labelKey: "logs.filters.sourceApp" },
  { value: "UI", labelKey: "logs.filters.sourceUi" },
]

const FILTER_STYLES: Record<LogFilter, { dot: string; active: string }> = {
  all: {
    dot: "bg-blue-500",
    active: "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  INFO: {
    dot: "bg-emerald-500",
    active: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  WARNING: {
    dot: "bg-amber-500",
    active: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  ERROR: {
    dot: "bg-red-500",
    active: "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300",
  },
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
  sourceFilter,
  onSourceFilterChange,
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
                variant="outline"
                size="sm"
                className={`h-7 rounded-full border-border bg-muted/30 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground ${
                  active ? FILTER_STYLES[item.value].active : ""
                }`}
                onClick={() => onFilterChange(item.value)}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-full ${FILTER_STYLES[item.value].dot}`}
                />
                {t(item.labelKey)} ({count(item.value)})
              </Button>
            )
          })}
        </div>

        <Select
          value={sourceFilter}
          onValueChange={(value) => {
            if (value !== null) onSourceFilterChange(value)
          }}
        >
          <SelectTrigger
            aria-label={t("logs.filters.source")}
            className="h-8 w-40 text-xs"
          >
            <SelectValue>
              {t(SOURCE_FILTERS.find((item) => item.value === sourceFilter)?.labelKey ?? "logs.filters.allSources")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SOURCE_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {t(item.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
          <Checkbox
            checked={includeDebug}
            onCheckedChange={(checked) =>
              onIncludeDebugChange(checked === true)
            }
          />

          <span>{t("logs.filters.includeDebug")}</span>
        </label>
      </div>
    </div>
  )
}