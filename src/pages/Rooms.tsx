import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import type {
  AudioFile,
  Room,
  RoomOperation,
} from "@/types"

import { audioApi } from "@/api/audio"
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

import ConfirmDialog from "@/components/ui/confirm-dialog"

import { useConfirm } from "@/hooks/useConfirm"

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
    audioFileId: string | null
    volume: number
  }) => void | Promise<void>

  onUpdateRoom: (
    id: string,
    data: {
      name: string
      audioFileId: string | null
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

  const { data: audioFiles = [] } = useQuery({
    queryKey: ["audio-files"],
    queryFn: audioApi.getAll,
  })

  const audioFileNames = useMemo(
    () =>
      new Map<string, string>(
        audioFiles.map((file: AudioFile) => [
          file.id,
          file.name,
        ]),
      ),
    [audioFiles],
  )

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
        await onDeleteRoom(
          room.id,
        )

        toast.success(
          t(
            "rooms.notifications.deleted",
          ),
          {
            description: t(
              "rooms.notifications.deletedDescription",
              {
                name: room.name,
              },
            ),
          },
        )
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

      <main className="min-h-0 flex-1 overflow-auto p-4">
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
        />

        <RoomFilters
          value={filter}
          counts={counts}
          onChange={setFilter}
        />

        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Загрузка комнат...
          </div>
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
                  audioFileName={
                    room.audioFileId
                      ? audioFileNames.get(room.audioFileId) ?? null
                      : null
                  }
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
            audioFileNames={audioFileNames}
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
      </main>

      <RoomDialog
        key={
          editingRoom?.id ??
          "new"
        }
        open={dialogOpen}
        room={editingRoom}
        onOpenChange={
          handleDialogChange
        }
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmation.open}
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