import { useEffect, useRef, useState } from "react"
import type { LogEntry } from "@/types"
import { t } from "@/i18n"

interface Props {
  logs: LogEntry[]
}

const LEVEL_CLASS: Record<string, string> = {
  INFO: "bg-blue-500/10 text-blue-400",
  WARNING: "bg-amber-500/10 text-amber-400",
  ERROR: "bg-red-500/10 text-red-400",
  DEBUG: "bg-gray-500/10 text-gray-400",
}

const MESSAGE_CLASS: Record<string, string> = {
  INFO: "text-slate-300",
  WARNING: "text-amber-400",
  ERROR: "text-red-400",
  DEBUG: "text-gray-400",
}

const ROW_HEIGHT = 36
const OVERSCAN = 8

export default function LogViewer({ logs }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(500)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const observer = new ResizeObserver(() => {
      setViewportHeight(viewport.clientHeight)
    })

    observer.observe(viewport)
    setViewportHeight(viewport.clientHeight)

    return () => observer.disconnect()
  }, [])

  const maxScrollTop = Math.max(0, logs.length * ROW_HEIGHT - viewportHeight)
  const effectiveScrollTop = Math.min(scrollTop, maxScrollTop)
  const firstVisibleIndex = Math.max(
    0,
    Math.floor(effectiveScrollTop / ROW_HEIGHT) - OVERSCAN,
  )
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2
  const lastVisibleIndex = Math.min(
    logs.length,
    firstVisibleIndex + visibleCount,
  )
  const visibleLogs = logs.slice(firstVisibleIndex, lastVisibleIndex)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700 bg-[#0f1b2e] font-mono">
      <div
        className="
          z-10 isolate shrink-0
          grid grid-cols-[90px_82px_72px_200px_1fr]
          rounded-t-lg
          bg-[#1e2d42]
          px-4 py-2
          text-[11px] font-bold tracking-wider text-[#8fa8c8]
          after:absolute after:inset-x-0 after:bottom-0
          after:h-0.5 after:bg-[#0f1b2e]
        "
      >
        <span>{t("logs.columns.time")}</span>
        <span>{t("logs.columns.level")}</span>
        <span>{t("logs.columns.source")}</span>
        <span>{t("logs.columns.event")}</span>
        <span>{t("logs.columns.message")}</span>
      </div>

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-auto"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        aria-label={t("pages.logs.title")}
      >
        {logs.length > 0 ? (
          <div style={{ height: logs.length * ROW_HEIGHT }}>
            <div style={{ height: firstVisibleIndex * ROW_HEIGHT }} />
            {visibleLogs.map((entry, visibleIndex) => {
              const index = firstVisibleIndex + visibleIndex
              const expanded = expandedId === entry.id

              return (
                <div key={entry.id} className="relative h-9">
                  <button
                    type="button"
                    className={[
                      "grid h-full w-full grid-cols-[90px_82px_72px_200px_1fr] items-center overflow-hidden border-b border-slate-700 px-4 text-left text-[12px] hover:bg-[#16243a]",
                      index % 2 === 0 ? "bg-[#0f1b2e]" : "bg-[#111e30]",
                    ].join(" ")}
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                  >
                    <span className="tabular-nums text-[#5a7a9a]">
                      {entry.time}
                    </span>

                    <span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          LEVEL_CLASS[entry.level] ??
                          "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {entry.level}
                      </span>
                    </span>

                    <span className="truncate text-slate-400">
                      {entry.source}
                    </span>

                    <span className="truncate text-slate-400">
                      {entry.event}
                    </span>

                    <span
                      className={`truncate ${MESSAGE_CLASS[entry.level] ?? "text-slate-300"}`}
                    >
                      {entry.message}
                    </span>
                  </button>

                  {expanded && entry.context && (
                    <pre className="absolute left-0 right-0 top-full z-20 max-h-48 overflow-auto border-b border-slate-700 bg-[#0b1524] px-4 py-3 text-[11px] leading-5 text-slate-400">
                      {JSON.stringify(entry.context, null, 2)}
                    </pre>
                  )}
                </div>
              )
            })}
            <div
              style={{
                height: (logs.length - lastVisibleIndex) * ROW_HEIGHT,
              }}
            />
          </div>
        ) : (
          <div className="px-4 py-10 text-center text-[13px] text-[#5a7a9a]">
            {t("logs.empty")}
          </div>
        )}
      </div>
    </div>
  )
}
