import { useMemo, useState } from "react"

import Header from "@/components/Header"
import { formatDate, t } from "@/i18n"
import ScheduleDialog from "@/components/schedule/ScheduleDialog"
import ScheduleTable from "@/components/schedule/ScheduleTable"
import ScheduleToolbar from "@/components/schedule/ScheduleToolbar"
import UpcomingEvents from "@/components/schedule/UpcomingEvents"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useConfirm } from "@/hooks/useConfirm"
import { playbackApi } from "@/api/playback"
import { scenariosApi } from "@/api/scenarios"
import { toast } from "@/lib/toast"

import type {
  Scenario,
  ScheduleFormData,
  ScheduleItem,
} from "@/types"

interface Props {
  schedule: ScheduleItem[]
  scenarios: Scenario[]
  onAdd: (data: ScheduleFormData) => void | Promise<void>
  onUpdate: (
    id: number,
    data: ScheduleFormData,
  ) => void | Promise<void>
  onDelete: (id: number) => void
  onDuplicate: (id: number) => void
  onToggle: (id: number) => void
  isLoading?: boolean
  isSaving?: boolean
  error?: unknown
  onRetry?: () => void
}

const INITIAL_FORM: ScheduleFormData = {
  time: "10:00",
  scenarioId: "",
  scenarioName: "",
  days: [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ],
  repeat: "daily",
  enabled: true,
  executionDate: null,
}

export default function Schedule({
  schedule,
  scenarios,
  onAdd,
  onUpdate,
  onDelete,
  onDuplicate,
  onToggle,
  isLoading = false,
  isSaving = false,
  error = null,
  onRetry,
}: Props) {
  const [selectedId, setSelectedId] =
    useState<number | null>(null)

  const [showModal, setShowModal] =
    useState(false)

  const [editingId, setEditingId] =
    useState<number | null>(null)

  const [form, setForm] =
    useState<ScheduleFormData>(
      INITIAL_FORM,
    )

  const confirmation = useConfirm()

  const selectedItem = useMemo(
    () =>
      schedule.find(
        (item) => item.id === selectedId,
      ) ?? null,
    [schedule, selectedId],
  )

  const sortedSchedule = useMemo(
    () =>
      [...schedule].sort(
        (a, b) => a.time.localeCompare(b.time) || a.id - b.id,
      ),
    [schedule],
  )

  const upcoming = useMemo(() => {
    return [...schedule]
      .filter((item) => item.enabled)
      .sort((a, b) =>
        a.time.localeCompare(b.time),
      )
      .slice(0, 5)
  }, [schedule])

  const openCreate = () => {
    const firstScenario = scenarios[0]

    setEditingId(null)

    setForm({
      ...INITIAL_FORM,
      scenarioId:
        firstScenario?.id ?? "",
      scenarioName:
        firstScenario?.name ?? "",
    })

    setShowModal(true)
  }

  const openEdit = () => {
    if (!selectedItem) {
      return
    }

    setEditingId(selectedItem.id)

    setForm({
      time: selectedItem.time,
      scenarioId: selectedItem.scenarioId,
      scenarioName: selectedItem.scenarioName,
      days: [...selectedItem.days],
      repeat: selectedItem.repeat,
      enabled: selectedItem.enabled,
      executionDate: selectedItem.executionDate,
    })

    setShowModal(true)
  }

  const handleFormChange = (
    nextForm: ScheduleFormData,
  ) => {
    const scenario = scenarios.find(
      (item) =>
        item.id === nextForm.scenarioId,
    )

    setForm({
      ...nextForm,
      scenarioName:
        scenario?.name ??
        nextForm.scenarioName,
    })
  }

  const handleSave = async () => {
    if (
      !form.scenarioId ||
      !form.time ||
      (form.repeat === "weekly" && form.days.length === 0) ||
      (form.repeat === "once" && !form.executionDate)
    ) {
      return
    }

    try {
      if (editingId !== null) {
        await onUpdate(editingId, form)
      } else {
        await onAdd(form)
      }

      setShowModal(false)
      setEditingId(null)
    } catch {
      // Mutation hooks already display the backend error. Keep the dialog
      // open so the operator can correct the schedule and retry.
    }
  }

  const handleDelete = () => {
    if (!selectedItem) {
      return
    }

    confirmation.confirm({
      title: t("schedule.confirmDelete.title"),
      description: t("schedule.confirmDelete.description", {
        scenario: selectedItem.scenarioName,
        time: selectedItem.time,
      }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      variant: "destructive",
      onConfirm: () => {
        onDelete(selectedItem.id)
        setSelectedId(null)
      },
    })
  }

  const handleDuplicate = () => {
    if (!selectedItem) return
    onDuplicate(selectedItem.id)
  }

  const handleRunNow = async () => {
    if (!selectedItem) return
    try {
      await playbackApi.startScenario(selectedItem.scenarioId)
      toast.success(`Сценарий «${selectedItem.scenarioName}» запущен`)
    } catch (error) {
      toast.error("Не удалось запустить сценарий", {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleValidate = async () => {
    if (!selectedItem) return
    const scenario = scenarios.find((item) => item.id === selectedItem.scenarioId)

    if (!scenario) {
      toast.error("Расписание некорректно", {
        description: "Сценарий, привязанный к расписанию, не найден.",
      })
      return
    }

    try {
      const result = await scenariosApi.validate(scenario.id)
      if (result.valid) {
        toast.success("Расписание готово к запуску", {
          description: `Сценарий «${scenario.name}» прошёл проверку.`,
        })
      } else {
        toast.error("Расписание не готово", {
          description: result.errors.join(" "),
        })
      }
    } catch (error) {
      toast.error("Не удалось проверить расписание", {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleDialogChange = (
    open: boolean,
  ) => {
    setShowModal(open)

    if (!open) {
      setEditingId(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title={t("pages.schedule.title")}
        subtitle={t("pages.schedule.subtitle")}
      />

      <ScheduleToolbar
        selectedDate={`${formatDate(new Date(), {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })} (${t("common.today")})`}
        hasSelection={selectedItem !== null}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onRunNow={() => void handleRunNow()}
        onValidate={() => void handleValidate()}
      />

      {error != null && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-destructive/5 px-5 py-3 text-sm">
          <span className="text-destructive">
            Не удалось загрузить расписание: {error instanceof Error ? error.message : String(error)}
          </span>
          {onRetry && (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Повторить
            </Button>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="min-w-0 flex-1 overflow-auto p-5">
          <ScheduleTable
            schedule={sortedSchedule}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggle={onToggle}
            isLoading={isLoading}
          />
        </main>

        <UpcomingEvents
          items={upcoming}
        />
      </div>

      <ScheduleDialog
        open={showModal}
        editing={editingId !== null}
        form={form}
        scenarios={scenarios}
        onOpenChange={handleDialogChange}
        onChange={handleFormChange}
        onSave={() => void handleSave()}
        isSaving={isSaving}
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