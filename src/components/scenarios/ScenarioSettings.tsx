import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Scenario } from "@/types"
import type { ScenarioUpdate } from "@/hooks/useScenarios"
import { t } from "@/i18n"

interface Props {
  open: boolean
  scenario: Scenario | null
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onSave: (patch: ScenarioUpdate) => void | Promise<void>
}

export default function ScenarioSettings({
  open,
  scenario,
  mode,
  onOpenChange,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<ScenarioUpdate>(() =>
    scenario
      ? {
          name: scenario.name,
          description: scenario.description,
          status: scenario.status,
          playMode: scenario.playMode,
          repeat: scenario.repeat,
          stopPrevious: scenario.stopPrevious,
        }
      : {},
  )
  const [saving, setSaving] = useState(false)

  if (!scenario) return null

  const value = {
    name: draft.name ?? scenario.name,
    description: draft.description ?? scenario.description,
    status: draft.status ?? scenario.status,
    playMode: draft.playMode ?? scenario.playMode,
    repeat: draft.repeat ?? scenario.repeat,
    stopPrevious: draft.stopPrevious ?? scenario.stopPrevious,
  }

  const update = (patch: ScenarioUpdate) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await onSave(draft)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? t("scenarios.settings.createTitle")
              : t("scenarios.settings.editTitle")}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? t("scenarios.settings.createDescription")
              : t("scenarios.settings.editDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <FieldRow label={t("scenarios.settings.name")}>
            <Input
              value={value.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder={t("scenarios.settings.namePlaceholder")}
            />
          </FieldRow>

          <FieldRow label={t("scenarios.settings.description")}>
            <Input
              value={value.description}
              onChange={(event) =>
                update({ description: event.target.value })
              }
              placeholder={t("scenarios.settings.descriptionPlaceholder")}
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label={t("scenarios.settings.playbackMode")}>
              <Select
                value={value.playMode}
                onValueChange={(next) =>
                  update({
                    playMode:
                      next === "parallel" ? "parallel" : "sequential",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">
                    {t("scenarios.settings.sequential")}
                  </SelectItem>
                  <SelectItem value="parallel">
                    {t("scenarios.settings.parallel")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label={t("scenarios.settings.repeat")}>
              <Select
                value={value.repeat}
                onValueChange={(next) =>
                  update({
                    repeat: next === "loop" ? "loop" : "once",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">
                    {t("scenarios.settings.once")}
                  </SelectItem>
                  <SelectItem value="loop">
                    {t("scenarios.settings.loop")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>

          <div className="rounded-lg border bg-muted/30 px-3.5 py-2.5">
            <CheckRow
              label={t("scenarios.settings.active")}
              checked={value.status === "active"}
              onCheckedChange={(checked) =>
                update({ status: checked ? "active" : "inactive" })
              }
              disabled={scenario.steps.length === 0 && value.status !== "active"}
            />
            <CheckRow
              label={t("scenarios.settings.stopPrevious")}
              checked={value.stopPrevious ?? true}
              onCheckedChange={(checked) =>
                update({ stopPrevious: checked })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!value.name.trim() || saving}
            onClick={() => void handleSave()}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

function CheckRow({
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}
