import { useEffect, useRef, useState } from "react"
import { Pause, PlayCircle, Square, Volume2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import type { Room, SystemStatus } from "@/types"
import type { PlaybackSession, PlaybackState } from "@/api/playback"
import { t } from "@/i18n"
import { formatTime } from "@/lib/audio"

interface DashboardPlaybackProps {
  rooms: Room[]
  system: SystemStatus
  playback?: PlaybackState
  playbackSessions: PlaybackSession[]
  onNavigate: (page: string) => void
  onPause: () => void
  onResume: () => void
  onSkipStep: (sessionId: string, stepNumber: number) => void
  onVolumeChange: (roomId: string, volume: number) => Promise<void>
  onGainChange: (audioFileId: string, gainDb: number) => Promise<void>
}

export default function DashboardPlayback({
  rooms,
  system,
  playback,
  playbackSessions,
  onNavigate,
  onPause,
  onResume,
  onSkipStep,
  onVolumeChange,
  onGainChange,
}: DashboardPlaybackProps) {
  // A step can retain its last status in the execution history after the
  // scenario has stopped. Only show it as current playback while the parent
  // playback state confirms that execution is active.
  const isPlaybackActive = Boolean(
    playback && ["starting", "playing", "paused", "waiting"].includes(playback.status),
  )
  // Playback keeps its terminal error for history. Do not present a stale
  // device-disconnect error as a current incident after the device is healthy.
  const playbackErrorText = playback?.error?.toLowerCase() ?? ""
  const isStaleDeviceError = Boolean(
    playback?.status === "error" &&
    (playbackErrorText.includes("device") || playbackErrorText.includes("аудиоустрой")) &&
    (playbackErrorText.includes("disconnect") ||
      playbackErrorText.includes("unavailable") ||
      playbackErrorText.includes("отключ") ||
      playbackErrorText.includes("недоступ")),
  )
  const showPlaybackError = playback?.status === "error" &&
    (!isStaleDeviceError || system.state === "disconnected" || system.state === "error" || system.backend === "offline")
  const current = isPlaybackActive
    ? playback?.steps.find((step) =>
        step.status === "playing" || step.status === "paused" || step.status === "waiting" || step.status === "delaying",
      )
    : undefined
  const next = isPlaybackActive && playback?.nextStep
    ? playback.steps.find((step) => step.step === playback.nextStep)
    : undefined
  const room = current ? rooms.find((item) => item.id === current.roomId) : undefined
  const currentSession = playbackSessions.find((session) =>
    session.state.scenarioId === playback?.scenarioId &&
    session.state.currentStep === playback?.currentStep &&
    ["starting", "playing", "paused", "waiting"].includes(session.state.status),
  )
  const activeRoomState = playback?.rooms.find((item) => item.roomId === current?.roomId)
  const activeRoomId = activeRoomState?.roomId
  const activeRoomAudioFileId = activeRoomState?.audioFileId
  const activeRoomVolume = activeRoomState?.volume
  const activeRoomAudioGainDb = activeRoomState?.audioGainDb
  const [roomVolume, setRoomVolume] = useState(activeRoomState?.volume ?? 100)
  const [audioGainDb, setAudioGainDb] = useState(activeRoomState?.audioGainDb ?? 0)
  const roomVolumeRef = useRef(roomVolume)
  const audioGainRef = useRef(audioGainDb)
  const roomVolumeCommittedRef = useRef(roomVolume)
  const audioGainCommittedRef = useRef(audioGainDb)
  const roomVolumeDraggingRef = useRef(false)
  const audioGainDraggingRef = useRef(false)

  useEffect(() => {
    if (
      activeRoomId === undefined ||
      activeRoomVolume === undefined ||
      activeRoomAudioGainDb === undefined
    ) return
    if (!roomVolumeDraggingRef.current) {
      setRoomVolume(activeRoomVolume)
      roomVolumeRef.current = activeRoomVolume
      roomVolumeCommittedRef.current = activeRoomVolume
    }
    if (!audioGainDraggingRef.current) {
      setAudioGainDb(activeRoomAudioGainDb)
      audioGainRef.current = activeRoomAudioGainDb
      audioGainCommittedRef.current = activeRoomAudioGainDb
    }
  }, [activeRoomId, activeRoomAudioFileId, activeRoomVolume, activeRoomAudioGainDb])

  const commitRoomVolume = async () => {
    const value = roomVolumeRef.current
    if (value === roomVolumeCommittedRef.current || !activeRoomState) {
      roomVolumeDraggingRef.current = false
      return
    }
    roomVolumeCommittedRef.current = value
    try {
      await onVolumeChange(activeRoomState.roomId, value)
    } catch {
      const fallback = activeRoomState.volume
      roomVolumeRef.current = fallback
      roomVolumeCommittedRef.current = fallback
      setRoomVolume(fallback)
    } finally {
      roomVolumeDraggingRef.current = false
    }
  }

  const commitAudioGain = async () => {
    const value = audioGainRef.current
    if (value === audioGainCommittedRef.current || !activeRoomState?.audioFileId) {
      audioGainDraggingRef.current = false
      return
    }
    audioGainCommittedRef.current = value
    try {
      await onGainChange(activeRoomState.audioFileId, value)
    } catch {
      const fallback = activeRoomState.audioGainDb
      audioGainRef.current = fallback
      audioGainCommittedRef.current = fallback
      setAudioGainDb(fallback)
    } finally {
      audioGainDraggingRef.current = false
    }
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{t("dashboard.playback.title")}</h3>
          {isPlaybackActive && playback?.scenarioName && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {playback.scenarioName} · {t("dashboard.playback.stepProgress", { current: playback.currentStep, total: playback.totalSteps })}
            </p>
          )}
        </div>
        {current && <Badge variant="success">{playback?.status === "waiting" ? t("dashboard.playback.statusWaiting") : playback?.status === "paused" ? t("dashboard.playback.statusPaused") : t("dashboard.playback.statusPlaying")}</Badge>}
      </div>

      <div className="p-3.5">
        {playback && current && room ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("dashboard.playback.current")}</div>
              <div className="mt-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold">{String(playback.currentStep).padStart(2, "0")} — {room.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{current.audioFileName}</div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">OUT {current.outputId?.split(":").pop() ?? "—"}</span>
              </div>

              <div className="mt-3">
                <Progress value={current.durationSeconds > 0 ? Math.min(100, current.positionSeconds / current.durationSeconds * 100) : 0} className="h-2" />
                <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
                  <span>{formatTime(current.positionSeconds)}</span>
                  <span>{formatTime(current.durationSeconds)}</span>
                </div>
              </div>

              {(current.status === "delaying" || current.delayRemainingSeconds > 0) && (
                <div className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {t("dashboard.playback.delayCountdown", { seconds: current.delayRemainingSeconds.toFixed(1) })}
                </div>
              )}
              {current.status === "waiting" && current.delayRemainingSeconds <= 0 && (
                <div className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {t("dashboard.playback.waitingForRoom")}
                </div>
              )}

              {activeRoomState && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Volume2 className="size-3" /> {t("dashboard.playback.roomVolume", { volume: roomVolume })}</span>
                    <Slider
                      value={[roomVolume]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(value) => {
                        const volume = typeof value === "number" ? value : value[0]
                        if (volume !== undefined) {
                          roomVolumeRef.current = volume
                          setRoomVolume(volume)
                        }
                      }}
                      onPointerDown={() => { roomVolumeDraggingRef.current = true }}
                      onPointerUp={commitRoomVolume}
                      onKeyDown={() => { roomVolumeDraggingRef.current = true }}
                      onKeyUp={commitRoomVolume}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 text-[11px] text-muted-foreground">{t("dashboard.playback.fileGain", { gain: `${audioGainDb > 0 ? "+" : ""}${audioGainDb}` })}</span>
                    <Slider
                      value={[audioGainDb]}
                      min={-24}
                      max={24}
                      step={1}
                      onValueChange={(value) => {
                        const gain = typeof value === "number" ? value : value[0]
                        if (gain !== undefined) {
                          audioGainRef.current = gain
                          setAudioGainDb(gain)
                        }
                      }}
                      onPointerDown={() => { audioGainDraggingRef.current = true }}
                      onPointerUp={commitAudioGain}
                      onKeyDown={() => { audioGainDraggingRef.current = true }}
                      onKeyUp={commitAudioGain}
                      disabled={!activeRoomState.audioFileId}
                    />
                  </label>
                </div>
              )}
            </div>

            {next && (
              <div className="rounded-md border border-dashed p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("dashboard.playback.next")}</div>
                <div className="mt-1 font-semibold">{String(next.step).padStart(2, "0")} — {next.roomName}</div>
                <div className="text-xs text-muted-foreground">{next.audioFileName} · {t("dashboard.playback.nextDelay", { seconds: next.delayMs / 1000 })}</div>
              </div>
            )}

            <div className="rounded-md border p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("dashboard.playback.allSteps")}</div>
              <div className="max-h-48 space-y-2 overflow-auto pr-1">
                {playback.steps.map((step) => (
                  <div key={`${step.step}-${step.roomId}`} className="flex items-start gap-2 text-xs">
                    <span className="w-5 shrink-0 font-mono text-muted-foreground">{String(step.step).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{step.roomName} · {step.audioFileName}</div>
                      {step.delayMs > 0 && <div className="text-muted-foreground">{t("dashboard.playback.stepDelay", { seconds: (step.delayMs / 1000).toFixed(1) })}</div>}
                    </div>
                    <span className={step.status === "playing" ? "shrink-0 text-primary" : step.status === "waiting" || step.status === "delaying" ? "shrink-0 text-amber-600 dark:text-amber-400" : "shrink-0 text-muted-foreground"}>
                      {t(`dashboard.playback.stepStatus.${step.status}` as never)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {playback.status === "paused" ? (
                <Button size="sm" onClick={onResume}><PlayCircle className="size-3.5" /> {t("common.resume")}</Button>
              ) : (
                <Button size="sm" onClick={onPause} disabled={playback.status !== "playing"}><Pause className="size-3.5" /> {t("common.pause")}</Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => currentSession && onSkipStep(currentSession.sessionId, current.step)}
                disabled={!currentSession}
              ><Square className="size-3.5" /> {t("dashboard.playback.skipStep")}</Button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onNavigate("scenarios")}>{t("dashboard.playback.openScenario")}</Button>
            </div>
          </div>
        ) : showPlaybackError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="text-sm font-semibold text-destructive">{t("dashboard.playback.errorTitle")}</div>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {playback.error || t("dashboard.playback.errorDescription")}
            </p>
            <Button variant="link" className="mt-2 h-auto p-0 text-xs" onClick={() => onNavigate("scenarios")}>{t("dashboard.playback.openScenarios")}</Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <PlayCircle className="mb-2 size-7 text-muted-foreground/50" />
            <div className="text-sm text-muted-foreground">{t("dashboard.playback.empty")}</div>
            <Button variant="link" className="mt-1 h-auto p-0 text-xs" onClick={() => onNavigate("scenarios")}>{t("dashboard.playback.openScenarios")}</Button>
          </div>
        )}
      </div>
    </div>
  )
}
