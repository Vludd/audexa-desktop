import { useState } from "react"
import { Plus, Save } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

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

import { audioApi } from "@/api/audio"
import type { Room } from "@/types"
import { t } from "@/i18n"

export interface RoomFormData {
  name: string
  audioFileId: string | null
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

  const [name, setName] = useState(
    room?.name ?? "",
  )

  const [audioFileId, setAudioFileId] =
    useState(
      room?.audioFileId ?? "",
    )

  const [volume, setVolume] =
    useState(
      String(room?.volume ?? 100),
    )

  const [nameError, setNameError] =
    useState("")

  const [submitError, setSubmitError] =
    useState("")

  const [isSaving, setIsSaving] =
    useState(false)

  const {
    data: audioFiles = [],
    isLoading: isAudioLoading,
    isError: isAudioError,
  } = useQuery({
    queryKey: ["audio-files"],
    queryFn: audioApi.getAll,
    enabled: open,
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving) {
      return
    }

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
        audioFileId: audioFileId || null,
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
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? t("rooms.dialog.editTitle")
                : t("rooms.dialog.createTitle")}
            </DialogTitle>

            <DialogDescription>
              {isEditing
                ? t("rooms.dialog.editDescription", {
                    id: String(room?.id),
                  })
                : t("rooms.dialog.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <label
                htmlFor="room-name"
                className="text-sm font-medium"
              >
                {t("rooms.dialog.name")}
              </label>

              <Input
                id="room-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)

                  if (nameError) {
                    setNameError("")
                  }

                  if (submitError) {
                    setSubmitError("")
                  }
                }}
                placeholder={t(
                  "rooms.dialog.namePlaceholder",
                )}
                autoFocus
                disabled={isSaving}
                aria-invalid={Boolean(nameError)}
              />

              {nameError && (
                <p className="text-xs text-destructive">
                  {nameError}
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <label
                htmlFor="room-audio-file"
                className="text-sm font-medium"
              >
                {t("rooms.dialog.audioFile")}
              </label>

              <select
                id="room-audio-file"
                value={audioFileId}
                onChange={(event) =>
                  setAudioFileId(event.target.value)
                }
                disabled={
                  isSaving || isAudioLoading
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {isAudioLoading
                    ? "Загрузка аудиофайлов..."
                    : "Без аудиофайла"}
                </option>

                {audioFiles.map((file) => (
                  <option
                    key={file.id}
                    value={file.id}
                  >
                    {file.name}
                    {file.filename
                      ? ` · ${file.filename}`
                      : ""}
                  </option>
                ))}
              </select>

              {isAudioError ? (
                <p className="text-xs text-destructive">
                  Не удалось загрузить аудиофайлы.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Выберите аудиофайл из Audio Library.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <label
                htmlFor="room-volume"
                className="text-sm font-medium"
              >
                {t("rooms.dialog.volume")}
              </label>

              <div className="flex items-center gap-3">
                <Input
                  id="room-volume"
                  type="number"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(event) =>
                    setVolume(event.target.value)
                  }
                  className="w-24"
                  disabled={isSaving}
                />

                <span className="text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            {submitError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {submitError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                handleOpenChange(false)
              }
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Сохранение...
                </>
              ) : (
                <>
                  {isEditing ? (
                    <Save className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}

                  {isEditing
                    ? t("common.save")
                    : t("common.add")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}