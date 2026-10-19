import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useAudioSystem } from "@/context/useAudioSystem"
import { formatDate, formatTime, t } from "@/i18n"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import ThemeSwitcher from "@/components/ThemeSwitcher"

interface Props {
  title: string
  subtitle?: string
}

export default function Header({ title, subtitle }: Props) {
  const [now, setNow] = useState(new Date())
  const { status } = useAudioSystem()
  const backendOffline = status.backend === "offline"
  const systemOk = status.state === "ready" && !backendOffline
  const systemDegraded = status.state === "degraded" && !backendOffline
  const statusVariant = systemOk
    ? "success"
    : systemDegraded || status.state === "unconfigured" || status.state === "initializing"
      ? "warning"
      : "destructive"
  const statusTitle = backendOffline
    ? t("header.backendOffline")
    : status.state === "ready"
      ? t("header.systemOk")
      : status.state === "degraded"
        ? t("header.systemDegraded")
        : status.state === "unconfigured"
          ? t("header.systemUnconfigured")
          : status.state === "initializing"
            ? t("header.systemChecking")
            : status.state === "disconnected"
              ? t("header.deviceDisconnected")
              : t("header.systemError")
  const statusDescription = backendOffline
    ? t("header.backendOfflineDescription")
    : status.state === "ready"
      ? status.mappings === 0
        ? t("header.noRoomsConfigured")
        : t("header.allLinesOk")
      : status.state === "degraded"
        ? t("header.someRoomsNotConfigured", { mapped: status.mappedOutputs, total: status.mappings })
        : status.state === "unconfigured"
          ? t("header.systemUnconfiguredDescription")
          : status.state === "initializing"
            ? t("header.systemCheckingDescription")
            : status.state === "disconnected"
              ? t("header.deviceDisconnectedDescription")
              : t("header.checkConnection")

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="flex min-h-[64px] shrink-0 items-center justify-between border-b bg-card px-5">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-6 tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <div className="text-[11px] capitalize leading-4 text-muted-foreground">
            {formatDate(now)}
          </div>
          <div className="text-[22px] font-bold leading-6 tabular-nums text-foreground">
            {formatTime(now)}
          </div>
        </div>

        <Badge
          variant={statusVariant}
          className="h-auto rounded-md px-2.5 py-1.5"
        >
          {systemOk
            ? <CheckCircle className="size-3.5 shrink-0" />
            : systemDegraded || status.state === "unconfigured" || status.state === "initializing"
              ? <AlertTriangle className="size-3.5 shrink-0" />
              : <XCircle className="size-3.5 shrink-0" />}
          <div className="text-left">
            <div className="text-[11px] font-semibold leading-3.5">
              {statusTitle}
            </div>
            <div className="text-[10px] font-normal leading-3 opacity-75">
              {statusDescription}
            </div>
          </div>
        </Badge>

        <ThemeSwitcher />
        <LanguageSwitcher compact />
      </div>
    </header>
  )
}
