import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { scenariosApi } from "@/api/scenarios"
import { audioSettingsApi } from "@/api/audioSettings"
import { playbackApi } from "@/api/playback"
import type { AudioFile, Room, Scenario, ScenarioStep } from "@/types"
import { t } from "@/i18n"
import { toast } from "@/lib/toast"

const SCENARIOS_QUERY_KEY = ["scenarios"] as const
const AUDIO_SETTINGS_QUERY_KEY = ["audio-settings"] as const

export interface ScenarioUpdate {
  name?: string
  description?: string
  status?: Scenario["status"]
  playMode?: Scenario["playMode"]
  repeat?: Scenario["repeat"]
  stopPrevious?: boolean
}

export type ScenarioSaveStatus = "scheduled" | "saving" | "saved" | "error" | "unsaved"

export interface ScenarioValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

interface ScenarioData {
  rooms: Room[]
  audioFiles: AudioFile[]
}

export function useScenarios({
  rooms,
  audioFiles,
}: ScenarioData) {
  const queryClient = useQueryClient()
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const saveChains = useRef<Record<string, Promise<void>>>({})
  const latestScenarios = useRef<Scenario[]>([])
  const [saveStatuses, setSaveStatuses] = useState<Record<string, ScenarioSaveStatus>>({})

  const audioSettingsQuery = useQuery({
    queryKey: AUDIO_SETTINGS_QUERY_KEY,
    queryFn: audioSettingsApi.get,
    staleTime: 30_000,
    retry: 1,
  })

  const roomIdsWithoutOutputs = useMemo(() => {
    if (!audioSettingsQuery.data) return new Set<string>()
    const mappedRoomIds = new Set(
      audioSettingsQuery.data.mappings
        .filter((mapping) => Boolean(mapping.outputId))
        .map((mapping) => mapping.roomId),
    )
    return new Set(rooms.filter((room) => !mappedRoomIds.has(room.id)).map((room) => room.id))
  }, [audioSettingsQuery.data, rooms])

  const context = useMemo(() => ({ rooms, audioFiles }), [audioFiles, rooms])
  const contextKey = JSON.stringify({
    rooms: rooms.map(({ id, name }) => [id, name]),
    audioFiles: audioFiles.map(({ id, filename, duration }) => [
      id,
      filename,
      duration,
    ]),
  })
  const queryKey = useMemo(
    () => [...SCENARIOS_QUERY_KEY, contextKey] as const,
    [contextKey],
  )

  const {
    data: scenarios = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => scenariosApi.getAll(context),
  })

  useEffect(() => {
    latestScenarios.current = scenarios
  }, [scenarios])

  useEffect(() => {
    const timers = saveTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  const updateCache = useCallback(
    (updater: (current: Scenario[]) => Scenario[]) => {
      queryClient.setQueryData<Scenario[]>(queryKey, (current = []) => {
        const next = updater(current)
        latestScenarios.current = next
        return next
      })
    },
    [queryClient, queryKey],
  )

  const saveMutation = useMutation({
    mutationFn: (scenario: Scenario) => {
      if (!canPersistScenario(scenario, rooms, audioFiles)) {
        throw new Error("Сценарий содержит незаполненные или некорректные шаги")
      }
      return scenariosApi.update(scenario, context)
    },
    onSuccess: (updated, submitted) => {
      const latestBeforeUpdate = latestScenarios.current.find(
        (item) => item.id === submitted.id,
      )
      const submittedIsCurrent = latestBeforeUpdate === submitted

      updateCache((current) =>
        current.map((item) =>
          item.id === updated.id && item === submitted ? updated : item,
        ),
      )

      if (saveTimers.current[submitted.id]) {
        setSaveStatuses((current) => ({ ...current, [submitted.id]: "scheduled" }))
      } else if (submittedIsCurrent) {
        setSaveStatuses((current) => ({ ...current, [submitted.id]: "saved" }))
      } else if (latestBeforeUpdate) {
        setSaveStatuses((current) => ({ ...current, [submitted.id]: "unsaved" }))
      }
    },
    onError: (error, submitted) => {
      const latest = latestScenarios.current.find((item) => item.id === submitted.id)
      if (saveTimers.current[submitted.id]) {
        setSaveStatuses((current) => ({ ...current, [submitted.id]: "scheduled" }))
        return
      }

      if (latest !== submitted) {
        if (latest) {
          setSaveStatuses((current) => ({ ...current, [submitted.id]: "unsaved" }))
        }
        return
      }

      setSaveStatuses((current) => ({ ...current, [submitted.id]: "error" }))
      toast.error("Не удалось сохранить сценарий", {
        description: error instanceof Error ? error.message : String(error),
      })
    },
  })

  const scheduleSave = useCallback(
    (scenario: Scenario) => {
      const id = scenario.id
      if (!canPersistScenario(scenario, rooms, audioFiles)) {
        const existing = saveTimers.current[id]
        if (existing) clearTimeout(existing)
        delete saveTimers.current[id]
        setSaveStatuses((current) => ({ ...current, [id]: "unsaved" }))
        return
      }

      setSaveStatuses((current) => ({ ...current, [id]: "scheduled" }))
      const existing = saveTimers.current[id]
      if (existing) clearTimeout(existing)

      saveTimers.current[id] = setTimeout(() => {
        delete saveTimers.current[id]
        const previousSave = saveChains.current[id] ?? Promise.resolve()
        const nextSave = previousSave
          .catch(() => undefined)
          .then(async () => {
            const latest = latestScenarios.current.find(
              (item) => item.id === id,
            )
            if (!latest || !canPersistScenario(latest, rooms, audioFiles)) {
              setSaveStatuses((current) => ({ ...current, [id]: "unsaved" }))
              return
            }
            setSaveStatuses((current) => ({ ...current, [id]: "saving" }))
            await saveMutation.mutateAsync(latest)
          })

        saveChains.current[id] = nextSave
        void nextSave.finally(() => {
          if (saveChains.current[id] === nextSave) {
            delete saveChains.current[id]
          }
        }).catch(() => undefined)
      }, 450)
    },
    [audioFiles, rooms, saveMutation],
  )

  const updateLocalScenario = useCallback(
    (id: string, patch: ScenarioUpdate) => {
      updateCache((current) =>
        current.map((scenario) =>
          scenario.id === id ? { ...scenario, ...patch } : scenario,
        ),
      )

      const updated = latestScenarios.current.find((item) => item.id === id)
      if (updated) scheduleSave(updated)
    },
    [scheduleSave, updateCache],
  )

  const createMutation = useMutation({
    mutationFn: (scenario: Scenario) => scenariosApi.create(scenario, context),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
    },
    onSuccess: (created) => {
      updateCache((current) => [...current, created])
      setSaveStatuses((current) => ({ ...current, [created.id]: "saved" }))
    },
    onError: (error) => {
      toast.error("Не удалось создать сценарий", {
        description: error instanceof Error ? error.message : String(error),
      })
    },
  })

  const createScenario = useCallback(
    async (patch: ScenarioUpdate = {}): Promise<string> => {
      const draft: Scenario = {
        id: "",
        name: t("scenarios.notifications.newName"),
        description: "",
        steps: [],
        status: "inactive",
        playMode: "sequential",
        repeat: "once",
        stopPrevious: true,
        ...patch,
      }

      const created = await createMutation.mutateAsync(draft)
      return created.id
    },
    [createMutation],
  )

  const updateScenario = useCallback(
    (id: string, patch: ScenarioUpdate) => {
      updateLocalScenario(id, patch)
    },
    [updateLocalScenario],
  )

  const retrySaveScenario = useCallback(
    (id: string) => {
      const latest = latestScenarios.current.find((item) => item.id === id)
      if (!latest) return
      scheduleSave(latest)
    },
    [scheduleSave],
  )

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scenariosApi.delete(id),
    onSuccess: (_, id) => {
      const timer = saveTimers.current[id]
      if (timer) clearTimeout(timer)
      delete saveTimers.current[id]
      setSaveStatuses((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      updateCache((current) => current.filter((scenario) => scenario.id !== id))
    },
    onError: (error) => {
      toast.error("Не удалось удалить сценарий", {
        description: error instanceof Error ? error.message : String(error),
      })
    },
  })

  const deleteScenario = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id)
    },
    [deleteMutation],
  )

  const duplicateScenario = useCallback(
    async (id: string): Promise<string> => {
      const source = latestScenarios.current.find((item) => item.id === id)
      if (!source) throw new Error("Scenario not found")

      const copy: Scenario = {
        ...structuredClone(source),
        id: "",
        name: `${source.name} ${t("scenarios.notifications.copySuffix")}`,
        status: "inactive",
        steps: source.steps.map((step) => ({ ...step, id: "" })),
      }

      const created = await createMutation.mutateAsync(copy)
      return created.id
    },
    [createMutation],
  )

  const addStep = useCallback(
    (scenarioId: string, step?: Partial<ScenarioStep>) => {
      updateCache((current) =>
        current.map((scenario) => {
          if (scenario.id !== scenarioId) return scenario

          const newStep: ScenarioStep = {
            id: crypto.randomUUID(),
            roomId: step?.roomId ?? "",
            roomName: step?.roomName ?? "",
            audioFileId: step?.audioFileId ?? null,
            file: step?.file ?? "",
            delay: step?.delay ?? 0,
            duration: step?.duration ?? 0,
          }

          return { ...scenario, steps: [...scenario.steps, newStep] }
        }),
      )

      const updated = latestScenarios.current.find((item) => item.id === scenarioId)
      if (updated) scheduleSave(updated)
    },
    [scheduleSave, updateCache],
  )

  const updateStep = useCallback(
    (scenarioId: string, stepId: string, patch: Partial<ScenarioStep>) => {
      updateCache((current) =>
        current.map((scenario) =>
          scenario.id === scenarioId
            ? {
                ...scenario,
                steps: scenario.steps.map((step) =>
                  step.id === stepId ? { ...step, ...patch } : step,
                ),
              }
            : scenario,
        ),
      )

      const updated = latestScenarios.current.find((item) => item.id === scenarioId)
      if (updated) scheduleSave(updated)
    },
    [scheduleSave, updateCache],
  )

  const removeStep = useCallback(
    (scenarioId: string, stepId: string) => {
      updateCache((current) =>
        current.map((scenario) =>
          scenario.id === scenarioId
            ? { ...scenario, steps: scenario.steps.filter((step) => step.id !== stepId) }
            : scenario,
        ),
      )

      const updated = latestScenarios.current.find((item) => item.id === scenarioId)
      if (updated) scheduleSave(updated)
    },
    [scheduleSave, updateCache],
  )

  const moveStep = useCallback(
    (scenarioId: string, fromIndex: number, toIndex: number) => {
      updateCache((current) =>
        current.map((scenario) => {
          if (scenario.id !== scenarioId) return scenario
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= scenario.steps.length ||
            toIndex >= scenario.steps.length
          ) {
            return scenario
          }

          const steps = [...scenario.steps]
          const [moved] = steps.splice(fromIndex, 1)
          steps.splice(toIndex, 0, moved)
          return { ...scenario, steps }
        }),
      )

      const updated = latestScenarios.current.find((item) => item.id === scenarioId)
      if (updated) scheduleSave(updated)
    },
    [scheduleSave, updateCache],
  )

  const runScenario = useCallback(
    async (id: string, isTestRun: boolean) => {
      try {
        const pendingTimer = saveTimers.current[id]
        if (pendingTimer) {
          clearTimeout(pendingTimer)
          delete saveTimers.current[id]
        }

        await saveChains.current[id]?.catch(() => undefined)

        const latest = latestScenarios.current.find((item) => item.id === id)
        if (!latest) throw new Error("Сценарий не найден в текущем состоянии приложения")
        if (!canPersistScenario(latest, rooms, audioFiles)) {
          throw new Error("Сначала заполните все шаги сценария и исправьте ошибки конфигурации")
        }

        // Persist the exact version the operator is about to run. This prevents
        // a debounced autosave from leaving the backend with an older scenario.
        setSaveStatuses((current) => ({ ...current, [id]: "saving" }))
        try {
          await saveMutation.mutateAsync(latest)
        } catch {
          // The mutation already reports and records the save failure.
          return
        }

        const validation = await scenariosApi.validate(id)
        if (!validation.valid) {
          throw new Error(validation.errors.join("\n") || "Сценарий не прошёл проверку")
        }

        await playbackApi.startScenario(id)
        if (isTestRun) {
          toast.info("Тестовый запуск начат: звук будет воспроизводиться через выбранные аудиовыходы.")
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toast.error(
          isTestRun ? "Не удалось выполнить тестовый запуск" : "Не удалось запустить сценарий",
          { description: message },
        )
      }
    },
    [audioFiles, rooms, saveMutation],
  )

  const playScenario = useCallback(
    (id: string) => runScenario(id, false),
    [runScenario],
  )

  const testScenario = useCallback(
    (id: string) => runScenario(id, true),
    [runScenario],
  )

  const stopScenario = useCallback(
    async (scenarioId: string) => {
      try {
        const sessions = await playbackApi.getSessions()
        const matching = sessions.filter((session) =>
          session.state.scenarioId === scenarioId &&
          ["starting", "playing", "paused", "waiting"].includes(session.state.status),
        )
        await Promise.all(matching.map((session) => playbackApi.stopSession(session.sessionId)))
      } catch (error) {
        toast.error("Не удалось остановить сценарий", {
          description: error instanceof Error ? error.message : String(error),
        })
      }
    },
    [],
  )

  const validateScenario = useCallback(
    (scenario: Scenario): ScenarioValidation => {
      const errors: string[] = []
      const warnings: string[] = []

      if (!scenario.name.trim()) errors.push(t("scenarios.validation.nameRequired"))
      if (scenario.steps.length === 0) errors.push(t("scenarios.validation.stepRequired"))
      if (!audioSettingsQuery.data) {
        errors.push(t("scenarios.validation.outputMappingUnavailable"))
      }

      scenario.steps.forEach((step, index) => {
        const number = index + 1
        if (!step.roomId) errors.push(t("scenarios.validation.roomRequired", { number }))
        else if (!rooms.some((room) => room.id === step.roomId)) {
          errors.push(t("scenarios.validation.roomUnavailable", { number }))
        } else if (audioSettingsQuery.data && roomIdsWithoutOutputs.has(step.roomId)) {
          errors.push(t("scenarios.validation.roomOutputRequired", { number }))
        }
        if (!step.audioFileId) errors.push(t("scenarios.validation.audioRequired", { number }))
        else if (!audioFiles.some((file) => file.id === step.audioFileId)) {
          errors.push(t("scenarios.validation.audioUnavailable", { number }))
        }
        if (step.delay < 0) {
          errors.push(t("scenarios.validation.delayNonnegative", { number }))
        }
        if (step.duration <= 0) {
          warnings.push(t("scenarios.validation.durationRequired", { number }))
        }
      })

      return { valid: errors.length === 0, errors, warnings }
    },
    [rooms, audioFiles, audioSettingsQuery.data, roomIdsWithoutOutputs],
  )

  return {
    scenarios,
    isLoading,
    error,
    refetch,
    saveStatuses,
    retrySaveScenario,
    playScenario,
    testScenario,
    stopScenario,
    createScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
    addStep,
    updateStep,
    removeStep,
    moveStep,
    validateScenario,
    roomIdsWithoutOutputs,
    audioSettingsLoading: audioSettingsQuery.isLoading,
  }
}

function canPersistScenario(
  scenario: Scenario,
  rooms: Room[],
  audioFiles: AudioFile[],
): boolean {
  if (!scenario.name.trim()) return false
  if (scenario.status === "active" && scenario.steps.length === 0) return false

  return scenario.steps.every(
    (step) =>
      Boolean(step.roomId) &&
      rooms.some((room) => room.id === step.roomId) &&
      Boolean(step.audioFileId) &&
      audioFiles.some((file) => file.id === step.audioFileId) &&
      Number.isFinite(step.delay) &&
      step.delay >= 0,
  )
}
