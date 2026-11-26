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
import type { VideoFile } from "@/api/video"
import type { MediaHost } from "@/api/mediaHosts"
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
  videoFiles: VideoFile[]
  mediaHosts: MediaHost[]
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
  videoFiles,
  mediaHosts,
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
  const visibleErrors = validation.errors.slice(0, 3)
  const hiddenErrors = validation.errors.slice(3)

  const handleAddStep = () => {
    onAddStep(scenario.id, {
      roomId: "",
      roomName: "",
      audioFileId: null,
      file: "",
      delay: 0,
      duration: 0,
      translationAudioFileId: null,
      translationFile: "",
      translationDuration: 0,
      videoFileId: null,
      videoName: "",
      mediaHostId: null,
      mediaHostName: "",
      displayKey: null,
      videoAudioMode: null,
    })
  }

  return (
    <section className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
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

      <section
        className={[
          "mb-3 overflow-hidden rounded-lg border",
          validation.valid
            ? "border-emerald-500/20 bg-emerald-500/[0.045]"
            : "border-destructive/25 bg-destructive/[0.045]",
        ].join(" ")}
        role={validation.valid ? "status" : "alert"}
        aria-live="polite"
        aria-atomic="false"
        aria-label={
          validation.valid
            ? t("scenarios.editor.ready")
            : t("scenarios.editor.needsFixes")
        }
      >
        {validation.valid ? (
          <div className="flex min-h-10 items-center gap-2.5 px-3 py-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t("scenarios.editor.ready")}
            </span>
          </div>
        ) : (
          <div className="p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <TriangleAlert className="size-4 shrink-0 text-destructive" />
              <h3 className="text-xs font-semibold text-foreground">
                {t("scenarios.editor.needsFixes")}
              </h3>
              <span className="inline-flex h-5 items-center rounded-full bg-destructive/10 px-2 text-[10px] font-semibold tabular-nums text-destructive">
                {validation.errors.length}
              </span>
            </div>

            <ul className="mt-2.5 grid gap-1.5">
              {visibleErrors.map((error, index) => (
                <li
                  key={`${index}-${error}`}
                  className="flex min-w-0 items-start gap-2 rounded-md bg-background/55 px-2.5 py-2 text-xs leading-snug text-foreground/85"
                >
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive/80" />
                  <span className="min-w-0">{error}</span>
                </li>
              ))}
            </ul>

            {hiddenErrors.length > 0 && (
              <details className="group mt-2">
                <summary className="inline-flex min-h-7 cursor-pointer list-none items-center gap-1.5 rounded px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {t("scenarios.editor.moreErrors", {
                    count: hiddenErrors.length,
                  })}
                  <span
                    aria-hidden="true"
                    className="text-[10px] transition-transform group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>
                <ul className="mt-1.5 grid gap-1.5">
                  {hiddenErrors.map((error, index) => (
                    <li
                      key={`${index + 3}-${error}`}
                      className="flex min-w-0 items-start gap-2 rounded-md bg-background/55 px-2.5 py-2 text-xs leading-snug text-foreground/85"
                    >
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive/80" />
                      <span className="min-w-0">{error}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <ScenarioStepsTable
        steps={scenario.steps}
        rooms={rooms}
        audioFiles={audioFiles}
        videoFiles={videoFiles}
        mediaHosts={mediaHosts}
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
