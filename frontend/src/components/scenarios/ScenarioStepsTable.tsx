import { useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { useConfirm } from "@/hooks/useConfirm"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { AudioFile, Room, ScenarioStep } from "@/types"
import { t } from "@/i18n"
import { formatTime } from "@/lib/audio"
import { Slider } from "../ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface Props {
  steps: ScenarioStep[]
  rooms: Room[]
  audioFiles: AudioFile[]
  roomIdsWithoutOutputs: Set<string>
  onUpdateStep: (stepId: string, patch: Partial<ScenarioStep>) => void
  onRemoveStep: (stepId: string) => void
  onMoveStep: (fromIndex: number, toIndex: number) => void
}

export default function ScenarioStepsTable({
  steps,
  rooms,
  audioFiles,
  roomIdsWithoutOutputs,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
}: Props) {
  const confirmation = useConfirm()
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleRoomChange = (step: ScenarioStep, roomId: string) => {
    const room = rooms.find((item) => item.id === roomId)

    onUpdateStep(step.id, {
      roomId,
      roomName: room?.name ?? "",
    })
  }

  const handleAudioChange = (step: ScenarioStep, fileId: string) => {
    const file = audioFiles.find((item) => item.id === fileId)

    onUpdateStep(step.id, {
      audioFileId: file?.id ?? null,
      file: file?.filename ?? "",
      duration: file?.duration ?? 0,
    })
  }

  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-8 text-center">
        <p className="text-sm font-medium">{t("scenarios.steps.emptyTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("scenarios.steps.emptyDescription")}
        </p>
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

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10" />
              <TableHead className="w-10">{t("scenarios.steps.step")}</TableHead>
              <TableHead>{t("scenarios.steps.room")}</TableHead>
              <TableHead>{t("scenarios.steps.audioFile")}</TableHead>
              <TableHead>{t("scenarios.steps.translationAudio")}</TableHead>
              <TableHead className="w-[100px]">
                {t("scenarios.steps.delayBeforeStartSeconds")}
              </TableHead>
              <TableHead className="w-[100px]">
                {t("scenarios.steps.duration")}
              </TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {steps.map((step, index) => {
              const selectedAudioId =
                step.audioFileId ??
                audioFiles.find((file) => file.filename === step.file)?.id ??
                ""

              return (
                <TableRow
                  key={step.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (draggedIndex === null || draggedIndex === index) return
                    onMoveStep(draggedIndex, index)
                    setDraggedIndex(null)
                  }}
                  className={draggedIndex === index ? "bg-muted/40" : undefined}
                >
                  <TableCell>
                    <div
                      draggable
                      onDragStart={(event) => {
                        setDraggedIndex(index)
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData("text/plain", String(index))
                      }}
                      onDragEnd={() => setDraggedIndex(null)}
                      className="flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
                      title={t("scenarios.steps.dragHandle")}
                    >
                      <GripVertical className="size-4" />
                    </div>
                  </TableCell>

                  <TableCell className="font-semibold text-muted-foreground text-center">
                    {index + 1}
                  </TableCell>

                  <TableCell>
                    <div className="min-w-[150px] space-y-1">
                      <Select
                        value={step.roomId || undefined}
                        onValueChange={(roomId) => {
                          if (roomId == null) return
                          handleRoomChange(step, roomId)
                        }}
                      >
                        <SelectTrigger
                          className="h-8 w-full min-w-[150px] text-xs"
                          aria-label={t("scenarios.steps.room")}
                        >
                          <SelectValue placeholder={t("scenarios.steps.chooseRoom")}>
                            {rooms.find((room) => room.id === step.roomId)?.name ??
                              t("scenarios.steps.chooseRoom")}
                          </SelectValue>
                        </SelectTrigger>

                        <SelectContent>
                          {rooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {step.roomId && roomIdsWithoutOutputs.has(step.roomId) && (
                        <p
                          className="text-[10px] leading-tight text-destructive"
                          role="status"
                        >
                          {t("scenarios.validation.roomOutputHint")}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Select
                      value={selectedAudioId || undefined}
                      onValueChange={(fileId) => {
                        if (fileId == null) return
                        handleAudioChange(step, fileId)
                      }}
                    >
                      <SelectTrigger
                        className="h-8 w-full min-w-[180px] text-xs"
                        aria-label={t("scenarios.steps.audioFile")}
                      >
                        <SelectValue placeholder={t("scenarios.steps.chooseAudioFile")}>
                          {audioFiles.find((file) => file.id === selectedAudioId)
                            ? (() => {
                                const file = audioFiles.find(
                                  (item) => item.id === selectedAudioId,
                                )!
                                return `${file.name}`
                              })()
                            : t("scenarios.steps.chooseAudioFile")}
                        </SelectValue>
                      </SelectTrigger>

                      <SelectContent>
                        {audioFiles.map((file) => (
                          <SelectItem key={file.id} value={file.id}>
                            {file.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <div className="min-w-[170px] space-y-1">
                      <Select
                        value={step.translationAudioFileId ?? "__none__"}
                        onValueChange={(fileId) => {
                          const selected = fileId === "__none__"
                            ? undefined
                            : audioFiles.find((file) => file.id === fileId)
                          onUpdateStep(step.id, {
                            translationAudioFileId: selected?.id ?? null,
                            translationFile: selected?.filename ?? "",
                            translationDuration: selected?.duration ?? 0,
                          })
                        }}
                      >
                        <SelectTrigger
                          className="h-8 w-full min-w-[170px] text-xs"
                          aria-label={t("scenarios.steps.translationAudio")}
                        >
                          <SelectValue>
                            {step.translationAudioFileId
                              ? audioFiles.find((file) => file.id === step.translationAudioFileId)?.name ?? t("scenarios.steps.translationFileUnavailable")
                              : t("scenarios.steps.noTranslation")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("scenarios.steps.noTranslation")}</SelectItem>
                          {audioFiles.map((file) => (
                            <SelectItem key={file.id} value={file.id}>
                              {file.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {step.translationAudioFileId && step.duration > 0 && step.translationDuration > 0 && Math.abs(step.duration - step.translationDuration) >= 1 && (
                        <p className="flex items-center gap-1 text-[10px] leading-tight text-amber-600 dark:text-amber-400" role="status">
                          <span aria-hidden="true">⚠</span>
                          {t("scenarios.steps.durationMismatch", {
                            seconds: Math.round(Math.abs(step.duration - step.translationDuration)),
                          })}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex min-w-[140px] items-center gap-3">
                      <Slider
                        min={0}
                        max={30}
                        step={1}
                        value={[step.delay]}
                        onValueChange={(value) =>
                          onUpdateStep(step.id, {
                            delay: Array.isArray(value) ? value[0] : value,
                          })
                        }
                        aria-label={t("scenarios.steps.delayBeforeStartSeconds")}
                        className="flex-1"
                        trackClassName="bg-muted-foreground/25"
                      />

                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {step.delay.toFixed(1)} с
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {formatTime(step.duration)}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={index === 0}
                        onClick={() => onMoveStep(index, index - 1)}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={index === steps.length - 1}
                        onClick={() => onMoveStep(index, index + 1)}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() =>
                          confirmation.confirm({
                            title: t("scenarios.steps.deleteTitle"),
                            description: t("scenarios.steps.deleteDescription", {
                              number: index + 1,
                            }),
                            variant: "destructive",
                            onConfirm: () => onRemoveStep(step.id),
                          })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

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
    </>
  )
}
