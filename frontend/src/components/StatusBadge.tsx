import type { RoomStatus } from "@/types"
import { Badge } from "@/components/ui/badge"
import { t, type TranslationKey } from "@/i18n"

const CONFIG: Record<
  RoomStatus,
  {
    variant: "success" | "warning" | "secondary" | "destructive"
    dotClass: string
    labelKey: TranslationKey
  }
> = {
  idle: {
    variant: "secondary",
    dotClass: "bg-muted-foreground",
    labelKey: "rooms.status.idle",
  },

  playing: {
    variant: "success",
    dotClass: "bg-emerald-500",
    labelKey: "rooms.status.playing",
  },

  paused: {
    variant: "warning",
    dotClass: "bg-amber-500",
    labelKey: "rooms.status.paused",
  },

  stopped: {
    variant: "secondary",
    dotClass: "bg-muted-foreground",
    labelKey: "rooms.status.stopped",
  },

  waiting: {
    variant: "warning",
    dotClass: "bg-amber-500",
    labelKey: "rooms.status.waiting",
  },

  error: {
    variant: "destructive",
    dotClass: "bg-red-500",
    labelKey: "rooms.status.error",
  },
}

interface Props {
  status: RoomStatus
}

export default function StatusBadge({ status }: Props) {
  const config = CONFIG[status]

  return (
    <Badge variant={config.variant} className="gap-1.5">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${config.dotClass}`}
      />

      {t(config.labelKey)}
    </Badge>
  )
}
