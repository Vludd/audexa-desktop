import { useMemo, useState } from "react"

import type { AudioFile, Room, Scenario, ScenarioStep } from "@/types"
import type { PlaybackSession, PlaybackState } from "@/api/playback"
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
  onPlay: (id: string) => void
  onTest: (id: string) => void
  onStop: (scenarioId: string) => void
  onPause: () => void
  onResume: () => void
  onPauseSession: (sessionId: string) => void
  onResumeSession: (sessionId: string) => void
  playback?: PlaybackState
  playbackSessions: PlaybackSession[]
  onCreate: (patch?: ScenarioUpdate) => Promise<string>
  onUpdate: (id: string, patch: ScenarioUpdate) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => Promise<string>
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
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
}

const createDraft: Scenario = {
  id: "",
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
  onTest,
  onStop,
  onPause,
  onResume,
  onPauseSession,
  onResumeSession,
  playback,
  playbackSessions,
  onCreate,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
  onValidate,
  roomIdsWithoutOutputs,
  isLoading = false,
  error,
  onRetry,
}: Props) {
  const [selected, setSelected] = useState<string | null>(scenarios[0]?.id ?? null)
  const [query, setQuery] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMode, setSettingsMode] = useState<"create" | "edit">("edit")
  const [createDraftState, setCreateDraftState] = useState<Scenario>(createDraft)
  const confirmation = useConfirm()

  const selectedScenario = scenarios.find((item) => item.id === selected)
  const scenario = selectedScenario ?? scenarios[0]
  const selectedId = scenario?.id ?? null

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
    setCreateDraftState({
      ...createDraft,
      name: t("scenarios.notifications.newName"),
    })
    setSettingsMode("create")
    setSettingsOpen(true)
  }

  const handleSettingsSave = async (patch: ScenarioUpdate) => {
    if (settingsMode === "create") {
      const id = await onCreate(patch)
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
    void onDuplicate(scenario.id).then(setSelected).catch(() => undefined)
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
        {isLoading ? (
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Загрузка сценариев…</p>
          </div>
        ) : error ? (
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium">Не удалось загрузить сценарии</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Проверьте соединение с backend."}
              </p>
              {onRetry && (
                <button
                  type="button"
                  className="mt-3 text-xs font-medium underline underline-offset-4"
                  onClick={onRetry}
                >
                  Повторить
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
        <ScenarioList scenarios={filtered} selected={selectedId} onSelect={setSelected} />

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
            roomIdsWithoutOutputs={roomIdsWithoutOutputs}
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
          playbackStatus={
            playbackSessions.find((session) =>
              session.state.scenarioId === scenario?.id &&
              ["starting", "playing", "paused", "waiting"].includes(session.state.status),
            )?.state.status ?? (playback?.scenarioId === scenario?.id ? playback.status : undefined)
          }
          onPlay={onPlay}
          onTest={onTest}
          onStop={() => { if (scenario) onStop(scenario.id) }}
          onPause={() => {
            const session = playbackSessions.find((item) => item.state.scenarioId === scenario?.id && item.state.status === "playing")
            if (session) onPauseSession(session.sessionId)
            else onPause()
          }}
          onResume={() => {
            const session = playbackSessions.find((item) => item.state.scenarioId === scenario?.id && item.state.status === "paused")
            if (session) onResumeSession(session.sessionId)
            else onResume()
          }}
          onValidate={onValidate}
        />
          </>
        )}
      </div>

      <ScenarioSettings
        key={`${settingsMode}-${scenario?.id ?? "new"}-${settingsOpen}`}
        open={settingsOpen}
        scenario={settingsMode === "create" ? createDraftState : scenario ?? null}
        mode={settingsMode}
        onOpenChange={setSettingsOpen}
        onSave={async (patch) => {
          if (settingsMode === "create") {
            setCreateDraftState((current) => ({ ...current, ...patch }))
          }
          await handleSettingsSave(patch)
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
