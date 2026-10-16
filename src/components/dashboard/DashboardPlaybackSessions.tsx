import { Pause, PlayCircle, SkipForward, Square, AudioLines } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PlaybackSession } from "@/api/playback"
import { formatTime } from "@/lib/audio"
import { t } from "@/i18n"

interface Props {
  sessions: PlaybackSession[]
  onSkipStep: (sessionId: string, stepNumber: number) => void
  onPause: (sessionId: string) => void
  onResume: (sessionId: string) => void
  onStop: (sessionId: string) => void
}

const ACTIVE_STATUSES = new Set(["starting", "playing", "paused", "waiting"])
const ACTIVE_STEP_STATUSES = new Set(["playing", "paused", "waiting", "delaying"])

function statusLabel(status: string) {
  switch (status) {
    case "starting": return t("dashboard.playback.sessionStatus.starting")
    case "playing": return t("dashboard.playback.sessionStatus.playing")
    case "paused": return t("dashboard.playback.sessionStatus.paused")
    case "waiting": return t("dashboard.playback.sessionStatus.waiting")
    default: return status
  }
}

export default function DashboardPlaybackSessions({ sessions, onSkipStep, onPause, onResume, onStop }: Props) {
  const activeSessions = sessions.filter((session) => ACTIVE_STATUSES.has(session.state.status))
  if (activeSessions.length < 2) return null

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <AudioLines className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("dashboard.playback.parallelTitle")}</h3>
        </div>
        <Badge variant="secondary">{t("dashboard.playback.activeCount", { count: activeSessions.length })}</Badge>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {activeSessions.map(({ sessionId, state }) => {
          const current = state.steps.find((step) => ACTIVE_STEP_STATUSES.has(step.status))
          const progress = current && current.durationSeconds > 0
            ? Math.min(100, current.positionSeconds / current.durationSeconds * 100)
            : 0
          return (
            <article key={sessionId} className="min-w-0 rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{state.scenarioName ?? t("dashboard.playback.scenarioFallback")}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t("dashboard.playback.stepProgress", { current: state.currentStep || 1, total: state.totalSteps })}
                  </div>
                </div>
                <Badge variant={state.status === "error" ? "destructive" : state.status === "paused" ? "secondary" : "outline"}>
                  {statusLabel(state.status)}
                </Badge>
              </div>
              {current ? (
                <div className="mt-3 min-w-0">
                  <div className="truncate text-sm">{current.roomName} · {current.audioFileName}</div>
                  {current.status === "delaying" || current.delayRemainingSeconds > 0 ? (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {t("dashboard.playback.delayCountdown", { seconds: current.delayRemainingSeconds.toFixed(1) })}
                    </p>
                  ) : current.status === "waiting" ? (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {t("dashboard.playback.waitingForRoom")}
                    </p>
                  ) : (
                    <>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
                        <span>{formatTime(current.positionSeconds)}</span>
                        <span>{formatTime(current.durationSeconds)}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">{t("dashboard.playback.preparingFirstStep")}</p>
              )}
              <div className="mt-3 rounded border p-2">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("dashboard.playback.allSteps")}</div>
                <div className="max-h-36 space-y-1.5 overflow-auto pr-1">
                  {state.steps.map((step) => (
                    <div key={`${step.step}-${step.roomId}`} className="flex items-start gap-2 text-[11px]">
                      <span className="w-4 shrink-0 font-mono text-muted-foreground">{step.step}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{step.roomName} · {step.audioFileName}</div>
                        {step.delayMs > 0 && <div className="text-muted-foreground">{t("dashboard.playback.stepDelay", { seconds: (step.delayMs / 1000).toFixed(1) })}</div>}
                      </div>
                      <span className="shrink-0 text-muted-foreground">{t(`dashboard.playback.stepStatus.${step.status}` as never)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {current && (
                  <Button size="sm" variant="outline" onClick={() => onSkipStep(sessionId, current.step)}>
                    <SkipForward className="size-3.5" /> {t("dashboard.playback.skipStep")}
                  </Button>
                )}
                {state.status === "paused" ? (
                  <Button size="sm" variant="secondary" onClick={() => onResume(sessionId)}>
                    <PlayCircle className="size-3.5" /> Продолжить
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => onPause(sessionId)} disabled={state.status !== "playing"}>
                    <Pause className="size-3.5" /> Пауза
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onStop(sessionId)}>
                  <Square className="size-3.5" /> Остановить
                </Button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
