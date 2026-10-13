import {
  AlertTriangle,
  Headphones,
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

interface Props {
  scenario?: Scenario

  onPlay: (id: number) => void
  onStop: (id: number) => void

  onValidate: (
    scenario: Scenario,
  ) => ScenarioValidation
}

export default function ScenarioQuickActions({
  scenario,
  onPlay,
  onStop,
  onValidate,
}: Props) {
  const validation = scenario
    ? onValidate(scenario)
    : null

  const canRun =
    Boolean(scenario) &&
    scenario?.status === "active" &&
    Boolean(validation?.valid)

  const handlePlay = () => {
    if (!scenario) return

    if (!validation?.valid) {
      toast.error(t("scenarios.quickActions.cannotRun"), {
        description: validation?.errors.join(" "),
      })

      return
    }

    onPlay(scenario.id)
  }

  return (
    <aside className="w-full shrink-0 border-t bg-card p-3.5 xl:w-[210px] xl:border-l xl:border-t-0">
      <div className="mb-3 text-sm font-semibold">
        {t("scenarios.quickActions.title")}
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="success"
          className="w-full justify-start"
          disabled={!canRun}
          onClick={handlePlay}
        >
          <Play
            className="size-4"
            fill="currentColor"
          />
          {t("scenarios.quickActions.run")}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          disabled={!scenario}
        >
          <Pause className="size-4" />
          {t("scenarios.quickActions.pause")}
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="w-full justify-start"
          disabled={!scenario}
          onClick={() =>
            scenario && onStop(scenario.id)
          }
        >
          <Square className="size-4" />
          {t("scenarios.quickActions.stop")}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={!canRun}
          onClick={() => {
            if (!scenario) return

            if (!validation?.valid) {
              return
            }

            toast.info(
              t("scenarios.quickActions.testRun", {
                name: scenario.name,
              }),
            )
          }}
        >
          <Headphones className="size-3.5" />
          {t("scenarios.quickActions.test")}
        </Button>
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