import {
  Copy,
  Edit,
  Ellipsis,
  Loader2,
  Pause,
  Play,
  Square,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { Room, RoomOperation } from "@/types"

import StatusBadge from "@/components/StatusBadge"
import { Slider } from "../ui/slider"
import { formatTime, getProgress } from "@/lib/audio"
import { t } from "@/i18n"
import { useRef } from "react"

type RoomListItem = {
  room: Room
  displayNumber: number
}

interface Props {
  rooms: RoomListItem[]
  operations: Record<string, RoomOperation>

  onPlay: (id: string) => void
  onStop: (id: string) => void
  onPause: (id: string) => void

  onEdit: (room: Room) => void
  onDuplicate: (room: Room) => void
  onDelete: (room: Room) => void

  onVolumePreview: (id: string, volume: number) => void
  onVolumeCommit: (
    id: string,
    volume: number,
    previousVolume: number,
  ) => void | Promise<void>
}

export default function RoomTable({
  rooms,
  operations,
  onPlay,
  onStop,
  onPause,
  onEdit,
  onDuplicate,
  onDelete,
  onVolumePreview,
  onVolumeCommit
}: Props) {

  const volumeBeforeDrag = useRef<number | null>(null)

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">#</TableHead>
            <TableHead>{t("rooms.table.room")}</TableHead>
            <TableHead className="w-16">{t("rooms.table.status")}</TableHead>
            <TableHead>{t("rooms.table.file")}</TableHead>
            <TableHead>{t("rooms.table.volume")}</TableHead>
            <TableHead className="w-72">{t("rooms.table.actions")}</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rooms.map(({ room, displayNumber }) => {
            const operation = operations?.[room.id]
            const isPending = Boolean(operation)

            return (
              <TableRow key={room.id}>
                <TableCell className="text-sm min-w-[32px] text-center tabular-nums">
                  {String(displayNumber).padStart(2, "0")}
                </TableCell>

                <TableCell className="font-medium">
                  <div className="mb-1">
                    {room.name}
                  </div>

                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{formatTime(room.position)}</span>

                    <span>{formatTime(room.duration)}</span>
                  </div>

                  <div
                    className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted-foreground/25"
                    role="progressbar"
                    aria-label={t("rooms.table.playbackProgress", {
                      id: room.id,
                    })}
                    aria-valuemin={0}
                    aria-valuemax={room.duration}
                    aria-valuenow={room.position}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{
                        width: `${getProgress(room.position, room.duration)}%`,
                      }}
                    />
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={room.status} />
                  </div>
                </TableCell>

                <TableCell className="max-w-[280px]">
                  <span className="block truncate text-xs text-muted-foreground">
                    {room.audioFileId ?? t("common.fileNotAssigned")}
                  </span>
                </TableCell>

                <TableCell>
                  <div className="flex min-w-[150px] items-center gap-3">
                    <Slider
                      value={[room.volume]}
                      onValueChange={(value) => {
                        const volume = Array.isArray(value) ? value[0] : value

                        if (typeof volume !== "number") {
                          return
                        }

                        if (volumeBeforeDrag.current === null) {
                          volumeBeforeDrag.current = room.volume
                        }

                        onVolumePreview(room.id, volume)
                      }}
                      onValueCommitted={(value) => {
                        const volume = Array.isArray(value) ? value[0] : value

                        if (typeof volume !== "number") {
                          return
                        }

                        const previousVolume = volumeBeforeDrag.current ?? room.volume

                        volumeBeforeDrag.current = null

                        void onVolumeCommit(
                          room.id,
                          volume,
                          previousVolume,
                        )
                      }}
                    />

                    <span className="min-w-9 text-right text-xs font-medium tabular-nums">
                      {room.volume}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    {operation === "starting" ? (
                      <SmallButton
                        label={t("common.starting")}
                        variant="success"
                        disabled
                        icon={
                          <Loader2 className="size-3 animate-spin" />
                        }
                      />
                    ) : operation === "pausing" ? (
                      <SmallButton
                        label={t("common.pausing")}
                        variant="primary"
                        disabled
                        icon={
                          <Loader2 className="size-3 animate-spin" />
                        }
                      />
                    ) : room.status === "playing" ? (
                      <SmallButton
                        label={t("common.pause")}
                        variant="primary"
                        onClick={() => onPause(room.id)}
                        disabled={isPending}
                        icon={<Pause className="size-3" />}
                      />
                    ) : room.status === "paused" ? (
                      <SmallButton
                        label={t("common.resume")}
                        variant="success"
                        onClick={() => onPlay(room.id)}
                        disabled={isPending}
                        icon={
                          <Play className="size-3" />
                        }
                      />
                    ) : (
                      <SmallButton
                        label={t("common.play")}
                        variant="success"
                        onClick={() => onPlay(room.id)}
                        disabled={isPending}
                        icon={<Play className="size-3" />}
                      />
                    )}

                    {operation === "stopping" ? (
                      <SmallButton
                        label={t("common.stopping")}
                        variant="secondary"
                        disabled
                        icon={
                          <Loader2 className="size-3 animate-spin" />
                        }
                      />
                    ) : (
                      <SmallButton
                        label={t("common.stop")}
                        variant="secondary"
                        onClick={() => onStop(room.id)}
                        disabled={
                          isPending ||
                          (room.status !== "playing" &&
                            room.status !== "paused")
                        }
                        icon={
                          <Square className="size-3" />
                        }
                      />
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={t("rooms.table.roomActions", {
                            name: room.name,
                          })}
                        >
                          <Ellipsis className="size-4" />
                        </Button>
                      }
                    />

                    <DropdownMenuContent
                      align="end"
                      className="w-48"
                    >
                      <DropdownMenuItem
                        onClick={() => onEdit(room)}
                      >
                        <Edit className="size-4" />
                        {t("common.edit")}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => onDuplicate(room)}
                      >
                        <Copy className="size-4" />
                        {t("common.duplicate")}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(room)}
                      >
                        <Trash2 className="size-4" />
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

function SmallButton({
  label,
  variant,
  onClick,
  disabled = false,
  icon,
}: {
  label: string
  variant: "primary" | "success" | "secondary"
  onClick?: () => void
  disabled?: boolean
  icon?: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={
        variant === "success"
          ? "success"
          : variant === "primary"
            ? "default"
            : "secondary"
      }
      onClick={onClick}
      disabled={disabled}
      className="gap-1.5"
    >
      {icon}
      {label}
    </Button>
  )
}
