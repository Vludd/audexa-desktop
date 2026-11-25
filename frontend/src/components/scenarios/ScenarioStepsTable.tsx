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
import type { VideoFile } from "@/api/video"
import type { MediaHost } from "@/api/mediaHosts"
import { t } from "@/i18n"
import { formatTime } from "@/lib/audio"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface Props {
  steps: ScenarioStep[]
  rooms: Room[]
  audioFiles: AudioFile[]
  videoFiles: VideoFile[]
  mediaHosts: MediaHost[]
  roomIdsWithoutOutputs: Set<string>
  onUpdateStep: (stepId: string, patch: Partial<ScenarioStep>) => void
  onRemoveStep: (stepId: string) => void
  onMoveStep: (fromIndex: number, toIndex: number) => void
}

function StepDelayInput({
  delay,
  onCommit,
}: {
  delay: number
  onCommit: (delay: number) => void
}) {
  const [draft, setDraft] = useState({ delay, value: String(delay) })
  const value = draft.delay === delay ? draft.value : String(delay)

  const commit = () => {
    const nextDelay = Number(value)

    if (
      value.trim() === "" ||
      !Number.isFinite(nextDelay) ||
      nextDelay < 0
    ) {
      setDraft({ delay, value: String(delay) })
      return
    }

    if (nextDelay !== delay) {
      onCommit(nextDelay)
    }
  }

  return (
    <Input
      type="number"
      min={0}
      step={1}
      value={value}
      onChange={(event) =>
        setDraft({ delay, value: event.currentTarget.value })
      }
      onBlur={commit}
      aria-label={t("scenarios.steps.delayBeforeStartSeconds")}
      className="h-8 w-20 text-right text-xs tabular-nums"
    />
  )
}

export default function ScenarioStepsTable({
  steps,
  rooms,
  audioFiles,
  videoFiles,
  mediaHosts,
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
      videoFileId: null,
      videoName: "",
      mediaHostId: null,
      mediaHostName: "",
      displayKey: null,
      videoAudioMode: null,
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
              <TableHead>{t("scenarios.steps.videoFile")}</TableHead>
              <TableHead>{t("scenarios.steps.mediaHost")} / {t("scenarios.steps.display")}</TableHead>
              <TableHead>{t("scenarios.steps.videoAudioMode")}</TableHead>
              <TableHead>{t("scenarios.steps.translationAudio")}</TableHead>
              <TableHead className="w-[120px]">
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
                        disabled={Boolean(step.videoFileId) && step.videoAudioMode !== "RoomOutput"}
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

                      {step.videoFileId && step.videoAudioMode !== "RoomOutput" ? (
                        <p className="text-[10px] leading-tight text-muted-foreground">{t("scenarios.steps.roomNotRequired")}</p>
                      ) : null}
                      {step.roomId &&
                        (!step.videoFileId || step.videoAudioMode === "RoomOutput") &&
                        roomIdsWithoutOutputs.has(step.roomId) && (
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
                    <Select
                      value={step.videoFileId ?? "__none__"}
                      onValueChange={(videoId) => {
                        if (videoId == null) return
                        if (videoId === "__none__") {
                          if (!step.videoFileId) return
                          onUpdateStep(step.id, {
                            videoFileId: null,
                            videoName: "",
                            duration: 0,
                            mediaHostId: null,
                            mediaHostName: "",
                            displayKey: null,
                            videoAudioMode: null,
                          })
                          return
                        }
                        const video = videoFiles.find((item) => item.id === videoId)
                        onUpdateStep(step.id, {
                          videoFileId: video?.id ?? null,
                          videoName: video?.name ?? "",
                          duration: video?.durationMs ? video.durationMs / 1000 : 0,
                          audioFileId: null,
                          file: "",
                          translationAudioFileId: null,
                          translationFile: "",
                          translationDuration: 0,
                          videoAudioMode: video ? (step.videoAudioMode ?? "Muted") : null,
                        })
                      }}
                    >
                      <SelectTrigger className="h-8 w-full min-w-[180px] text-xs" aria-label={t("scenarios.steps.videoFile")}>
                        <SelectValue>
                          {videoFiles.find((file) => file.id === step.videoFileId)?.name ?? t("scenarios.steps.chooseVideoFile")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("scenarios.steps.noVideo")}</SelectItem>
                        {videoFiles.map((file) => (
                          <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <div className="min-w-[190px] space-y-1">
                      <Select
                        value={step.mediaHostId ?? "__none__"}
                        disabled={!step.videoFileId}
                        onValueChange={(hostId) => {
                          if (hostId == null) return
                          const host = mediaHosts.find((item) => item.id === hostId)
                          onUpdateStep(step.id, {
                            mediaHostId: host?.id ?? null,
                            mediaHostName: host?.name ?? "",
                            displayKey: null,
                          })
                        }}
                      >
                        <SelectTrigger className="h-8 w-full text-xs" aria-label={t("scenarios.steps.mediaHost")}>
                          <SelectValue>{mediaHosts.find((host) => host.id === step.mediaHostId)?.name ?? t("scenarios.steps.chooseMediaHost")}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("scenarios.steps.chooseMediaHost")}</SelectItem>
                          {mediaHosts.map((host) => (
                            <SelectItem key={host.id} value={host.id}>
                              {host.name} · {host.status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={step.displayKey ?? "__none__"}
                        disabled={!step.videoFileId || !step.mediaHostId}
                        onValueChange={(displayKey) => {
                          if (displayKey == null) return
                          onUpdateStep(step.id, { displayKey: displayKey === "__none__" ? null : displayKey })
                        }}
                      >
                        <SelectTrigger className="h-8 w-full text-xs" aria-label={t("scenarios.steps.display")}>
                          <SelectValue>
                            {mediaHosts.find((host) => host.id === step.mediaHostId)?.displays.find((display) => display.displayKey === step.displayKey)?.friendlyName ?? t("scenarios.steps.chooseDisplay")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("scenarios.steps.chooseDisplay")}</SelectItem>
                          {mediaHosts.find((host) => host.id === step.mediaHostId)?.displays.map((display) => (
                            <SelectItem key={display.id} value={display.displayKey}>
                              {display.friendlyName || display.deviceName} · {display.width}×{display.height}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Select
                      value={step.videoAudioMode ?? "Muted"}
                      disabled={!step.videoFileId}
                      onValueChange={(mode) => {
                        if (mode == null) return
                        onUpdateStep(step.id, { videoAudioMode: mode as ScenarioStep["videoAudioMode"] })
                      }}
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs" aria-label={t("scenarios.steps.videoAudioMode")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Muted">{t("scenarios.steps.videoAudioMuted")}</SelectItem>
                        <SelectItem value="HostOutput">{t("scenarios.steps.videoAudioHostOutput")}</SelectItem>
                        <SelectItem value="RoomOutput">{t("scenarios.steps.videoAudioRoomOutput")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <div className="min-w-[170px] space-y-1">
                      <Select
                        value={step.translationAudioFileId ?? "__none__"}
                        disabled={Boolean(step.videoFileId)}
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
                    <div className="flex min-w-[100px] items-center gap-2">
                      <StepDelayInput
                        delay={step.delay}
                        onCommit={(delay) =>
                          onUpdateStep(step.id, { delay })
                        }
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">с</span>
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
