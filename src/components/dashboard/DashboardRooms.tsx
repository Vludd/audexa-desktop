import {
  Pause,
  Play,
  PlayCircle,
  Square,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Room } from "@/types"
import { t, type TranslationKey } from "@/i18n"
import { formatTime } from "@/lib/audio"

interface DashboardRoomsProps {
  rooms: Room[]
  onNavigate: (page: string) => void
}

const MAX_VISIBLE_ROOMS = 6

function getStatusPriority(status: Room["status"]) {
  switch (status) {
    case "error":
      return 0
    case "paused":
      return 1
    case "playing":
      return 2
    default:
      return 3
  }
}

function getRoomStatus(room: Room) {
  switch (room.status) {
    case "playing":
      return {
        labelKey: "rooms.status.playing" as const,
        variant: "success" as const,
        icon: Play,
      }

    case "paused":
      return {
        labelKey: "rooms.status.paused" as const,
        variant: "secondary" as const,
        icon: Pause,
      }

    case "error":
      return {
        labelKey: "rooms.status.error" as const,
        variant: "destructive" as const,
        icon: XCircle,
      }

    default:
      return {
        labelKey: "rooms.status.stopped" as const,
        variant: "secondary" as const,
        icon: Square,
      }
  }
}

export default function DashboardRooms({
  rooms,
  onNavigate,
}: DashboardRoomsProps) {
  const displayRooms = rooms.map((room, index) => ({
    room,
    displayNumber: index + 1,
  }))

  const activeRooms = displayRooms
    .filter(
      ({ room }) =>
        room.status === "playing" ||
        room.status === "paused" ||
        room.status === "error",
    )
    .sort(
      (a, b) =>
        getStatusPriority(a.room.status) -
        getStatusPriority(b.room.status),
    )

  const visibleRooms = activeRooms.slice(0, MAX_VISIBLE_ROOMS)
  const hiddenRoomsCount = Math.max(
    0,
    activeRooms.length - MAX_VISIBLE_ROOMS,
  )
  const showMoreKey: TranslationKey =
    hiddenRoomsCount === 1
      ? "rooms.dashboard.showMoreOne"
      : hiddenRoomsCount < 5
        ? "rooms.dashboard.showMoreFew"
        : "rooms.dashboard.showMoreMany"

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">
          {t("rooms.dashboard.title")}
          {activeRooms.length > 0 && (
            <span className="ml-1.5 text-muted-foreground">
              ({activeRooms.length})
            </span>
          )}
        </h3>

        <Button
          variant="link"
          className="h-auto p-0 text-xs"
          onClick={() => onNavigate("rooms")}
        >
          {t("rooms.dashboard.all")}
        </Button>
      </div>

      <div className="p-3.5">
        {activeRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <PlayCircle className="mb-2 size-7 text-muted-foreground/50" />

            <div className="text-sm text-muted-foreground">
              {t("rooms.dashboard.empty")}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {visibleRooms.map(({ room, displayNumber }, index) => {
              const status = getRoomStatus(room)
              const StatusIcon = status.icon

              return (
                <div key={room.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate("rooms")}
                    className="flex w-full min-w-0 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="w-7 shrink-0 text-sm font-bold tabular-nums">
                      {String(displayNumber).padStart(2, "0")}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {room.name}
                      </div>

                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {room.status === "playing" && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatTime(room.position)}
                        </span>
                      )}

                      <Badge
                        variant={status.variant}
                        className="gap-1"
                      >
                        <StatusIcon className="size-3" />
                        {t(status.labelKey)}
                      </Badge>
                    </div>
                  </button>

                  {index < visibleRooms.length - 1 && (
                    <div className="h-px bg-border" />
                  )}
                </div>
              )
            })}

            {hiddenRoomsCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => onNavigate("rooms")}
              >
                {t(showMoreKey, { count: hiddenRoomsCount })}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}