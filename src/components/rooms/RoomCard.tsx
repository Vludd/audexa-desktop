import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Pencil,
  Settings,
  Square,
  Copy,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"

import type {
  Room,
  RoomOperation,
} from "@/types"

import StatusBadge from "@/components/StatusBadge"
import { cn } from "cn"
import { formatTime } from "@/lib/audio"
import { getRoomOperationLabel } from "@/lib/rooms"
import { Slider } from "../ui/slider"
import { t } from "@/i18n"

interface Props {
  room: Room
  audioFileName: string | null
  displayNumber: number
  operation?: RoomOperation

  onPlay: (id: string) => void
  onStop: (id: string) => void
  onPause: (id: string) => void

  onVolumePreview: (
    id: string,
    volume: number,
  ) => void

  onVolumeCommit: (
    id: string,
    volume: number,
    previousVolume: number,
  ) => void | Promise<void>

  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export default function RoomCard({
  room,
  audioFileName,
  displayNumber,
  operation,

  onPlay,
  onStop,
  onPause,

  onVolumePreview,
  onVolumeCommit,

  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const isPlaying =
    room.status === "playing"

  const isPending =
    Boolean(operation)

  const hideMediaControls = false

  const progress =
    room.duration > 0
      ? Math.min(
          (room.position /
            room.duration) *
            100,
          100,
        )
      : 0

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false)

  const menuRef =
    useRef<HTMLDivElement>(null)

  /*
   * Volume at the start of the current drag session.
   *
   * Used to avoid sending a PUT when the user
   * starts and ends the drag at the same value.
   */
  const volumeBeforeDrag =
    useRef<number | null>(null)

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      if (
        !menuRef.current?.contains(
          event.target as Node,
        )
      ) {
        setMenuOpen(false)
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    )

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      )
    }
  }, [menuOpen])

  const closeMenu = () =>
    setMenuOpen(false)

  const handleVolumeChange = (
    value: number | readonly number[],
  ) => {
    const nextVolume = Array.isArray(
      value,
    )
      ? value[0]
      : value

    if (
      typeof nextVolume !== "number"
    ) {
      return
    }

    if (
      volumeBeforeDrag.current ===
      null
    ) {
      volumeBeforeDrag.current =
        room.volume
    }

    onVolumePreview(
      room.id,
      nextVolume,
    )
  }

  const handleVolumeCommit = (
    value: number | readonly number[],
  ) => {
    const nextVolume = Array.isArray(
      value,
    )
      ? value[0]
      : value

    const previousVolume =
      volumeBeforeDrag.current

    volumeBeforeDrag.current = null

    if (
      typeof nextVolume !== "number"
    ) {
      return
    }

    if (
      previousVolume ===
        nextVolume ||
      previousVolume === null
    ) {
      return
    }

    void onVolumeCommit(
      room.id,
      nextVolume,
      previousVolume,
    )
  }

  return (
    <Card
      className={cn(
        "relative overflow-visible border transition-all",

        isPlaying &&
          "border-emerald-500/60 bg-emerald-50/40 dark:border-emerald-500/50 dark:bg-emerald-950/35",

        room.status ===
          "paused" &&
          "border-amber-500/60 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-950/35",

        room.status ===
          "error" &&
          "border-destructive/50 bg-destructive/10 dark:border-destructive/50 dark:bg-destructive/15",

        room.status ===
          "waiting" &&
          "border-amber-400/60 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-950/25",

        isPending &&
          "opacity-90",
      )}
    >
      <CardContent>
        <div className="mb-2.5 flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-bold leading-none">
              {String(
                displayNumber,
              ).padStart(2, "0")}
            </div>

            <div className="mt-1 truncate text-sm font-semibold">
              {room.name}
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <StatusBadge
                status={room.status}
              />

              {operation && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />

                  {getRoomOperationLabel(
                    operation,
                  )}
                </span>
              )}
            </div>
          </div>

          <div
            ref={menuRef}
            className="relative"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label={t(
                "rooms.table.actions",
              )}
              aria-expanded={menuOpen}
              disabled={isPending}
              onClick={() =>
                setMenuOpen(
                  (open) => !open,
                )
              }
            >
              <MoreHorizontal className="size-4" />
            </Button>

            {menuOpen && (
              <div className="absolute right-0 top-9 z-50 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                <MenuItem
                  icon={
                    <Pencil className="size-3.5" />
                  }
                  label={t(
                    "common.edit",
                  )}
                  onClick={() => {
                    closeMenu()
                    onEdit()
                  }}
                />

                <MenuItem
                  icon={
                    <Copy className="size-3.5" />
                  }
                  label={t(
                    "common.duplicate",
                  )}
                  onClick={() => {
                    closeMenu()
                    onDuplicate()
                  }}
                />

                <div className="my-1 border-t" />

                <MenuItem
                  icon={
                    isPlaying ? (
                      <Pause className="size-3.5" />
                    ) : (
                      <Play className="size-3.5" />
                    )
                  }
                  label={
                    isPlaying
                      ? t(
                          "common.pause",
                        )
                      : t(
                          "common.play",
                        )
                  }
                  hidden={
                    hideMediaControls
                  }
                  onClick={() => {
                    closeMenu()

                    if (isPlaying) {
                      onPause(room.id)
                    } else {
                      onPlay(room.id)
                    }
                  }}
                />

                <MenuItem
                  icon={
                    <Square className="size-3.5" />
                  }
                  label={t(
                    "common.stop",
                  )}
                  hidden={
                    hideMediaControls
                  }
                  onClick={() => {
                    closeMenu()
                    onStop(room.id)
                  }}
                  disabled={
                    isPending ||
                    (room.status !==
                      "playing" &&
                      room.status !==
                        "paused")
                  }
                />

                <div
                  className="my-1 border-t"
                  hidden={
                    hideMediaControls
                  }
                />

                <MenuItem
                  icon={
                    <Trash2 className="size-3.5" />
                  }
                  label={t(
                    "common.delete",
                  )}
                  onClick={() => {
                    closeMenu()
                    onDelete()
                  }}
                  destructive
                />
              </div>
            )}
          </div>
        </div>

        <div className={cn(
          "mb-2.5 truncate text-[11px] text-muted-foreground",
          !room.audioFileId &&
            "text-destructive",
        )}>
          {room.audioFileId
            ? audioFileName ?? t("common.fileUnavailable")
            : t("common.fileNotAssigned")}
        </div>

        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {formatTime(
                room.position,
              )}
            </span>

            <span>
              {formatTime(
                room.duration,
              )}
            </span>
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted-foreground/25"
            role="progressbar"
            aria-label={t(
              "rooms.table.playbackProgress",
              {
                id: room.id,
              },
            )}
            aria-valuemin={0}
            aria-valuemax={
              room.duration
            }
            aria-valuenow={
              room.position
            }
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>

        <div className="mb-2.5 flex items-center gap-2">
          <Slider
            trackClassName="bg-muted-foreground/25"
            value={[room.volume]}
            min={0}
            max={100}
            step={1}
            disabled={isPending}
            onValueChange={
              handleVolumeChange
            }
            onValueCommitted={
              handleVolumeCommit
            }
            aria-label={t(
              "rooms.table.roomVolume",
              {
                name: room.name,
              },
            )}
            className="w-24"
          />

          <span className="min-w-9 text-right text-xs font-medium tabular-nums">
            {room.volume}%
          </span>
        </div>

        <div className="flex gap-1.5">
          {operation ===
          "starting" ? (
            <ActionButton
              icon={
                <Loader2 className="size-3 animate-spin" />
              }
              label={t(
                "common.starting",
              )}
              variant="success"
              hidden={
                hideMediaControls
              }
              disabled
            />
          ) : operation ===
            "pausing" ? (
            <ActionButton
              icon={
                <Loader2 className="size-3 animate-spin" />
              }
              label={t(
                "common.pausing",
              )}
              variant="primary"
              hidden={
                hideMediaControls
              }
              disabled
            />
          ) : operation ===
            "stopping" ? (
            <ActionButton
              icon={
                <Loader2 className="size-3 animate-spin" />
              }
              label={t(
                "common.stopping",
              )}
              variant="secondary"
              hidden={
                hideMediaControls
              }
              disabled
            />
          ) : isPlaying ? (
            <ActionButton
              icon={
                <Pause className="size-3" />
              }
              label={t(
                "common.pause",
              )}
              variant="primary"
              hidden={
                hideMediaControls
              }
              onClick={() =>
                onPause(room.id)
              }
            />
          ) : (
            <ActionButton
              icon={
                <Play className="size-3" />
              }
              label={t(
                "common.play",
              )}
              variant="success"
              hidden={
                hideMediaControls
              }
              onClick={() =>
                onPlay(room.id)
              }
            />
          )}

          <ActionButton
            icon={
              <Square className="size-3" />
            }
            label={t(
              "common.stop",
            )}
            variant="secondary"
            onClick={() =>
              onStop(room.id)
            }
            disabled={
              isPending ||
              (room.status !==
                "playing" &&
                room.status !==
                  "paused")
            }
            hidden={
              hideMediaControls
            }
          />

          <Button
            type="button"
            variant="outline"
            hidden
            size="icon"
            className="size-8 shrink-0"
            aria-label={t(
              "rooms.table.roomActions",
              {
                name: room.name,
              },
            )}
            onClick={onEdit}
            disabled={isPending}
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
  disabled = false,
  hidden = false,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
  hidden?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent",

        destructive
          ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
          : disabled
            ? "text-muted-foreground hover:bg-transparent"
            : "text-foreground",
      )}
      onClick={onClick}
      disabled={disabled}
      hidden={hidden}
    >
      {icon}
      {label}
    </button>
  )
}

function ActionButton({
  icon,
  label,
  variant,
  onClick,
  disabled = false,
  hidden = false,
}: {
  icon: ReactNode
  label: string
  variant:
    | "primary"
    | "success"
    | "secondary"
  onClick?: () => void
  disabled?: boolean
  hidden?: boolean
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={
        variant === "success"
          ? "success"
          : variant ===
              "secondary"
            ? "secondary"
            : "default"
      }
      onClick={onClick}
      disabled={disabled}
      className="flex-1 gap-1.5"
      hidden={hidden}
    >
      {icon}
      {label}
    </Button>
  )
}