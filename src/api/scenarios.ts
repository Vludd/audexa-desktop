import type { AudioFile, Room, Scenario, ScenarioStep } from "@/types"
import { apiRequest } from "@/api/client"

interface BackendScenarioStep {
  id: string
  order: number
  roomId: string
  audioFileId: string
  delayMs: number
}

interface BackendScenario {
  id: string
  name: string
  description: string
  status: "active" | "inactive"
  playMode: "sequential"
  repeat: "once" | "loop"
  stopPrevious: boolean
  createdAt: string
  updatedAt: string
  steps: BackendScenarioStep[]
}

interface ScenarioPayload {
  name: string
  description: string
  status: Scenario["status"]
  playMode: Scenario["playMode"]
  repeat: Scenario["repeat"]
  stopPrevious: boolean
  steps: Array<{
    roomId: string
    audioFileId: string
      delayMs: number
  }>
}

export interface ScenarioApiContext {
  rooms: Room[]
  audioFiles: AudioFile[]
}

function mapScenario(
  scenario: BackendScenario,
  context: ScenarioApiContext,
): Scenario {
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    status: scenario.status,
    playMode: scenario.playMode,
    repeat: scenario.repeat,
    autoStart: false,
    stopPrevious: scenario.stopPrevious,
    syncTranslation: false,
    crossfade: false,
    notifications: true,
    steps: scenario.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((step): ScenarioStep => {
        const room = context.rooms.find((item) => item.id === step.roomId)
        const audio = context.audioFiles.find(
          (item) => item.id === step.audioFileId,
        )

        return {
          id: step.id,
          roomId: step.roomId,
          roomName: room?.name ?? "",
          audioFileId: step.audioFileId,
          file: audio?.filename ?? "",
                delay: step.delayMs / 1000,
          duration: audio?.duration ?? 0,
        }
      }),
  }
}

function toPayload(scenario: Scenario): ScenarioPayload {
  return {
    name: scenario.name,
    description: scenario.description,
    status: scenario.status,
    playMode: scenario.playMode,
    repeat: scenario.repeat,
    stopPrevious: scenario.stopPrevious,
    steps: scenario.steps.map((step) => ({
      roomId: step.roomId,
      audioFileId: step.audioFileId ?? "",
        delayMs: Math.round(step.delay * 1000),
    })),
  }
}

export const scenariosApi = {
  async getAll(context: ScenarioApiContext): Promise<Scenario[]> {
    const scenarios = await apiRequest<BackendScenario[]>("/api/scenarios")
    return scenarios.map((scenario) => mapScenario(scenario, context))
  },

  async create(
    scenario: Scenario,
    context: ScenarioApiContext,
  ): Promise<Scenario> {
    const created = await apiRequest<BackendScenario>("/api/scenarios", {
      method: "POST",
      body: JSON.stringify(toPayload(scenario)),
    })

    return mapScenario(created, context)
  },

  async update(
    scenario: Scenario,
    context: ScenarioApiContext,
  ): Promise<Scenario> {
    const updated = await apiRequest<BackendScenario>(
      `/api/scenarios/${scenario.id}`,
      {
        method: "PUT",
        body: JSON.stringify(toPayload(scenario)),
      },
    )

    return mapScenario(updated, context)
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/api/scenarios/${id}`, {
      method: "DELETE",
    })
  },

  async validate(id: string) {
    return apiRequest<{
      valid: boolean
      errors: string[]
      warnings: string[]
    }>(`/api/scenarios/${id}/validate`, {
      method: "POST",
    })
  },
}
