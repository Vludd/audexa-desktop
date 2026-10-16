import { useEffect, useRef, useState } from "react"
import { Pause, PlayCircle, Square, Volume2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import type { Room } from "@/types"
import type { PlaybackState } from "@/api/playback"
import { t } from "@/i18n"
import { formatTime } from "@/lib/audio"

interface DashboardPlaybackProps {
  rooms: Room[]
  playback?: PlaybackState
  onNavigate: (page: string) => void
  onPause: () => void
  onResume: () => void
  onSkipStep: (roomId: string) => void
  onVolumeChange: (roomId: string, volume: number) => Promise<void>
  onGainChange: (audioFileId: string, gainDb: number) => Promise<void>
}

export default function DashboardPlayback({
  rooms,
  playback,
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
  const current = isPlaybackActive
    ? playback?.steps.find((step) =>
        step.status === "playing" || step.status === "paused" || step.status === "waiting",
      )
    : undefined
  const next = isPlaybackActive && playback?.nextStep
    ? playback.steps.find((step) => step.step === playback.nextStep)
    : undefined
  const room = current ? rooms.find((item) => item.id === current.roomId) : undefined
  const activeRoomState = playback?.rooms.find((item) => item.roomId === current?.roomId)
  const [roomVolume, setRoomVolume] = useState(activeRoomState?.volume ?? 100)
  const [audioGainDb, setAudioGainDb] = useState(activeRoomState?.audioGainDb ?? 0)
  const roomVolumeRef = useRef(roomVolume)
  const audioGainRef = useRef(audioGainDb)
  const roomVolumeCommittedRef = useRef(roomVolume)
  const audioGainCommittedRef = useRef(audioGainDb)
  const roomVolumeDraggingRef = useRef(false)
  const audioGainDraggingRef = useRef(false)

  useEffect(() => {
    if (!activeRoomState) return
    if (!roomVolumeDraggingRef.current) {
      setRoomVolume(activeRoomState.volume)
      roomVolumeRef.current = activeRoomState.volume
      roomVolumeCommittedRef.current = activeRoomState.volume
    }
    if (!audioGainDraggingRef.current) {
      setAudioGainDb(activeRoomState.audioGainDb)
      audioGainRef.current = activeRoomState.audioGainDb
      audioGainCommittedRef.current = activeRoomState.audioGainDb
    }
  }, [activeRoomState?.roomId, activeRoomState?.audioFileId, activeRoomState?.volume, activeRoomState?.audioGainDb])

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
              {playback.scenarioName} · шаг {playback.currentStep}/{playback.totalSteps}
            </p>
          )}
        </div>
        {current && <Badge variant="success">{playback?.status === "waiting" ? "Ожидание" : playback?.status === "paused" ? "Пауза" : "Играет"}</Badge>}
      </div>

      <div className="p-3.5">
        {playback && current && room ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Сейчас</div>
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

              {playback.status === "waiting" && (
                <div className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  Начало шага через {current.delayRemainingSeconds.toFixed(1)} сек.
                </div>
              )}

              {activeRoomState && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Volume2 className="size-3" /> Громкость комнаты {roomVolume}%</span>
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
                    <span className="mb-1 text-[11px] text-muted-foreground">Усиление файла {audioGainDb > 0 ? "+" : ""}{audioGainDb} dB</span>
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
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Следующий</div>
                <div className="mt-1 font-semibold">{String(next.step).padStart(2, "0")} — {next.roomName}</div>
                <div className="text-xs text-muted-foreground">{next.audioFileName} · перед стартом {next.delayMs / 1000}s</div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {playback.status === "paused" ? (
                <Button size="sm" onClick={onResume}><PlayCircle className="size-3.5" /> Продолжить</Button>
              ) : (
                <Button size="sm" onClick={onPause} disabled={playback.status !== "playing"}><Pause className="size-3.5" /> Пауза</Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => onSkipStep(current.roomId)}><Square className="size-3.5" /> Пропустить шаг</Button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onNavigate("scenarios")}>Открыть сценарий</Button>
            </div>
          </div>
        ) : playback?.status === "error" ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="text-sm font-semibold text-destructive">Воспроизведение остановлено из-за ошибки</div>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {playback.error || "Проверьте аудиоустройство и конфигурацию выходов."}
            </p>
            <Button variant="link" className="mt-2 h-auto p-0 text-xs" onClick={() => onNavigate("scenarios")}>Открыть сценарии</Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <PlayCircle className="mb-2 size-7 text-muted-foreground/50" />
            <div className="text-sm text-muted-foreground">{t("dashboard.playback.empty")}</div>
            <Button variant="link" className="mt-1 h-auto p-0 text-xs" onClick={() => onNavigate("scenarios")}>Открыть сценарии</Button>
          </div>
        )}
      </div>
    </div>
  )
}
