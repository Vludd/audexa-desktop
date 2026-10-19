import { useCallback } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { roomsApi } from "@/api/rooms"
import type {
  Room,
  RoomOperation,
} from "@/types"

import { toast } from "@/lib/toast"
import { t } from "@/i18n"
import { playbackApi } from "@/api/playback"

const ROOMS_QUERY_KEY = ["rooms"] as const

export interface RoomInput {
  name: string
  volume: number
}

interface VolumeUpdateVariables {
  id: string
  volume: number
  previousVolume: number
}

interface VolumeUpdateContext {
  previousRooms: Room[]
}

export function useRooms() {
  const queryClient = useQueryClient()

  const operations: Record<string, RoomOperation> = {}

  const {
    data: rooms = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ROOMS_QUERY_KEY,
    queryFn: roomsApi.getAll,
  })

  const createMutation = useMutation({
    mutationFn: (input: RoomInput) =>
      roomsApi.create({
        name: input.name,
        volume: input.volume,
      }),

    onSuccess: (createdRoom) => {
      queryClient.setQueryData<Room[]>(
        ROOMS_QUERY_KEY,
        (current = []) => [
          ...current,
          createdRoom,
        ],
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: RoomInput
    }) =>
      roomsApi.update(id, {
        name: input.name,
        volume: input.volume,
      }),

    onSuccess: (updatedRoom) => {
      queryClient.setQueryData<Room[]>(
        ROOMS_QUERY_KEY,
        (current = []) =>
          current.map((room) =>
            room.id === updatedRoom.id
              ? updatedRoom
              : room,
          ),
      )
    },
  })

  /*
   * Volume:
   *
   * - previewRoomVolume() updates only the cache;
   * - saveRoomVolume() sends one request to the playback endpoint;
   * - the backend persists the value and updates the active stream;
   * - the room cache is updated only after the request succeeds.
   */
  const updateVolumeMutation =
    useMutation({
      mutationFn: ({
        id,
        volume,
      }: VolumeUpdateVariables) => playbackApi.setRoomVolume(id, volume),

      onMutate: async ({
        id,
        volume,
        previousVolume,
      }) => {
        await queryClient.cancelQueries({
          queryKey: ROOMS_QUERY_KEY,
        })

        const previousRooms =
          queryClient.getQueryData<Room[]>(
            ROOMS_QUERY_KEY,
          ) ?? []

        /*
         * If the slider has already updated the cache,
         * previousRooms contains the preview value.
         *
         * Roll back explicitly using previousVolume,
         * which is passed from RoomCard.
         */
        queryClient.setQueryData<Room[]>(
          ROOMS_QUERY_KEY,
          (current = []) =>
            current.map((room) =>
              room.id === id
                ? {
                    ...room,
                    volume,
                  }
                : room,
            ),
        )

        return {
          previousRooms: previousRooms.map(
            (room) =>
              room.id === id
                ? {
                    ...room,
                    volume:
                      previousVolume,
                  }
                : room,
          ),
        } satisfies VolumeUpdateContext
      },

      onSuccess: (_state, variables) => {
        queryClient.setQueryData<Room[]>(
          ROOMS_QUERY_KEY,
          (current = []) =>
            current.map((room) =>
              room.id === variables.id
                ? { ...room, volume: variables.volume }
                : room,
            ),
        )
      },

      onError: (
        error,
        _variables,
        context,
      ) => {
        if (context) {
          queryClient.setQueryData<Room[]>(
            ROOMS_QUERY_KEY,
            context.previousRooms,
          )
        }

        toast.error(
          "Не удалось сохранить громкость",
          {
            description:
              error instanceof Error
                ? error.message
                : "Неизвестная ошибка.",
          },
        )
      },
    })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      roomsApi.delete(id),

    onSuccess: (_data, deletedId) => {
      queryClient.setQueryData<Room[]>(
        ROOMS_QUERY_KEY,
        (current = []) =>
          current.filter(
            (room) =>
              room.id !== deletedId,
          ),
      )
    },
  })

  /*
   * Runtime/domain cache update.
   */
  const updateRoom = useCallback(
    (
      id: string,
      patch: Partial<Room>,
    ) => {
      queryClient.setQueryData<Room[]>(
        ROOMS_QUERY_KEY,
        (current = []) =>
          current.map((room) =>
            room.id === id
              ? {
                  ...room,
                  ...patch,
                }
              : room,
          ),
      )
    },
    [queryClient],
  )

  /*
   * Slider preview.
   *
   * No HTTP request is made here.
   */
  const previewRoomVolume =
    useCallback(
      (
        id: string,
        volume: number,
      ) => {
        const normalizedVolume =
          Math.min(
            100,
            Math.max(0, volume),
          )

        queryClient.setQueryData<
          Room[]
        >(
          ROOMS_QUERY_KEY,
          (current = []) =>
            current.map((room) =>
              room.id === id
                ? {
                    ...room,
                    volume:
                      normalizedVolume,
                  }
                : room,
            ),
        )
      },
      [queryClient],
    )

  /*
   * Persist the volume change.
   *
   * IMPORTANT:
   * Do not check
   *
   *   room.volume === normalizedVolume
   *
   * because room.volume already contains
   * the preview value.
   */
  const saveRoomVolume =
    useCallback(
      async (
        id: string,
        volume: number,
        previousVolume: number,
      ) => {
        const normalizedVolume =
          Math.min(
            100,
            Math.max(0, volume),
          )

        if (
          normalizedVolume ===
          previousVolume
        ) {
          return
        }

        await updateVolumeMutation.mutateAsync(
          {
            id,
            volume:
              normalizedVolume,
            previousVolume,
          },
        )

      },
      [updateVolumeMutation],
    )

  const addRoom = useCallback(
    async (input: RoomInput) => {
      await createMutation.mutateAsync(
        input,
      )
    },
    [createMutation],
  )

  const updateRoomFromForm =
    useCallback(
      async (
        id: string,
        input: RoomInput,
      ) => {
        await updateMutation.mutateAsync(
          {
            id,
            input,
          },
        )
      },
      [updateMutation],
    )

  const deleteRoom = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(
        id,
      )
    },
    [deleteMutation],
  )

  const duplicateRoom = useCallback(
    async (id: string) => {
      const currentRooms =
        queryClient.getQueryData<
          Room[]
        >(
          ROOMS_QUERY_KEY,
        ) ?? []

      const source =
        currentRooms.find(
          (room) =>
            room.id === id,
        )

      if (!source) {
        return
      }

      await createMutation.mutateAsync({
        name: `${source.name} — ${t(
          "rooms.duplicateSuffix",
        )}`,
        volume: source.volume,
      })
    },
    [
      createMutation,
      queryClient,
    ],
  )

  const playRoom = useCallback(() => {
    toast.error(t("rooms.notifications.playUnavailable"), {
      description: t("rooms.notifications.playUnavailableDescription"),
    })
  }, [])

  const stopRoom = useCallback(() => {
    toast.error(t("rooms.notifications.stopUnavailable"), {
      description: t("rooms.notifications.stopUnavailableDescription"),
    })
  }, [])

  const pauseRoom = useCallback(() => {
    void playbackApi.pause().catch((error) => {
      toast.error(t("rooms.notifications.pauseFailed"), {
        description: error instanceof Error ? error.message : String(error),
      })
    })
  }, [])

  const stopAllRooms = useCallback(() => {
    void playbackApi.stop().catch((error) => {
      toast.error(t("rooms.notifications.stopFailed"), {
        description: error instanceof Error ? error.message : String(error),
      })
    })
  }, [])

  return {
    rooms,
    operations,

    isLoading,
    isFetching,
    error,
    refetch,

    updateRoom,

    addRoom,
    updateRoomFromForm,
    deleteRoom,
    duplicateRoom,

    previewRoomVolume,
    saveRoomVolume,

    playRoom,
    stopRoom,
    pauseRoom,
    stopAllRooms,

    isSaving:
      createMutation.isPending ||
      updateMutation.isPending,

    isDeleting:
      deleteMutation.isPending,

    isSavingVolume:
      updateVolumeMutation.isPending,
  }
}