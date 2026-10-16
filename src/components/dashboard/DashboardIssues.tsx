import { AlertTriangle, ExternalLink, Square, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { LogEntry, Room, SystemStatus } from "@/types"
import { t } from "@/i18n"

interface DashboardIssuesProps {
  logs: LogEntry[]
  rooms: Room[]
  system: SystemStatus
  onNavigate: (page: string) => void
  onStopAll: () => void
}

export default function DashboardIssues({
  logs,
  rooms,
  system,
  onNavigate,
  onStopAll,
}: DashboardIssuesProps) {
  const isResolvedDeviceInterruption = (log: LogEntry) => {
    if (system.state === "disconnected") return false

    const searchableText = [
      log.event,
      log.message,
      log.context?.exceptionMessage,
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase()

    return (
      searchableText.includes("device_unavailable") ||
      searchableText.includes("аудиоустройство отключено") ||
      searchableText.includes("аудиоустройство отключено во время воспроизведения")
    )
  }

  // Keep the incident in the Logs page for audit purposes, but do not present a
  // recovered device interruption as an ongoing Dashboard issue.
  const issues = logs
    .filter(
      (log) =>
        (log.level === "ERROR" || log.level === "WARNING") &&
        !isResolvedDeviceInterruption(log),
    )
    .slice(0, 3)

  const hasActivePlayback = rooms.some(
    (room) => room.status === "playing",
  )

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">
          {t("dashboard.issues.title")}
        </h3>

        <Button
          variant="link"
          className="h-auto gap-1 p-0 text-xs"
          onClick={() => onNavigate("logs")}
        >
          {t("dashboard.issues.openLog")}
          <ExternalLink className="size-3" />
        </Button>
      </div>

      <div>
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              ✓
            </span>

            {t("dashboard.issues.empty")}
          </div>
        ) : (
          <div>
            {issues.map((issue, index) => {
              const isError = issue.level === "ERROR"

              return (
                <div
                  key={issue.id}
                  className={[
                    "flex items-center gap-3 px-4 py-3",
                    index < issues.length - 1
                      ? "border-b"
                      : "",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      isError
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-600",
                    ].join(" ")}
                  >
                    {isError ? (
                      <XCircle className="size-4" />
                    ) : (
                      <AlertTriangle className="size-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {issue.time}
                      </span>

                      <span className="truncate text-sm">
                        {issue.message}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      isError
                        ? "destructive"
                        : "warning"
                    }
                    className="shrink-0"
                  >
                    {isError ? "ERROR" : "WARNING"}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 border-t bg-destructive/[0.03] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Square
              className="size-3.5"
              fill="currentColor"
            />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold">
              {t("dashboard.issues.emergencyStop")}
            </div>

            <div className="truncate text-xs text-muted-foreground">
              {t("dashboard.issues.stopDescription")}
            </div>
          </div>
        </div>

        <Button
          variant="destructive"
          size="sm"
          disabled={!hasActivePlayback}
          onClick={onStopAll}
          className="shrink-0"
        >
          <Square
            className="size-3.5"
            fill="currentColor"
          />
          {t("dashboard.issues.stopAll")}
        </Button>
      </div>
    </div>
  )
}