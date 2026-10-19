import { Calendar, CheckCircle2, Copy, Edit2, Play, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { t } from "@/i18n"

interface Props {
  selectedDate: string
  hasSelection: boolean
  onAdd: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onRunNow: () => void
  onValidate: () => void
  busy?: boolean
}

export default function ScheduleToolbar({
  selectedDate,
  hasSelection,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate,
  onRunNow,
  onValidate,
  busy = false,
}: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
      <Button type="button" size="sm" disabled={busy} onClick={onAdd}>
        <Plus className="size-3.5" />
        {t("schedule.toolbar.add")}
      </Button>

      <Button type="button" size="sm" variant="outline" disabled={!hasSelection || busy} onClick={onEdit}>
        <Edit2 className="size-3.5" />
        {t("common.edit")}
      </Button>

      <Button type="button" size="sm" variant="outline" disabled={!hasSelection || busy} className="text-destructive hover:text-destructive" onClick={onDelete}>
        <Trash2 className="size-3.5" />
        {t("common.delete")}
      </Button>

      <Button type="button" size="sm" variant="outline" disabled={!hasSelection || busy} onClick={onDuplicate}>
        <Copy className="size-3.5" />
        {t("common.duplicate")}
      </Button>

      <div className="h-6 w-px bg-border" />

      <Button type="button" size="sm" variant="success" disabled={!hasSelection || busy} onClick={onRunNow}>
        <Play className="size-3.5" />
        {t("schedule.toolbar.runNow")}
      </Button>

      <Button type="button" size="sm" variant="outline" hidden disabled={!hasSelection || busy} onClick={onValidate}>
        <CheckCircle2 className="size-3.5" />
        Проверить
      </Button>

      <div className="ml-auto flex-1" />

      <Button type="button" variant="outline" size="sm" hidden className="font-normal">
        <Calendar className="size-3.5 text-primary" />
        {selectedDate}
      </Button>
    </div>
  )
}
