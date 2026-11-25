import { Unlink, Wifi, WifiOff } from "lucide-react"

import { t } from "@/i18n"

export default function MediaHostStatus({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase()
  const online = normalizedStatus === "online"
  const disabled = normalizedStatus === "disabled"

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${disabled ? "bg-destructive/10 text-destructive" : online ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
    >
      {disabled ? (
        <Unlink className="size-3.5" />
      ) : online ? (
        <Wifi className="size-3.5" />
      ) : (
        <WifiOff className="size-3.5" />
      )}
      {disabled
        ? t("mediaHosts.actions.unpaired")
        : online
          ? t("common.online")
          : t("common.offline")}
    </span>
  )
}
