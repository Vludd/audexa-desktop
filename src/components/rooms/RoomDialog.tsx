import { useState } from "react"

import { Plus, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { Room } from "@/types"
import { t } from "@/i18n"

export interface RoomFormData {
  name: string
  volume: number
}

interface Props {
  open: boolean
  room?: Room | null
  onOpenChange: (open: boolean) => void
  onSave: (data: RoomFormData) => void | Promise<void>
}

export default function RoomDialog({
  open,
  room,
  onOpenChange,
  onSave,
}: Props) {
  const isEditing = Boolean(room)
  const [name, setName] = useState(() => room?.name ?? "")
  const [volume, setVolume] = useState(() =>
    String(room?.volume ?? 100),
  )
  const [nameError, setNameError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving) return
    if (!nextOpen) {
      setNameError("")
      setSubmitError("")
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    const normalizedName = name.trim()

    if (!normalizedName) {
      setNameError(t("rooms.dialog.nameRequired"))
      return
    }

    setNameError("")
    setSubmitError("")

    const parsedVolume = Number(volume)
    const normalizedVolume = Number.isFinite(parsedVolume)
      ? Math.min(100, Math.max(0, parsedVolume))
      : 100

    try {
      setIsSaving(true)
      await onSave({
        name: normalizedName,
        volume: normalizedVolume,
      })
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить комнату.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("rooms.dialog.editTitle")
              : t("rooms.dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t("rooms.dialog.editDescription")
              : t("rooms.dialog.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <label htmlFor="room-name" className="text-sm font-medium">
              {t("rooms.dialog.name")}
            </label>
            <Input
              id="room-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("rooms.dialog.namePlaceholder")}
              autoFocus
              disabled={isSaving}
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="room-volume" className="text-sm font-medium">
              {t("rooms.dialog.volume")}
            </label>
            <div className="flex items-center gap-3">
              <Input
                id="room-volume"
                type="number"
                min={0}
                max={100}
                value={volume}
                onChange={(event) => setVolume(event.target.value)}
                className="w-24"
                disabled={isSaving}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Базовая громкость выхода этой комнаты.
            </p>
          </div>

          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isEditing ? (
                <Save className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {isEditing ? t("common.save") : t("rooms.toolbar.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
