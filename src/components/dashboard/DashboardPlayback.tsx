import { Pause, PlayCircle, Square } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { Room } from "@/types"
import { t } from "@/i18n"
import { formatTime } from "@/lib/audio"

interface DashboardPlaybackProps {
  rooms: Room[]
  onNavigate: (page: string) => void
  onPauseRoom: (roomId: string) => void
  onStopRoom: (roomId: string) => void
}

export default function DashboardPlayback({
  rooms,
  onNavigate,
  onPauseRoom,
  onStopRoom,
}: DashboardPlaybackProps) {
  const currentRoomEntry = rooms
  .map((room, index) => ({
    room,
    displayNumber: index + 1,
  }))
  .find(({ room }) => room.status === "playing")

  const currentRoom = currentRoomEntry?.room
  const currentRoomDisplayNumber =
    currentRoomEntry?.displayNumber

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center border-b px-4 py-3">
        <h3 className="text-sm font-semibold">
          {t("dashboard.playback.title")}
        </h3>
      </div>

      <div className="p-3.5">
        {currentRoom ? (
          <div className="flex flex-col gap-3">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-base font-bold leading-tight">
                  {String(currentRoomDisplayNumber).padStart(2, "0")} —{" "}
                  {currentRoom.name}
                </div>

              </div>

              <Badge
                variant="success"
                className="shrink-0"
              >
                {t("dashboard.playback.playing")}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Progress
                value={
                  currentRoom.duration > 0
                    ? Math.min(
                        100,
                        (currentRoom.position / currentRoom.duration) * 100,
                      )
                    : 0
                }
                className="h-2 flex-1"
              />

              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatTime(currentRoom.position)} /{" "}
                {formatTime(currentRoom.duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() =>
                  onPauseRoom(currentRoom.id)
                }
              >
                <Pause className="size-3.5" />
                {t("dashboard.playback.pause")}
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  onStopRoom(currentRoom.id)
                }
              >
                <Square className="size-3.5" />
                {t("dashboard.playback.stop")}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => onNavigate("rooms")}
              >
                {t("dashboard.playback.openRoom")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <PlayCircle className="mb-2 size-7 text-muted-foreground/50" />

            <div className="text-sm text-muted-foreground">
              {t("dashboard.playback.empty")}
            </div>

            <Button
              variant="link"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() => onNavigate("rooms")}
            >
              {t("dashboard.playback.openRooms")}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
