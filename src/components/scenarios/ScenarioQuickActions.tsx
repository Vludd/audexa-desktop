import {
  AlertTriangle,
  LoaderCircle,
  Pause,
  Play,
  Square,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import type { Scenario } from "@/types"
import type { ScenarioValidation } from "@/hooks/useScenarios"
import { t } from "@/i18n"
import { toast } from "@/lib/toast"
import { useState } from "react"

interface Props {
  scenario?: Scenario
  playbackStatus?: string
  onPlay: (id: string) => void | Promise<void>
  onStop: () => void
  onPause: () => void
  onResume: () => void
  onValidate: (scenario: Scenario) => ScenarioValidation
}

export default function ScenarioQuickActions({
  scenario,
  playbackStatus,
  onPlay,
  onStop,
  onPause,
  onResume,
  onValidate,
}: Props) {
  const validation = scenario ? onValidate(scenario) : null
  const canRun = Boolean(scenario) && scenario?.status === "active" && Boolean(validation?.valid)
  const isThisScenario = Boolean(scenario && ["starting", "playing", "paused", "waiting"].includes(playbackStatus ?? ""))
  const [isStarting, setIsStarting] = useState(false)

  const handlePlay = async () => {
    if (!scenario || !validation || !canRun || isStarting) return

    if (!validation.valid) {
      toast.error(t("scenarios.quickActions.cannotRun"), {
        description: validation.errors.join(" "),
      })
      return
    }

    try {
      setIsStarting(true)
      await onPlay(scenario.id)
    } catch {
      toast.error(t("scenarios.quickActions.cannotRun"))
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <aside className="w-full shrink-0 border-t bg-card p-3.5 xl:w-[210px] xl:border-l xl:border-t-0">
      <div className="mb-3 text-sm font-semibold">{t("scenarios.quickActions.title")}</div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="success"
          className="w-full justify-start"
          disabled={!canRun || isStarting || isThisScenario}
          onClick={() => void handlePlay()}
        >
          {isStarting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" fill="currentColor" />
          )}

          {isStarting ? "Запуск…" : t("scenarios.quickActions.run")}
        </Button>

        {playbackStatus === "paused" ? (
          <Button type="button" variant="outline" className="w-full justify-start" onClick={onResume}>
            <Play className="size-4" />
            Продолжить
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={!isThisScenario || playbackStatus !== "playing"}
            onClick={onPause}
          >
            <Pause className="size-4" />
            {t("scenarios.quickActions.pause")}
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          className="w-full justify-start"
          disabled={!isThisScenario}
          onClick={onStop}
        >
          <Square className="size-4" />
          {t("scenarios.quickActions.stop")}
        </Button>

        {/* <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={!canRun || isThisScenario}
          onClick={() => scenario && onTest(scenario.id)}
        >
          <Headphones className="size-3.5" />
          Тестовый запуск
        </Button>
        <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
          Тестовый запуск воспроизводит звук через выбранные аудиовыходы.
        </p> */}
      </div>

      {scenario && !validation?.valid && (
        <>
          <Separator className="my-4" />
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
              <AlertTriangle className="size-3.5" />
              {t("scenarios.quickActions.notReady")}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("scenarios.quickActions.fixErrors")}
            </p>
          </div>
        </>
      )}
    </aside>
  )
}
