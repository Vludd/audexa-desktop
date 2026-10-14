import { useCallback, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { scheduleApi } from "@/api/schedule"
import type {
  ScheduleFormData,
  ScheduleItem,
  Weekday,
} from "@/types"
import { t } from "@/i18n"
import { toast } from "@/lib/toast"

const SCHEDULE_QUERY_KEY = ["schedule"] as const

const DAY_ORDER: Weekday[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]

export function useSchedule() {
  const queryClient = useQueryClient()

  const {
    data: schedule = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: SCHEDULE_QUERY_KEY,
    queryFn: scheduleApi.getAll,
  })

  const withNextRun = useCallback((items: ScheduleItem[]) => {
    return items.map((item) => ({
      ...item,
      nextRun: item.enabled
        ? calculateNextRun(item.time, item.days, item.repeat)
        : "—",
    }))
  }, [])


  const saveMutation = useMutation({
    mutationFn: (variables: { id?: number; data: ScheduleFormData }) =>
      variables.id === undefined
        ? scheduleApi.create(variables.data)
        : scheduleApi.update(variables.id, variables.data),
    onSuccess: (saved, variables) => {
      const item = withNextRun([saved])[0]

      queryClient.setQueryData<ScheduleItem[]>(
        SCHEDULE_QUERY_KEY,
        (current = []) =>
          variables.id === undefined
            ? [...current, item]
            : current.map((entry) =>
                entry.id === variables.id ? item : entry,
              ),
      )

      toast.success(
        variables.id === undefined
          ? "Расписание создано"
          : "Расписание сохранено",
      )
    },
    onError: (error) => {
      toast.error("Не удалось сохранить расписание", {
        description: error instanceof Error ? error.message : String(error),
      })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      scheduleApi.toggle(id, enabled),
    onSuccess: (updated) => {
      const item = withNextRun([updated])[0]
      queryClient.setQueryData<ScheduleItem[]>(
        SCHEDULE_QUERY_KEY,
        (current = []) =>
          current.map((entry) => (entry.id === item.id ? item : entry)),
      )
    },
    onError: (error) => {
      toast.error("Не удалось изменить состояние расписания", {
        description: error instanceof Error ? error.message : String(error),
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scheduleApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<ScheduleItem[]>(
        SCHEDULE_QUERY_KEY,
        (current = []) => current.filter((entry) => entry.id !== id),
      )
      toast.success("Расписание удалено")
    },
    onError: (error) => {
      toast.error("Не удалось удалить расписание", {
        description: error instanceof Error ? error.message : String(error),
      })
    },
  })

  const addSchedule = useCallback(
    async (data: ScheduleFormData) => {
      await saveMutation.mutateAsync({ data })
    },
    [saveMutation],
  )

  const updateSchedule = useCallback(
    async (id: number, data: ScheduleFormData) => {
      await saveMutation.mutateAsync({ id, data })
    },
    [saveMutation],
  )

  const deleteSchedule = useCallback(
    async (id: number) => {
      await deleteMutation.mutateAsync(id)
    },
    [deleteMutation],
  )

  const toggleSchedule = useCallback(
    async (id: number) => {
      const current = schedule.find((item) => item.id === id)
      if (!current) return

      await toggleMutation.mutateAsync({
        id,
        enabled: !current.enabled,
      })
    },
    [schedule, toggleMutation],
  )

  const duplicateSchedule = useCallback(
    async (id: number) => {
      const source = schedule.find((item) => item.id === id)
      if (!source) return

      await addSchedule({
        time: getNextTime(source.time),
        scenarioId: source.scenarioId,
        scenarioName: source.scenarioName,
        days: [...source.days],
        repeat: source.repeat,
        enabled: source.enabled,
      })
    },
    [addSchedule, schedule],
  )

  const computedSchedule = useMemo(
    () => withNextRun(schedule),
    [schedule, withNextRun],
  )

  return {
    schedule: computedSchedule,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    duplicateSchedule,
    toggleSchedule,
    isLoading,
    error,
    refetch,
  }
}

function calculateNextRun(
  time: string,
  days: Weekday[],
  repeat: ScheduleItem["repeat"],
) {
  if (days.length === 0) {
    return "—"
  }

  if (repeat === "once") {
    return t("schedule.nextRun.todayAt", { time })
  }

  const now = new Date()
  const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`

  const sortedDays = [...days].sort(
    (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
  )

  for (const day of sortedDays) {
    const dayIndex = DAY_ORDER.indexOf(day)
    const localizedDay = t(`schedule.weekdays.${day}`)

    if (dayIndex > currentDay) {
      return t("schedule.nextRun.dayAt", { day: localizedDay, time })
    }

    if (dayIndex === currentDay && time > currentTime) {
      return t("schedule.nextRun.todayAt", { time })
    }
  }

  return t("schedule.nextRun.nextDayAt", {
    day: t(`schedule.weekdays.${sortedDays[0]}`),
    time,
  })
}

function getNextTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  const totalMinutes = hours * 60 + minutes + 5
  const nextHours = Math.floor(totalMinutes / 60) % 24
  const nextMinutes = totalMinutes % 60

  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(
    2,
    "0",
  )}`
}
