import { Square, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { Room } from "@/types"
import { t } from "@/i18n"

interface DashboardEmergencyStopProps {
  rooms: Room[]
  onStopAll: () => void
}

export default function DashboardEmergencyStop({
  rooms,
  onStopAll,
}: DashboardEmergencyStopProps) {
  const [showDialog, setShowDialog] = useState(false)

  const playingRooms = rooms.filter(
    (room) => room.status === "playing",
  )

  const handleConfirm = () => {
    onStopAll()
    setShowDialog(false)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/20 bg-destructive/[0.03] px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {t("dashboard.emergencyStop.title")}
          </div>

          <div className="text-xs text-muted-foreground">
            {t("dashboard.emergencyStop.description")}
          </div>
        </div>

        <Button
          variant="destructive"
          size="sm"
          disabled={playingRooms.length === 0}
          onClick={() => setShowDialog(true)}
          className="shrink-0"
        >
          <Square
            className="size-3.5"
            fill="currentColor"
          />
          {t("dashboard.emergencyStop.stopAll")}
        </Button>
      </div>

      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={() => setShowDialog(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stop-all-title"
            className="w-full max-w-md rounded-lg border bg-background p-5 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="stop-all-title"
                  className="text-base font-semibold"
                >
                  {t("dashboard.emergencyStop.confirmTitle")}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {t("dashboard.emergencyStop.confirmDescription")}
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDialog(false)}
                aria-label={t("common.close")}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-4 rounded-md border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">
                {t("dashboard.emergencyStop.playingNow")}
              </div>

              <div className="mt-1 text-lg font-semibold tabular-nums">
                {playingRooms.length}{" "}
                {t(
                  playingRooms.length === 1
                    ? "dashboard.emergencyStop.room"
                    : playingRooms.length < 5
                      ? "dashboard.emergencyStop.roomsFew"
                      : "dashboard.emergencyStop.roomsMany",
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                {t("common.cancel")}
              </Button>

              <Button
                variant="destructive"
                onClick={handleConfirm}
              >
                <Square
                  className="size-3.5"
                  fill="currentColor"
                />
                {t("dashboard.emergencyStop.stopAll")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}