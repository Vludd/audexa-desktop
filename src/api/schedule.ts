import { apiRequest } from "@/api/client"
import type { ScheduleFormData, ScheduleItem } from "@/types"

interface BackendSchedule {
  id: number
  time: string
  scenarioId: string
  scenarioName: string
  days: ScheduleItem["days"]
  repeat: ScheduleItem["repeat"]
  enabled: boolean
  status: ScheduleItem["status"]
  createdAt: string
  updatedAt: string
}

interface SchedulePayload {
  time: string
  scenarioId: string
  days: ScheduleItem["days"]
  repeat: ScheduleItem["repeat"]
  enabled: boolean
}

function toItem(schedule: BackendSchedule): ScheduleItem {
  return {
    id: schedule.id,
    enabled: schedule.enabled,
    time: schedule.time,
    scenarioId: schedule.scenarioId,
    scenarioName: schedule.scenarioName,
    days: schedule.days,
    repeat: schedule.repeat,
    nextRun: "—",
    status: schedule.status,
  }
}

function toPayload(data: ScheduleFormData): SchedulePayload {
  return {
    time: data.time,
    scenarioId: data.scenarioId,
    days: data.days,
    repeat: data.repeat,
    enabled: data.enabled,
  }
}

export const scheduleApi = {
  async getAll(): Promise<ScheduleItem[]> {
    const schedules = await apiRequest<BackendSchedule[]>("/api/schedules")
    return schedules.map(toItem)
  },

  async create(data: ScheduleFormData): Promise<ScheduleItem> {
    const schedule = await apiRequest<BackendSchedule>("/api/schedules", {
      method: "POST",
      body: JSON.stringify(toPayload(data)),
    })

    return toItem(schedule)
  },

  async update(id: number, data: ScheduleFormData): Promise<ScheduleItem> {
    const schedule = await apiRequest<BackendSchedule>(`/api/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(toPayload(data)),
    })

    return toItem(schedule)
  },

  async toggle(id: number, enabled: boolean): Promise<ScheduleItem> {
    const schedule = await apiRequest<BackendSchedule>(
      `/api/schedules/${id}/enabled`,
      {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      },
    )

    return toItem(schedule)
  },

  async delete(id: number): Promise<void> {
    await apiRequest<void>(`/api/schedules/${id}`, {
      method: "DELETE",
    })
  },
}
