import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr"

import { API_BASE_URL } from "@/api/client"
import { mediaHostsApi } from "@/api/mediaHosts"

export const MEDIA_HOSTS_QUERY_KEY = ["media-hosts"] as const

export function useMediaHosts() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: MEDIA_HOSTS_QUERY_KEY,
    queryFn: mediaHostsApi.getAll,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    let active = true
    const hubUrl = `${API_BASE_URL.replace(/\/+$/, "")}/hubs/media-hosts-ui`
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .configureLogging(import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning)
      .build()

    const refresh = () => {
      if (active) void queryClient.invalidateQueries({ queryKey: MEDIA_HOSTS_QUERY_KEY })
    }

    connection.on("MediaHostUpdated", refresh)
    connection.on("MediaHostDisplaysUpdated", refresh)
    connection.on("MediaHostConnectionLost", refresh)
    connection.onreconnected(refresh)

    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const startConnection = async () => {
      try {
        await connection.start()
      } catch {
        // Automatic reconnect covers dropped connections after the first
        // successful start; retry initial startup separately.
        if (active) retryTimer = setTimeout(() => void startConnection(), 5_000)
      }
    }
    void startConnection()

    return () => {
      active = false
      if (retryTimer) clearTimeout(retryTimer)
      connection.off("MediaHostUpdated", refresh)
      connection.off("MediaHostDisplaysUpdated", refresh)
      connection.off("MediaHostConnectionLost", refresh)
      void connection.stop()
    }
  }, [queryClient])

  return query
}
