import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { playbackApi, type PlaybackSession, type PlaybackState } from "@/api/playback"
import { getBackendConnectionState } from "@/api/client"
import type { Room } from "@/types"

const PLAYBACK_QUERY_KEY = ["playback"] as const
const ROOMS_QUERY_KEY = ["rooms"] as const
const PLAYBACK_SESSIONS_QUERY_KEY = ["playback-sessions"] as const

export function usePlayback() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: PLAYBACK_QUERY_KEY,
    queryFn: playbackApi.getState,
    refetchInterval: (currentQuery) => {
      const connection = getBackendConnectionState()
      if (connection === "offline") return 15_000
      if (connection === "reconnecting") return 2_000
      return isActivePlayback(currentQuery.state.data) ? 500 : 3_000
    },
    staleTime: 0,
  })
  const sessionsQuery = useQuery({
    queryKey: PLAYBACK_SESSIONS_QUERY_KEY,
    queryFn: playbackApi.getSessions,
    refetchInterval: (currentQuery) => {
      const connection = getBackendConnectionState()
      if (connection === "offline") return 15_000
      if (connection === "reconnecting") return 2_000
      const sessions = currentQuery.state.data ?? []
      return sessions.some((session) => isActivePlayback(session.state))
        ? 500
        : 3_000
    },
    staleTime: 0,
  })

  useEffect(() => {
    const state = query.data
    const sessions = sessionsQuery.data ?? []
    const sessionRooms = sessions.flatMap((session) => session.state.rooms)
    const allRooms = sessionRooms.length > 0 ? sessionRooms : (state?.rooms ?? [])
    if (!state && sessions.length === 0) return

    queryClient.setQueryData<Room[]>(ROOMS_QUERY_KEY, (rooms = []) =>
      rooms.map((room) => {
        const runtime = allRooms.find((item) => item.roomId === room.id)
        if (!runtime) {
          return { ...room, status: "idle", position: 0, duration: 0 }
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
  }, [query.data, sessionsQuery.data, queryClient])

  return {
    ...query,
    data: query.data as PlaybackState | undefined,
    sessions: (sessionsQuery.data ?? []) as PlaybackSession[],
  }
}


function isActivePlayback(state: PlaybackState | undefined): boolean {
  return Boolean(
    state &&
      ["starting", "playing", "paused", "waiting"].includes(state.status),
  )
}
