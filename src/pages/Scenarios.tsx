import { useMemo, useState } from "react"

import type { AudioFile, Room, Scenario, ScenarioStep } from "@/types"
import Header from "@/components/Header"
import { t } from "@/i18n"
import ScenarioEditor from "@/components/scenarios/ScenarioEditor"
import ScenarioList from "@/components/scenarios/ScenarioList"
import ScenarioQuickActions from "@/components/scenarios/ScenarioQuickActions"
import ScenarioSettings from "@/components/scenarios/ScenarioSettings"
import ScenarioToolbar from "@/components/scenarios/ScenarioToolbar"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { useConfirm } from "@/hooks/useConfirm"
import type { ScenarioUpdate, ScenarioValidation } from "@/hooks/useScenarios"

interface Props {
  scenarios: Scenario[]
  rooms: Room[]
  audioFiles: AudioFile[]
  onPlay: (id: number) => void
  onStop: (id: number) => void
  onCreate: (patch?: ScenarioUpdate) => number
  onUpdate: (id: number, patch: ScenarioUpdate) => void
  onDelete: (id: number) => void
  onDuplicate: (id: number) => number
  onAddStep: (scenarioId: number, step?: Partial<ScenarioStep>) => void
  onUpdateStep: (
    scenarioId: number,
    stepId: number,
    patch: Partial<ScenarioStep>,
  ) => void
  onRemoveStep: (scenarioId: number, stepId: number) => void
  onMoveStep: (scenarioId: number, fromIndex: number, toIndex: number) => void
  onValidate: (scenario: Scenario) => ScenarioValidation
}

const createDraft: Scenario = {
  id: 0,
  name: "",
  description: "",
  steps: [],
  status: "inactive",
  playMode: "sequential",
  repeat: "once",
  autoStart: false,
  stopPrevious: true,
  syncTranslation: false,
  crossfade: false,
  notifications: true,
}

export default function Scenarios({
  scenarios,
  rooms,
  audioFiles,
  onPlay,
  onStop,
  onCreate,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
  onValidate,
}: Props) {
  const [selected, setSelected] = useState<number | null>(scenarios[0]?.id ?? null)
  const [query, setQuery] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMode, setSettingsMode] = useState<"create" | "edit">("edit")
  const [createDraftState, setCreateDraftState] = useState<Scenario>(createDraft)
  const confirmation = useConfirm()

  const selectedScenario = scenarios.find((item) => item.id === selected)
  const scenario = selectedScenario ?? scenarios[0]

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return scenarios

    return scenarios.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized),
    )
  }, [scenarios, query])

  const handleCreate = () => {
    setCreateDraftState({ ...createDraft })
    setSettingsMode("create")
    setSettingsOpen(true)
  }

  const handleSettingsSave = (patch: ScenarioUpdate) => {
    if (settingsMode === "create") {
      const id = onCreate(patch)
      setSelected(id)
      setQuery("")
      return
    }

    if (scenario) {
      onUpdate(scenario.id, patch)
    }
  }

  const handleDelete = () => {
    if (!scenario) return

    confirmation.confirm({
      title: t("scenarios.confirmDelete.title"),
      description: t("scenarios.confirmDelete.description", {
        name: scenario.name,
      }),
      variant: "destructive",
      onConfirm: () => {
        const currentIndex = scenarios.findIndex((item) => item.id === scenario.id)
        onDelete(scenario.id)
        const next = scenarios[currentIndex + 1] ?? scenarios[currentIndex - 1]
        setSelected(next?.id ?? null)
      },
    })
  }

  const handleDuplicate = () => {
    if (!scenario) return
    const id = onDuplicate(scenario.id)
    setSelected(id)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header title={t("pages.scenarios.title")} subtitle={t("pages.scenarios.subtitle")} />

      <ScenarioToolbar
        query={query}
        onQueryChange={setQuery}
        hasSelection={Boolean(scenario)}
        onCreate={handleCreate}
        onDuplicate={handleDuplicate}
        onEdit={() => {
          if (!scenario) return
          setSettingsMode("edit")
          setSettingsOpen(true)
        }}
        onDelete={handleDelete}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-auto xl:flex-row xl:overflow-hidden">
        <ScenarioList scenarios={filtered} selected={selected} onSelect={setSelected} />

        {scenario ? (
          <ScenarioEditor
            scenario={scenario}
            rooms={rooms}
            audioFiles={audioFiles}
            onUpdate={onUpdate}
            onOpenSettings={() => {
              setSettingsMode("edit")
              setSettingsOpen(true)
            }}
            onAddStep={onAddStep}
            onUpdateStep={onUpdateStep}
            onRemoveStep={onRemoveStep}
            onMoveStep={onMoveStep}
            onValidate={onValidate}
          />
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium">{t("scenarios.list.emptyTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("scenarios.list.emptyDescription")}
              </p>
            </div>
          </div>
        )}

        <ScenarioQuickActions
          scenario={scenario}
          onPlay={onPlay}
          onStop={onStop}
          onValidate={onValidate}
        />
      </div>

      <ScenarioSettings
        key={`${settingsMode}-${scenario?.id ?? "new"}-${settingsOpen}`}
        open={settingsOpen}
        scenario={settingsMode === "create" ? createDraftState : scenario ?? null}
        mode={settingsMode}
        onOpenChange={setSettingsOpen}
        onSave={(patch) => {
          if (settingsMode === "create") {
            setCreateDraftState((current) => ({ ...current, ...patch }))
          }
          handleSettingsSave(patch)
        }}
      />

      <ConfirmDialog
        open={confirmation.open}
        onOpenChange={(open) => {
          if (!open) confirmation.close()
        }}
        title={confirmation.options?.title ?? ""}
        description={confirmation.options?.description}
        confirmLabel={confirmation.options?.confirmLabel}
        cancelLabel={confirmation.options?.cancelLabel}
        variant={confirmation.options?.variant}
        loading={confirmation.loading}
        onConfirm={confirmation.handleConfirm}
      />
    </div>
  )
}
