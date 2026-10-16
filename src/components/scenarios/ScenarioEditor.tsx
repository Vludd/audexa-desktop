import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { AudioFile, Room, Scenario, ScenarioStep } from "@/types"
import type { ScenarioSaveStatus, ScenarioUpdate, ScenarioValidation } from "@/hooks/useScenarios"
import ScenarioStepsTable from "./ScenarioStepsTable"
import { t } from "@/i18n"
import { formatTime } from "@/lib/audio"
import { getScenarioDuration } from "@/lib/scenarios"

interface Props {
  scenario: Scenario
  saveStatus?: ScenarioSaveStatus
  onRetrySave: () => void
  rooms: Room[]
  audioFiles: AudioFile[]
  onUpdate: (id: string, patch: ScenarioUpdate) => void
  onOpenSettings: () => void
  onAddStep: (scenarioId: string, step?: Partial<ScenarioStep>) => void
  onUpdateStep: (
    scenarioId: string,
    stepId: string,
    patch: Partial<ScenarioStep>,
  ) => void
  onRemoveStep: (scenarioId: string, stepId: string) => void
  onMoveStep: (scenarioId: string, fromIndex: number, toIndex: number) => void
  onValidate: (scenario: Scenario) => ScenarioValidation
  roomIdsWithoutOutputs: Set<string>
}

export default function ScenarioEditor({
  scenario,
  saveStatus,
  onRetrySave,
  rooms,
  audioFiles,
  onUpdate,
  onOpenSettings,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
  onValidate,
  roomIdsWithoutOutputs,
}: Props) {
  const duration = getScenarioDuration(scenario)
  const validation = onValidate(scenario)

  const handleAddStep = () => {
    onAddStep(scenario.id, {
      roomId: "",
      roomName: "",
      audioFileId: null,
      file: "",
      delay: 0,
      duration: 0,
    })
  }

  return (
    <section className="min-w-0 flex-none overflow-auto p-4 xl:flex-1">
      <div className="mb-4 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-bold">{scenario.name}</h2>
            <Badge
              variant={scenario.status === "active" ? "success" : "secondary"}
            >
              {scenario.status === "active"
                ? t("scenarios.editor.active")
                : t("scenarios.editor.inactive")}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {scenario.description || t("scenarios.editor.descriptionEmpty")}
          </p>
          {saveStatus && (
            <div
              className={[
                "mt-2 flex flex-wrap items-center gap-1.5 text-xs",
                saveStatus === "error" ? "text-destructive" :
                saveStatus === "saved" ? "text-emerald-600 dark:text-emerald-400" :
                "text-muted-foreground",
              ].join(" ")}
              role={saveStatus === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {saveStatus === "scheduled" || saveStatus === "saving" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : saveStatus === "saved" ? (
                <CheckCircle2 className="size-3.5" />
              ) : saveStatus === "error" ? (
                <AlertCircle className="size-3.5" />
              ) : (
                <AlertCircle className="size-3.5" />
              )}
              <span>{t(`scenarios.editor.saveStatus.${saveStatus}`)}</span>
              {saveStatus === "error" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-6 px-1.5 text-xs"
                  onClick={onRetrySave}
                >
                  <RefreshCw className="size-3" />
                  {t("scenarios.editor.retrySave")}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
            <span className="text-[10px] text-muted-foreground">
              {t("scenarios.settings.active")}
            </span>
            <Switch
              checked={scenario.status === "active"}
              onCheckedChange={(active) =>
                onUpdate(scenario.id, {
                  status: active ? "active" : "inactive",
                })
              }
              aria-label={t("scenarios.settings.active")}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
          >
            <Settings2 className="size-3.5" />
            {t("scenarios.toolbar.edit")}
          </Button>
          <InfoPill
            label={t("scenarios.editor.duration")}
            value={formatTime(duration)}
          />
          <InfoPill
            label={t("scenarios.editor.steps")}
            value={String(scenario.steps.length)}
          />
        </div>
      </div>

      <div
        className={
          validation.valid
            ? "mb-3 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
            : "mb-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2"
        }
      >
        {validation.valid ? (
          <>
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="text-xs">{t("scenarios.editor.ready")}</span>
          </>
        ) : (
          <>
            <TriangleAlert className="size-4 text-destructive" />
            <div className="min-w-0">
              <div className="text-xs font-semibold">
                {t("scenarios.editor.needsFixes")}
              </div>
              <ul className="mt-1 list-inside list-disc text-[11px] text-muted-foreground">
                {validation.errors.slice(0, 3).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
              {validation.errors.length > 3 && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {t("scenarios.editor.moreErrors", {
                    count: validation.errors.length - 3,
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ScenarioStepsTable
        steps={scenario.steps}
        rooms={rooms}
        audioFiles={audioFiles}
        roomIdsWithoutOutputs={roomIdsWithoutOutputs}
        onUpdateStep={(stepId, patch) =>
          onUpdateStep(scenario.id, stepId, patch)
        }
        onRemoveStep={(stepId) => onRemoveStep(scenario.id, stepId)}
        onMoveStep={(fromIndex, toIndex) =>
          onMoveStep(scenario.id, fromIndex, toIndex)
        }
      />

      <div className="my-3 flex items-center gap-2">
        <Button type="button" size="sm" onClick={handleAddStep}>
          <Plus className="size-3.5" />
          {t("scenarios.editor.addStep")}
        </Button>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {t("scenarios.editor.totalDuration")} {" "}
          <strong className="text-foreground">{formatTime(duration)}</strong>
        </span>
      </div>
    </section>
  )
}

function InfoPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-[84px] rounded-md border bg-muted/40 px-2.5 py-1.5 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  )
}
