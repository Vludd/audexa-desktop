import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { playbackApi, type PlaybackState } from "@/api/playback"
import type { Room } from "@/types"

const PLAYBACK_QUERY_KEY = ["playback"] as const
const ROOMS_QUERY_KEY = ["rooms"] as const

export function usePlayback() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: PLAYBACK_QUERY_KEY,
    queryFn: playbackApi.getState,
    refetchInterval: 500,
    staleTime: 0,
  })

  useEffect(() => {
    const state = query.data
    if (!state) return

    queryClient.setQueryData<Room[]>(ROOMS_QUERY_KEY, (rooms = []) =>
      rooms.map((room) => {
        const runtime = state.rooms.find((item) => item.roomId === room.id)
        if (!runtime) {
          return { ...room, status: "stopped", position: 0, duration: 0 }
        }

        return {
          ...room,
          status: runtime.status,
          position: runtime.positionSeconds,
          duration: runtime.durationSeconds,
          volume: runtime.volume,
        }
      }),
    )
  }, [query.data, queryClient])

  return query as typeof query & { data: PlaybackState | undefined }
}
