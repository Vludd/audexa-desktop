import { Loader2, Play, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import type { Room, RoomOperation } from "@/types"

import StatusBadge from "@/components/StatusBadge"
import { cn } from "cn"
import type { ReactNode } from "react"
import { t } from "@/i18n"
import { getRoomOperationLabel } from "@/lib/rooms"

interface Props {
  room: Room
  operation?: RoomOperation

  onPlay: () => void
  onStop: () => void
}

export default function SyncLineCard({
  room,
  operation,
  onPlay,
  onStop,
}: Props) {
  const isPlaying = room.status === "playing"
  const isPending = Boolean(operation)

  return (
    <Card 
      className={cn(
      "mt-4 border transition-all",
      isPlaying &&
        "border-emerald-500/60 bg-emerald-50/40 dark:border-emerald-500/50 dark:bg-emerald-950/35",
      room.status === "paused" &&
        "border-amber-500/60 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-950/35",
      room.status === "error" &&
        "border-destructive/50 bg-destructive/10 dark:border-destructive/50 dark:bg-destructive/15",
      room.status === "waiting" &&
        "border-amber-400/60 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-950/25",
      isPending && "opacity-90",
    )}>
      <CardContent className="flex items-center gap-3 p-3.5">
        {/* <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <span className="text-base font-bold text-primary">
            {room.id}
          </span>
        </div> */}

        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">
            {room.name}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={room.status} />

            {operation && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />

                {getRoomOperationLabel(operation)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ActionButton
            icon={operation === "starting" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            label={operation === "starting"
              ? t("common.starting")
              : room.status === "playing"
                ? t("rooms.status.playing")
                : t("common.play")}
            variant="success"
            onClick={() => onPlay()}
            disabled={isPending || room.status === "playing"}
          />

          <ActionButton
            icon={operation === "stopping" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Square className="size-3" />
            )}
            label={operation === "stopping" ? t("common.stopping") : t("common.stop")}
            variant="secondary"
            onClick={() => onStop()}
            disabled={isPending || room.status !== "playing" && room.status !== "paused"}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ActionButton({
  icon,
  label,
  variant,
  onClick,
  disabled = false,
}: {
  icon: ReactNode
  label: string
  variant: "primary" | "success" | "secondary"
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={
        variant === "success"
          ? "success"
          : variant === "secondary"
            ? "secondary"
            : "default"
      }
      onClick={onClick}
      disabled={disabled}
      className="flex-1 gap-1.5"
    >
      {icon}
      {label}
    </Button>
  )
}
