import { t } from "@/i18n"

import { Calendar } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import type {
  Scenario,
  ScheduleFormData,
  Weekday,
} from "@/types"

interface Props {
  open: boolean
  editing: boolean
  form: ScheduleFormData
  scenarios: Scenario[]
  onOpenChange: (open: boolean) => void
  onChange: (form: ScheduleFormData) => void
  onSave: () => void
}

const DAYS: Weekday[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]

export default function ScheduleDialog({
  open,
  editing,
  form,
  scenarios,
  onOpenChange,
  onChange,
  onSave,
}: Props) {
  const toggleDay = (day: Weekday) => {
    onChange({
      ...form,
      days: form.days.includes(day)
        ? form.days.filter(
            (item) => item !== day,
          )
        : [...form.days, day],
    })
  }

  const canSave =
    Boolean(form.time) &&
    Boolean(form.scenarioId) &&
    form.days.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="size-5 text-primary" />

            {editing
              ? t("schedule.dialog.editTitle")
              : t("schedule.dialog.addTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <FormRow label={t("schedule.dialog.time")}>
            <Input
              type="time"
              value={form.time}
              onChange={(event) =>
                onChange({
                  ...form,
                  time: event.target.value,
                })
              }
            />
          </FormRow>

          <FormRow label={t("schedule.dialog.scenario")}>
            <Select
              value={
                form.scenarioId
                  ? String(form.scenarioId)
                  : undefined
              }
              onValueChange={(value) => {
                if (!value) return
                onChange({
                  ...form,
                  scenarioId: value,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("schedule.dialog.chooseScenario")} />
              </SelectTrigger>

              <SelectContent>
                {scenarios.map((scenario) => (
                  <SelectItem
                    key={scenario.id}
                    value={String(scenario.id)}
                  >
                    {scenario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label={t("schedule.dialog.weekdays")}>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((dayKey) => {
                const active =
                  form.days.includes(dayKey)

                return (
                  <Button
                    key={dayKey}
                    type="button"
                    size="sm"
                    variant={
                      active
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      toggleDay(dayKey)
                    }
                    className="min-w-10"
                  >
                    {t(`schedule.weekdays.${dayKey}`)}
                  </Button>
                )
              })}
            </div>

            {form.days.length === 0 && (
              <p className="text-xs text-destructive">
                {t("schedule.dialog.chooseDay")}
              </p>
            )}
          </FormRow>

          <FormRow label={t("schedule.dialog.repeat")}>
            <Select
              value={form.repeat}
              onValueChange={(value) =>
                onChange({
                  ...form,
                  repeat:
                    value as ScheduleFormData["repeat"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="daily">
                  {t("schedule.repeat.daily")}
                </SelectItem>

                <SelectItem value="weekly">
                  {t("schedule.repeat.weekly")}
                </SelectItem>

                <SelectItem value="once">
                  {t("schedule.repeat.once")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormRow>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-3">
            <div>
              <div className="text-sm font-medium">
                {t("schedule.dialog.enabled")}
              </div>

              <div className="text-xs text-muted-foreground">
                {t("schedule.dialog.autoStart")}
              </div>
            </div>

            <Switch
              checked={form.enabled}
              onCheckedChange={(enabled) =>
                onChange({
                  ...form,
                  enabled,
                })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onOpenChange(false)
            }
          >
            {t("common.cancel")}
          </Button>

          <Button
            type="button"
            disabled={!canSave}
            onClick={onSave}
          >
            {editing
              ? t("schedule.dialog.saveChanges")
              : t("schedule.dialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FormRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}