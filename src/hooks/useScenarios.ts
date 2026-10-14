import { useCallback, useEffect, useMemo, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { scenariosApi } from "@/api/scenarios"
import { playbackApi } from "@/api/playback"
import type { AudioFile, Room, Scenario, ScenarioStep } from "@/types"
import { t } from "@/i18n"
import { toast } from "@/lib/toast"

const SCENARIOS_QUERY_KEY = ["scenarios"] as const

export interface ScenarioUpdate {
  name?: string
  description?: string
  status?: Scenario["status"]
  playMode?: Scenario["playMode"]
  repeat?: Scenario["repeat"]
  autoStart?: boolean
  stopPrevious?: boolean
  syncTranslation?: boolean
  crossfade?: boolean
  notifications?: boolean
}

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
      updateCache((current) =>
        current.map((item) =>
          item.id === updated.id && item === submitted ? updated : item,
        ),
      )
    },
    onError: (error) => {
      toast.error("Не удалось сохранить сценарий", {
        description: error instanceof Error ? error.message : String(error),
      })
      void refetch()
    },
  })

  const scheduleSave = useCallback(
    (scenario: Scenario) => {
      const id = scenario.id
      if (!canPersistScenario(scenario, rooms, audioFiles)) {
        const existing = saveTimers.current[id]
        if (existing) clearTimeout(existing)
        delete saveTimers.current[id]
        return
      }

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
            if (!latest || !canPersistScenario(latest, rooms, audioFiles)) return
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
        autoStart: false,
        stopPrevious: true,
        syncTranslation: false,
        crossfade: false,
        notifications: true,
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scenariosApi.delete(id),
    onSuccess: (_, id) => {
      const timer = saveTimers.current[id]
      if (timer) clearTimeout(timer)
      delete saveTimers.current[id]
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

  const playScenario = useCallback(
    async (id: string) => {
      try {
        await playbackApi.startScenario(id)
      } catch (error) {
        toast.error("Не удалось запустить сценарий", {
          description: error instanceof Error ? error.message : String(error),
        })
      }
    },
    [],
  )

  const testScenario = useCallback(
    async (id: string) => {
      try {
        await playbackApi.startScenario(id)
        toast.info("Тестовый запуск начат")
      } catch (error) {
        toast.error("Не удалось выполнить тестовый запуск", {
          description: error instanceof Error ? error.message : String(error),
        })
      }
    },
    [],
  )

  const stopScenario = useCallback(
    async () => {
      try {
        await playbackApi.stop()
      } catch (error) {
        toast.error("Не удалось остановить воспроизведение", {
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

      scenario.steps.forEach((step, index) => {
        const number = index + 1
        if (!step.roomId) errors.push(t("scenarios.validation.roomRequired", { number }))
        else if (!rooms.some((room) => room.id === step.roomId)) {
          errors.push(t("scenarios.validation.roomUnavailable", { number }))
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
    [rooms, audioFiles],
  )

  return {
    scenarios,
    isLoading,
    error,
    refetch,
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
