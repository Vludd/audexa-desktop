import { useMemo, useState } from "react"

import Header from "@/components/Header"
import { formatDate, t } from "@/i18n"
import ScheduleDialog from "@/components/schedule/ScheduleDialog"
import ScheduleTable from "@/components/schedule/ScheduleTable"
import ScheduleToolbar from "@/components/schedule/ScheduleToolbar"
import UpcomingEvents from "@/components/schedule/UpcomingEvents"

import type {
  Scenario,
  ScheduleFormData,
  ScheduleItem,
} from "@/types"

interface Props {
  schedule: ScheduleItem[]
  scenarios: Scenario[]
  onAdd: (data: ScheduleFormData) => void
  onUpdate: (
    id: number,
    data: ScheduleFormData,
  ) => void
  onDelete: (id: number) => void
  onDuplicate: (id: number) => void
  onToggle: (id: number) => void
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
}

export default function Schedule({
  schedule,
  scenarios,
  onAdd,
  onUpdate,
  onDelete,
  onDuplicate,
  onToggle,
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

  const selectedItem = useMemo(
    () =>
      schedule.find(
        (item) => item.id === selectedId,
      ) ?? null,
    [schedule, selectedId],
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
        firstScenario?.id ?? 0,
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

  const handleSave = () => {
    if (
      !form.scenarioId ||
      !form.time ||
      form.days.length === 0
    ) {
      return
    }

    if (editingId !== null) {
      onUpdate(editingId, form)
    } else {
      onAdd(form)
    }

    setShowModal(false)
    setEditingId(null)
  }

  const handleDelete = () => {
    if (!selectedItem) {
      return
    }

    const confirmed =
      window.confirm(
        t("schedule.confirmDelete", {
          scenario: selectedItem.scenarioName,
          time: selectedItem.time,
        }),
      )

    if (!confirmed) {
      return
    }

    onDelete(selectedItem.id)
    setSelectedId(null)
  }

  const handleDuplicate = () => {
    if (!selectedItem) {
      return
    }

    onDuplicate(selectedItem.id)
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
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="min-w-0 flex-1 overflow-auto p-5">
          <ScheduleTable
            schedule={schedule}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggle={onToggle}
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
        onSave={handleSave}
      />
    </div>
  )
}