import {
  AlertTriangle,
  CheckCircle2,
  Radio,
  Volume2,
  XCircle,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import type { LogEntry, Room, SystemStatus } from "@/types"
import type { BackendConnectionState } from "@/api/client"
import { t } from "@/i18n"

interface DashboardHealthProps {
  rooms: Room[]
  system: SystemStatus
  connectionState: BackendConnectionState
  logs: LogEntry[]
}

export default function DashboardHealth({
  rooms,
  system,
  connectionState,
  logs,
}: DashboardHealthProps) {
  const playingRooms = rooms.filter(
    (room) => room.status === "playing",
  )

  const backendUnavailable = connectionState !== "online"
  const systemHealthy = !backendUnavailable && system.state === "ready"
  const systemDegraded = !backendUnavailable && system.state === "degraded"

  const issues = logs.filter((log) => {
    if (log.level !== "ERROR" && log.level !== "WARNING") return false
    if (system.state === "disconnected") return true

    const searchableText = [log.event, log.message, log.context?.exceptionMessage]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase()

    return !(
      searchableText.includes("device_unavailable") ||
      searchableText.includes("аудиоустройство отключено")
    )
  })

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <HealthCard
        icon={systemHealthy ? CheckCircle2 : XCircle}
        label={t("dashboard.health.system")}
        value={connectionState === "offline" ? "BACKEND OFFLINE" : connectionState === "reconnecting" ? "RECONNECTING" : system.state === "ready" ? t("common.online") : system.state === "degraded" ? "DEGRADED" : system.state === "initializing" ? "INIT" : system.state === "unconfigured" ? "UNCONFIGURED" : t("common.offline")}
        status={systemHealthy ? "success" : systemDegraded || connectionState === "reconnecting" ? "warning" : "error"}
      />

      <HealthCard
        icon={Volume2}
        label={t("dashboard.health.rooms")}
        value={rooms.length}
        description={t("dashboard.health.playingRooms", {
          count: playingRooms.length,
        })}
      />

      <HealthCard
        icon={Radio}
        label={t("dashboard.health.outputs")}
        value={`${system.availableOutputs} / ${system.outputs}`}
        description={t("dashboard.health.available")}
      />

      <HealthCard
        icon={AlertTriangle}
        label={t("dashboard.health.issues")}
        value={issues.length}
        description={
          issues.length === 0
            ? t("dashboard.health.systemOk")
            : t("dashboard.health.attention")
        }
        status={issues.length > 0 ? "warning" : "success"}
      />
    </div>
  )
}

function HealthCard({
  icon: Icon,
  label,
  value,
  description,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  description?: string
  status?: "success" | "warning" | "error"
}) {
  const iconClass =
    status === "success"
      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
      : status === "warning"
        ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
        : status === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary"

  return (
    <Card className="flex-row items-center gap-3 px-4 py-3.5">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
      >
        <Icon className="size-5" />
      </div>

      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>

        <div className="mt-0.5 truncate text-xl font-bold leading-none">
          {value}
        </div>

        {description && (
          <div className="mt-1 text-xs text-muted-foreground">
            {description}
          </div>
        )}
      </div>
    </Card>
  )
}