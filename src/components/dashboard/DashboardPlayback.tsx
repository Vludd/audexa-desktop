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
  onStopRoom: (roomId: string) => void
  onVolumeChange: (roomId: string, volume: number) => void
  onGainChange: (audioFileId: string, gainDb: number) => void
}

export default function DashboardPlayback({
  rooms,
  playback,
  onNavigate,
  onPause,
  onResume,
  onStopRoom,
  onVolumeChange,
  onGainChange,
}: DashboardPlaybackProps) {
  const current = playback?.steps.find((step) =>
    step.status === "playing" || step.status === "paused" || step.status === "waiting",
  )
  const next = playback?.nextStep
    ? playback.steps.find((step) => step.step === playback.nextStep)
    : undefined
  const room = current ? rooms.find((item) => item.id === current.roomId) : undefined
  const activeRoomState = playback?.rooms.find((item) => item.roomId === current?.roomId)

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{t("dashboard.playback.title")}</h3>
          {playback?.scenarioName && (
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
                    <span className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Volume2 className="size-3" /> Громкость комнаты {activeRoomState.volume}%</span>
                    <Slider
                      value={[activeRoomState.volume]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(value) => {
                        const volume = typeof value === "number" ? value : value[0]
                        if (volume !== undefined) {
                          onVolumeChange(activeRoomState.roomId, volume)
                        }
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 text-[11px] text-muted-foreground">Усиление файла {activeRoomState.audioGainDb > 0 ? "+" : ""}{activeRoomState.audioGainDb} dB</span>
                    <Slider
                      value={[activeRoomState.audioGainDb]}
                      min={-24}
                      max={24}
                      step={1}
                      onValueChange={(value) => {
                        const gain = typeof value === "number" ? value : value[0]
                        if (gain !== undefined) {
                          onGainChange(activeRoomState.audioFileId ?? "", gain)
                        }
                      }}
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
              <Button size="sm" variant="secondary" onClick={() => onStopRoom(current.roomId)}><Square className="size-3.5" /> Стоп шага</Button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onNavigate("scenarios")}>Открыть сценарий</Button>
            </div>
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
