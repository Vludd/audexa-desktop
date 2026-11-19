import { useEffect, useRef, useState, type FormEvent } from "react"
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr"
import {
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react"

import { API_BASE_URL } from "@/api/client"
import {
  playbackApi,
  type PlaybackCommandPayload,
  type PlaybackCommandUpdate,
  type PlaybackState,
} from "@/api/mediaHosts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { t } from "@/i18n"

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected"
type PlaybackCommandInput = Omit<PlaybackCommandPayload, "displayKey">

function formatTime(ms: number) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds / 60) % 60
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  return `${Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function getMediaName(media: string | null | undefined) {
  if (!media) return null

  const parts = media.split(/[\\/]/)
  return parts[parts.length - 1] || media
}

function getPlaybackLabel(state: string | undefined) {
  switch (state?.toLowerCase()) {
    case "opening":
      return t("mediaHosts.playback.states.opening")
    case "buffering":
      return t("mediaHosts.playback.states.buffering")
    case "playing":
      return t("mediaHosts.playback.states.playing")
    case "paused":
      return t("mediaHosts.playback.states.paused")
    case "stopped":
      return t("mediaHosts.playback.states.stopped")
    case "ended":
      return t("mediaHosts.playback.states.ended")
    case "error":
      return t("mediaHosts.playback.states.error")
    default:
      return state || t("mediaHosts.playback.states.idle")
  }
}

function getPlaybackVariant(state: string | undefined) {
  switch (state?.toLowerCase()) {
    case "playing":
      return "success"
    case "opening":
    case "buffering":
      return "warning"
    case "paused":
      return "secondary"
    case "error":
      return "destructive"
    default:
      return "outline"
  }
}

function getSliderValue(value: number | readonly number[]) {
  return typeof value === "number" ? value : value[0] ?? 0
}

export default function DisplayPlaybackControls({
  hostId,
  displayKey,
}: {
  hostId: string
  displayKey: string
}) {
  const [state, setState] = useState<PlaybackState | null>(null)
  const [filePath, setFilePath] = useState("")
  const [busy, setBusy] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting")
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [seekDraft, setSeekDraft] = useState<number | null>(null)
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null)
  const isSeeking = useRef(false)
  const isAdjustingVolume = useRef(false)

  useEffect(() => {
    let active = true
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL.replace(/\/+$/, "")}/hubs/media-hosts-ui`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on("PlaybackStatesUpdated", (items: PlaybackState[]) => {
      if (!active) return

      const current = items.find(
        (item) => item.hostId === hostId && item.displayKey === displayKey,
      )

      if (!current) return

      setState(current)
      if (!isSeeking.current) setSeekDraft(null)
      if (!isAdjustingVolume.current) setVolumeDraft(null)
    })

    connection.on(
      "PlaybackCommandUpdated",
      (command: PlaybackCommandUpdate) => {
        if (!active) return

        if (
          command.hostId.toLowerCase() !== hostId.toLowerCase() ||
          command.displayKey.toLowerCase() !== displayKey.toLowerCase()
        ) {
          return
        }

        if (command.status.toLowerCase() === "failed") {
          setCommandError(
            command.error ?? t("mediaHosts.playback.commandFailed"),
          )
        } else if (command.status.toLowerCase() === "completed") {
          setCommandError(null)
        }
      },
    )

    connection.onreconnecting(() => {
      if (!active) return
      setConnectionStatus("reconnecting")
      setConnectionError(t("mediaHosts.playback.connectionError"))
    })

    connection.onreconnected(() => {
      if (!active) return
      setConnectionStatus("connected")
      setConnectionError(null)
    })

    connection.onclose(() => {
      if (!active) return
      setConnectionStatus("disconnected")
      setConnectionError(t("mediaHosts.playback.connectionError"))
    })

    void connection
      .start()
      .then(() => {
        if (!active) return
        setConnectionStatus("connected")
        setConnectionError(null)
      })
      .catch(() => {
        if (!active) return
        setConnectionStatus("disconnected")
        setConnectionError(t("mediaHosts.playback.connectionError"))
      })

    return () => {
      active = false
      void connection.stop()
    }
  }, [displayKey, hostId])

  async function command(
    payload: PlaybackCommandInput,
  ) {
    setBusy(true)
    setCommandError(null)

    try {
      await playbackApi.command(hostId, { ...payload, displayKey })
    } catch (error) {
      setCommandError(
        error instanceof Error
          ? error.message
          : t("mediaHosts.playback.commandFailed"),
      )
    } finally {
      setBusy(false)
    }
  }

  const duration = Math.max(0, state?.durationMs ?? 0)
  const serverPosition = Math.min(
    Math.max(0, state?.positionMs ?? 0),
    duration,
  )
  const position = Math.min(seekDraft ?? serverPosition, duration)
  const volume = Math.min(
    100,
    Math.max(0, volumeDraft ?? state?.volume ?? 100),
  )
  const normalizedState = state?.state.toLowerCase()
  const isPlaying = normalizedState === "playing"
  const isPaused = normalizedState === "paused"
  const canStop =
    state != null &&
    !["idle", "stopped", "ended"].includes(normalizedState ?? "")
  const connectionLabel = {
    connecting: t("mediaHosts.playback.connecting"),
    connected: t("mediaHosts.playback.connected"),
    reconnecting: t("mediaHosts.playback.reconnecting"),
    disconnected: t("mediaHosts.playback.disconnected"),
  }[connectionStatus]
  const connectionVariant =
    connectionStatus === "connected"
      ? "success"
      : connectionStatus === "connecting" ||
          connectionStatus === "reconnecting"
        ? "warning"
        : "secondary"
  const errorMessage = commandError ?? state?.error

  function handleSeekChange(value: number | readonly number[]) {
    isSeeking.current = true
    setSeekDraft(getSliderValue(value))
  }

  function handleSeekCommit(value: number | readonly number[]) {
    const nextPosition = Math.min(
      duration,
      Math.max(0, getSliderValue(value)),
    )
    isSeeking.current = false
    setSeekDraft(nextPosition)
    setState((current) =>
      current ? { ...current, positionMs: nextPosition } : current,
    )
    void command({ action: "seek", positionMs: nextPosition })
  }

  function handleVolumeChange(value: number | readonly number[]) {
    isAdjustingVolume.current = true
    setVolumeDraft(Math.min(100, Math.max(0, getSliderValue(value))))
  }

  function handleVolumeCommit(value: number | readonly number[]) {
    const nextVolume = Math.min(100, Math.max(0, getSliderValue(value)))
    isAdjustingVolume.current = false
    setVolumeDraft(nextVolume)
    setState((current) =>
      current ? { ...current, volume: nextVolume } : current,
    )
    void command({ action: "volume", volume: nextVolume })
  }

  function handlePlayFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const path = filePath.trim()
    if (!path) return
    void command({ action: "play", filePath: path })
  }

  function handleMute() {
    const muted = !(state?.isMuted ?? false)
    setState((current) => (current ? { ...current, isMuted: muted } : current))
    void command({ action: "mute", muted })
  }

  return (
    <div className="w-full space-y-4 rounded-lg border bg-background p-3 sm:p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {getMediaName(state?.media) ??
              t("mediaHosts.playback.noMediaLoaded")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant={getPlaybackVariant(state?.state)}>
            {getPlaybackLabel(state?.state)}
          </Badge>
          <Badge variant={connectionVariant}>{connectionLabel}</Badge>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{t("mediaHosts.playback.position")}</span>
          <span className="shrink-0 tabular-nums">
            {formatTime(position)} / {formatTime(duration)}
          </span>
        </div>
        <Slider
          value={[position]}
          min={0}
          max={Math.max(1, duration)}
          step={1000}
          disabled={!duration || busy}
          onValueChange={handleSeekChange}
          onValueCommitted={handleSeekCommit}
          aria-label={t("mediaHosts.playback.position")}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!isPlaying || busy}
            onClick={() => void command({ action: "pause" })}
            aria-label={t("mediaHosts.playback.pause")}
            title={t("mediaHosts.playback.pause")}
          >
            <Pause />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!isPaused || busy}
            onClick={() => void command({ action: "resume" })}
            aria-label={t("mediaHosts.playback.resume")}
            title={t("mediaHosts.playback.resume")}
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!canStop || busy}
            onClick={() => void command({ action: "stop" })}
            aria-label={t("mediaHosts.playback.stop")}
            title={t("mediaHosts.playback.stop")}
          >
            <Square />
          </Button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={handleMute}
            aria-label={
              state?.isMuted
                ? t("mediaHosts.playback.unmute")
                : t("mediaHosts.playback.mute")
            }
            title={
              state?.isMuted
                ? t("mediaHosts.playback.unmute")
                : t("mediaHosts.playback.mute")
            }
          >
            {state?.isMuted ? <VolumeX /> : <Volume2 />}
          </Button>
          <Slider
            className="min-w-0 flex-1"
            value={[volume]}
            min={0}
            max={100}
            step={1}
            disabled={busy}
            onValueChange={handleVolumeChange}
            onValueCommitted={handleVolumeCommit}
            aria-label={t("mediaHosts.playback.volume")}
          />
          <span className="min-w-9 text-right text-xs font-medium tabular-nums">
            {volume}%
          </span>
        </div>
      </div>

      <form
        className="flex min-w-0 flex-col gap-2 sm:flex-row"
        onSubmit={handlePlayFile}
      >
        <Input
          value={filePath}
          onChange={(event) => setFilePath(event.currentTarget.value)}
          placeholder={t("mediaHosts.playback.filePathPlaceholder")}
          aria-label={t("mediaHosts.playback.filePathPlaceholder")}
          autoComplete="off"
          disabled={busy}
        />
        <Button
          type="submit"
          className="shrink-0"
          disabled={busy || !filePath.trim()}
        >
          <Play />
          {t("mediaHosts.playback.playFile")}
        </Button>
      </form>

      {(errorMessage || connectionError) && (
        <div
          role="alert"
          className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {errorMessage && <p>{errorMessage}</p>}
          {connectionError && <p>{connectionError}</p>}
        </div>
      )}
    </div>
  )
}
