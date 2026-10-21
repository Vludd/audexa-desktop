import { useEffect, useState } from "react"
import type { BackendConnectionState } from "@/api/client"

import type { Room, RoomOperation } from "@/types"
import { toast } from "@/lib/toast"

import Header from "@/components/Header"
import { t } from "@/i18n"

import RoomDialog, {
  type RoomFormData,
} from "@/components/rooms/RoomDialog"

import RoomCard from "@/components/rooms/RoomCard"

import RoomFilters, {
  type RoomFilter,
} from "@/components/rooms/RoomFilters"

import RoomTable from "@/components/rooms/RoomTable"

import RoomToolbar from "@/components/rooms/RoomToolbar"

import { Card, CardContent } from "@/components/ui/card"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { useConfirm } from "@/hooks/useConfirm"
import BackendStatusBanner from "@/components/BackendStatusBanner"

interface Props {
  rooms: Room[]
  operations: Record<
    string,
    RoomOperation
  >

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

  onAddRoom: (data: {
    name: string
    volume: number
  }) => void | Promise<void>

  onUpdateRoom: (
    id: string,
    data: {
      name: string
      volume: number
    },
  ) => void | Promise<void>

  onDeleteRoom: (
    id: string,
  ) => void | Promise<void>

  onDuplicateRoom: (
    id: string,
  ) => void | Promise<void>

  isLoading: boolean
  connectionState: BackendConnectionState
  error: Error | null
  onRetry: () => void
}

export default function Rooms({
  rooms,
  operations,

  onPlay,
  onStop,
  onPause,

  onVolumePreview,
  onVolumeCommit,

  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
  onDuplicateRoom,

  isLoading,
  connectionState,
  error,
  onRetry,
}: Props) {
  const [query, setQuery] =
    useState("")

  const [filter, setFilter] =
    useState<RoomFilter>("all")

  const [viewGrid, setViewGrid] =
    useState(true)

  const [dialogOpen, setDialogOpen] =
    useState(false)

  const [editingRoom, setEditingRoom] =
    useState<Room | null>(null)

  const confirmation = useConfirm()
  const backendUnavailable = connectionState !== "online"
  const controlsBlocked = isLoading || error !== null || backendUnavailable

  const { close: closeConfirmation } = confirmation

  useEffect(() => {
    if (backendUnavailable) {
      closeConfirmation()
    }
  }, [backendUnavailable, closeConfirmation])

  const counts: Record<
    RoomFilter,
    number
  > = {
    all: rooms.length,

    playing: rooms.filter(
      (room) =>
        room.status === "playing",
    ).length,

    waiting: rooms.filter(
      (room) =>
        room.status === "waiting",
    ).length,

    stopped: rooms.filter(
      (room) =>
        room.status === "stopped",
    ).length,

    error: rooms.filter(
      (room) =>
        room.status === "error",
    ).length,
  }

  const displayRooms = rooms.map(
    (room, index) => ({
      room,
      displayNumber: index + 1,
    }),
  )

  const normalizedQuery =
    query.trim().toLowerCase()

  const filtered =
    displayRooms.filter(
      ({ room }) => {
        const matchFilter =
          filter === "all" ||
          room.status === filter

        const matchQuery =
          !normalizedQuery ||
          room.name
            .toLowerCase()
            .includes(
              normalizedQuery,
            )

        return (
          matchFilter &&
          matchQuery
        )
      },
    )

  const openCreateDialog =
    () => {
      setEditingRoom(null)
      setDialogOpen(true)
    }

  const openEditDialog = (
    room: Room,
  ) => {
    setEditingRoom(room)
    setDialogOpen(true)
  }

  const handleDialogChange = (
    open: boolean,
  ) => {
    setDialogOpen(open)

    if (!open) {
      setEditingRoom(null)
    }
  }

  const handleSave = async (
    data: RoomFormData,
  ) => {
    if (editingRoom) {
      await onUpdateRoom(
        editingRoom.id,
        data,
      )

      toast.success(
        t(
          "rooms.notifications.saved",
        ),
        {
          description: t(
            "rooms.notifications.savedDescription",
            {
              name: data.name,
            },
          ),
        },
      )
    } else {
      await onAddRoom(data)

      toast.success(
        t(
          "rooms.notifications.created",
        ),
        {
          description: t(
            "rooms.notifications.createdDescription",
            {
              name: data.name,
            },
          ),
        },
      )
    }

    setDialogOpen(false)
    setEditingRoom(null)
  }

  const handleDelete = (
    room: Room,
  ) => {
    confirmation.confirm({
      title: t(
        "rooms.confirmDelete.title",
      ),

      description: t(
        "rooms.confirmDelete.description",
        {
          name: room.name,
        },
      ),

      confirmLabel:
        t("common.delete"),

      cancelLabel:
        t("common.cancel"),

      variant: "destructive",

      onConfirm: async () => {
        try {
          await onDeleteRoom(room.id)

          toast.success(
            t("rooms.notifications.deleted"),
            {
              description: t("rooms.notifications.deletedDescription", {
                name: room.name,
              }),
            },
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : ""
          const isUsedByScenario = message.toLowerCase().includes("used by one or more scenarios")
            || message.toLowerCase().includes("used by scenario")
            || message.includes("SCENARIO_IN_USE")

          toast.error(t("rooms.notifications.deleteFailed"), {
            description: isUsedByScenario
              ? t("rooms.notifications.deleteUsedByScenario")
              : message || "Неизвестная ошибка.",
          })
        }
      },
    })
  }

  const handleDuplicate = async (
    room: Room,
  ) => {
    try {
      await onDuplicateRoom(
        room.id,
      )

      toast.success(
        t(
          "rooms.notifications.duplicated",
        ),
        {
          description: t(
            "rooms.notifications.duplicatedDescription",
            {
              name: room.name,
            },
          ),
        },
      )
    } catch (error) {
      toast.error(
        "Не удалось дублировать комнату",
        {
          description:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка",
        },
      )
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title={t(
          "pages.rooms.title",
        )}
        subtitle={t(
          "pages.rooms.subtitle",
        )}
      />

      <BackendStatusBanner
        connectionState={connectionState}
        onRetry={() => { void onRetry() }}
      />

      <main className="min-h-0 flex-1 overflow-auto p-4">
        <div inert={backendUnavailable || isLoading} aria-disabled={controlsBlocked || undefined}>
        <RoomToolbar
          query={query}
          viewGrid={viewGrid}
          onQueryChange={
            setQuery
          }
          onViewChange={
            setViewGrid
          }
          onAddRoom={
            openCreateDialog
          }
          disabled={controlsBlocked}
        />

        <RoomFilters
          value={filter}
          counts={counts}
          onChange={setFilter}
        />

        {isLoading ? (
          viewGrid ? <RoomCardSkeleton /> : <RoomTableSkeleton />
        ) : error ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 text-center">
            <div>
              <p className="font-medium">
                Не удалось загрузить комнаты
              </p>

              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {error.message}
              </p>
            </div>

            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              onClick={onRetry}
            >
              Повторить
            </button>
          </div>
        ) : filtered.length ===
          0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <p className="font-medium">
              {rooms.length ===
              0
                ? "Комнат пока нет"
                : "Ничего не найдено"}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {rooms.length ===
              0
                ? "Создай первую комнату, чтобы она появилась здесь."
                : "Попробуй изменить поиск или фильтр."}
            </p>

            {rooms.length ===
              0 && (
              <button
                type="button"
                className="mt-4 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                onClick={
                  openCreateDialog
                }
              >
                Создать комнату
              </button>
            )}
          </div>
        ) : viewGrid ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            {filtered.map(
              ({
                room,
                displayNumber,
              }) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  displayNumber={
                    displayNumber
                  }
                  operation={
                    operations[
                      room.id
                    ]
                  }
                  onPlay={onPlay}
                  onStop={onStop}
                  onPause={onPause}
                  onVolumePreview={
                    onVolumePreview
                  }
                  onVolumeCommit={
                    onVolumeCommit
                  }
                  onEdit={() =>
                    openEditDialog(
                      room,
                    )
                  }
                  onDuplicate={() =>
                    void handleDuplicate(
                      room,
                    )
                  }
                  onDelete={() =>
                    handleDelete(
                      room,
                    )
                  }
                />
              ),
            )}
          </div>
        ) : (
          <RoomTable
            rooms={filtered}
            operations={operations}
            onPlay={onPlay}
            onStop={onStop}
            onPause={onPause}
            onEdit={openEditDialog}
            onDuplicate={(room) => void handleDuplicate(room)}
            onDelete={handleDelete}
            onVolumePreview={onVolumePreview}
            onVolumeCommit={onVolumeCommit}
          />
        )}
        </div>
      </main>

      <RoomDialog
        key={
          `${editingRoom?.id ?? "new"}-${dialogOpen}`
        }
        open={dialogOpen && !backendUnavailable}
        room={editingRoom}
        onOpenChange={
          handleDialogChange
        }
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmation.open && !backendUnavailable}
        onOpenChange={(
          open,
        ) => {
          if (!open) {
            confirmation.close()
          }
        }}
        title={
          confirmation.options
            ?.title ?? ""
        }
        description={
          confirmation.options
            ?.description
        }
        confirmLabel={
          confirmation.options
            ?.confirmLabel
        }
        cancelLabel={
          confirmation.options
            ?.cancelLabel
        }
        variant={
          confirmation.options
            ?.variant
        }
        loading={
          confirmation.loading
        }
        onConfirm={
          confirmation.handleConfirm
        }
      />
    </div>
  )
}

function RoomCardSkeleton() {
  return (
    <div
      aria-label="Загрузка комнат"
      aria-busy="true"
      className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="animate-pulse">
          <CardContent>
            <div className="mb-2.5 flex items-start justify-between">
              <div className="w-full space-y-2">
                <SkeletonBlock className="h-7 w-10" />
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-5 w-20 rounded-full" />
              </div>
              <SkeletonBlock className="size-8 shrink-0" />
            </div>

            <SkeletonBlock className="mb-2.5 h-3 w-2/3" />

            <div className="mb-3 space-y-2">
              <div className="flex justify-between">
                <SkeletonBlock className="h-3 w-10" />
                <SkeletonBlock className="h-3 w-10" />
              </div>
              <SkeletonBlock className="h-1.5 w-full rounded-full" />
            </div>

            <div className="mb-2.5 flex items-center gap-2">
              <SkeletonBlock className="h-2 w-24 rounded-full" />
              <SkeletonBlock className="h-4 w-9" />
            </div>

            <div className="flex gap-1.5">
              <SkeletonBlock className="h-8 flex-1" />
              <SkeletonBlock className="h-8 flex-1" />
              <SkeletonBlock className="h-8 flex-1" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function RoomTableSkeleton() {
  return (
    <Card
      aria-label="Загрузка комнат"
      aria-busy="true"
      className="animate-pulse overflow-hidden"
    >
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
          {Array.from({ length: 5 }, (_, index) => (
            <TableRow key={index}>
              <TableCell className="text-center">
                <SkeletonBlock className="mx-auto h-4 w-6" />
              </TableCell>
              <TableCell>
                <SkeletonBlock className="mb-2 h-4 w-32" />
                <div className="mb-2 flex justify-between">
                  <SkeletonBlock className="h-3 w-10" />
                  <SkeletonBlock className="h-3 w-10" />
                </div>
                <SkeletonBlock className="h-1.5 w-full rounded-full" />
              </TableCell>
              <TableCell>
                <SkeletonBlock className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <SkeletonBlock className="h-4 w-36" />
              </TableCell>
              <TableCell>
                <SkeletonBlock className="h-2 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <div className="flex gap-1.5">
                  <SkeletonBlock className="h-8 w-16" />
                  <SkeletonBlock className="h-8 w-16" />
                  <SkeletonBlock className="h-8 w-16" />
                </div>
              </TableCell>
              <TableCell>
                <SkeletonBlock className="size-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function SkeletonBlock({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded bg-muted ${className}`} />
}