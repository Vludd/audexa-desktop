import { useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface Props {
  steps: ScenarioStep[]
  rooms: Room[]
  audioFiles: AudioFile[]
  onUpdateStep: (stepId: string, patch: Partial<ScenarioStep>) => void
  onRemoveStep: (stepId: string) => void
  onMoveStep: (fromIndex: number, toIndex: number) => void
}

export default function ScenarioStepsTable({
  steps,
  rooms,
  audioFiles,
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
              <TableHead className="w-10">#</TableHead>
              <TableHead>{t("scenarios.steps.room")}</TableHead>
              <TableHead>{t("scenarios.steps.audioFile")}</TableHead>
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

                  <TableCell className="font-semibold text-muted-foreground">
                    {index + 1}
                  </TableCell>

                  <TableCell>
                    <select
                      value={step.roomId}
                      onChange={(event) =>
                        handleRoomChange(step, event.target.value)
                      }
                      className="h-8 w-full min-w-[150px] rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">
                        {t("scenarios.steps.chooseRoom")}
                      </option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>

                  <TableCell>
                    <select
                      value={selectedAudioId}
                      onChange={(event) =>
                        handleAudioChange(step, event.target.value)
                      }
                      className="h-8 w-full min-w-[180px] rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">
                        {t("scenarios.steps.chooseAudioFile")}
                      </option>
                      {audioFiles.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.name} · {file.filename}
                        </option>
                      ))}
                    </select>
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={step.delay}
                      onChange={(event) =>
                        onUpdateStep(step.id, {
                          delay: Math.max(0, Number(event.target.value)),
                        })
                      }
                      className="h-8 text-xs"
                    />
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
