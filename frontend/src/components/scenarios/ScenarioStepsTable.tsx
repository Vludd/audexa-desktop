import { useState, type ReactNode } from "react"
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
  Clock3,
  Film,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { useConfirm } from "@/hooks/useConfirm"
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

function Field({
  label,
  children,
  className = "",
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block min-w-0 space-y-1.5 ${className}`}>
      <span className="block text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
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
    if (value.trim() === "" || !Number.isFinite(nextDelay) || nextDelay < 0) {
      setDraft({ delay, value: String(delay) })
      return
    }
    if (nextDelay !== delay) onCommit(nextDelay)
  }

  return (
    <Input
      type="number"
      min={0}
      step={1}
      value={value}
      onChange={(event) => setDraft({ delay, value: event.currentTarget.value })}
      onBlur={commit}
      aria-label={t("scenarios.steps.delayBeforeStartSeconds")}
      className="h-9 w-full pr-7 text-xs tabular-nums"
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
    onUpdateStep(step.id, { roomId, roomName: room?.name ?? "" })
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
      </div>
    )
  }

  return (
    <>
      <div className="min-w-0 space-y-3">
        {steps.map((step, index) => {
          const selectedAudioId =
            step.audioFileId ??
            audioFiles.find((file) => file.filename === step.file)?.id ??
            ""
          const selectedHost = mediaHosts.find((host) => host.id === step.mediaHostId)
          const selectedDisplay = selectedHost?.displays.find(
            (display) => display.displayKey === step.displayKey,
          )
          const isVideoStep = Boolean(step.videoFileId)
          const hasRoomOutputIssue =
            Boolean(step.roomId) &&
            (!isVideoStep || step.videoAudioMode === "RoomOutput") &&
            roomIdsWithoutOutputs.has(step.roomId)

          return (
            <article
              key={step.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                if (draggedIndex === null || draggedIndex === index) return
                onMoveStep(draggedIndex, index)
                setDraggedIndex(null)
              }}
              className={[
                "min-w-0 overflow-hidden rounded-lg border bg-card transition-colors",
                draggedIndex === index ? "border-primary bg-muted/40" : "border-border",
              ].join(" ")}
            >
              <header className="flex min-w-0 items-center gap-2 border-b bg-muted/30 px-3 py-2">
                <div
                  draggable
                  onDragStart={(event) => {
                    setDraggedIndex(index)
                    event.dataTransfer.effectAllowed = "move"
                    event.dataTransfer.setData("text/plain", String(index))
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                  className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                  title={t("scenarios.steps.dragHandle")}
                  aria-label={t("scenarios.steps.dragHandle")}
                >
                  <GripVertical className="size-4" />
                </div>

                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">
                    {rooms.find((room) => room.id === step.roomId)?.name ||
                      (isVideoStep ? step.videoName : step.file) ||
                      `${t("scenarios.steps.step")} ${index + 1}`}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatTime(step.duration)}
                    {step.delay > 0 ? ` · +${step.delay} ${t("scenarios.steps.delayBeforeStartSeconds")}` : ""}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
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
                        description: t("scenarios.steps.deleteDescription", { number: index + 1 }),
                        variant: "destructive",
                        onConfirm: () => onRemoveStep(step.id),
                      })
                    }
                    aria-label={t("scenarios.steps.deleteTitle")}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </header>

              <div className="min-w-0 space-y-3 p-3">
                <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label={t("scenarios.steps.room")}>
                    <Select
                      value={step.roomId || undefined}
                      disabled={isVideoStep && step.videoAudioMode !== "RoomOutput"}
                      onValueChange={(roomId) => {
                        if (roomId != null) handleRoomChange(step, roomId)
                      }}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 text-xs" aria-label={t("scenarios.steps.room")}>
                        <SelectValue placeholder={t("scenarios.steps.chooseRoom")}>
                          {rooms.find((room) => room.id === step.roomId)?.name ?? t("scenarios.steps.chooseRoom")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isVideoStep && step.videoAudioMode !== "RoomOutput" ? (
                      <span className="block text-[10px] text-muted-foreground">{t("scenarios.steps.roomNotRequired")}</span>
                    ) : null}
                    {hasRoomOutputIssue && (
                      <span className="block text-[10px] text-destructive" role="status">
                        {t("scenarios.validation.roomOutputHint")}
                      </span>
                    )}
                  </Field>

                  <Field label={t("scenarios.steps.audioFile")}>
                    <Select
                      value={selectedAudioId || undefined}
                      onValueChange={(fileId) => {
                        if (fileId != null) handleAudioChange(step, fileId)
                      }}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 text-xs" aria-label={t("scenarios.steps.audioFile")}>
                        <SelectValue placeholder={t("scenarios.steps.chooseAudioFile")}>
                          {audioFiles.find((file) => file.id === selectedAudioId)?.name ?? t("scenarios.steps.chooseAudioFile")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {audioFiles.map((file) => (
                          <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="border-t pt-3">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                    <Film className="size-3.5" />
                    {t("scenarios.steps.videoFile")}
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label={t("scenarios.steps.videoFile")}>
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
                        <SelectTrigger className="h-9 w-full min-w-0 text-xs" aria-label={t("scenarios.steps.videoFile")}>
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
                    </Field>

                    <Field label={t("scenarios.steps.videoAudioMode")}>
                      <Select
                        value={step.videoAudioMode ?? "Muted"}
                        disabled={!isVideoStep}
                        onValueChange={(mode) => {
                          if (mode != null) onUpdateStep(step.id, { videoAudioMode: mode as ScenarioStep["videoAudioMode"] })
                        }}
                      >
                        <SelectTrigger className="h-9 w-full min-w-0 text-xs" aria-label={t("scenarios.steps.videoAudioMode")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Muted">{t("scenarios.steps.videoAudioMuted")}</SelectItem>
                          <SelectItem value="HostOutput">{t("scenarios.steps.videoAudioHostOutput")}</SelectItem>
                          <SelectItem value="RoomOutput">{t("scenarios.steps.videoAudioRoomOutput")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label={t("scenarios.steps.mediaHost")}>
                      <Select
                        value={step.mediaHostId ?? "__none__"}
                        disabled={!isVideoStep}
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
                        <SelectTrigger className="h-9 w-full min-w-0 text-xs" aria-label={t("scenarios.steps.mediaHost")}>
                          <SelectValue>{selectedHost?.name ?? t("scenarios.steps.chooseMediaHost")}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("scenarios.steps.chooseMediaHost")}</SelectItem>
                          {mediaHosts.map((host) => (
                            <SelectItem key={host.id} value={host.id}>{host.name} · {host.status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label={t("scenarios.steps.display")}>
                      <Select
                        value={step.displayKey ?? "__none__"}
                        disabled={!isVideoStep || !step.mediaHostId}
                        onValueChange={(displayKey) => {
                          if (displayKey != null) onUpdateStep(step.id, { displayKey: displayKey === "__none__" ? null : displayKey })
                        }}
                      >
                        <SelectTrigger className="h-9 w-full min-w-0 text-xs" aria-label={t("scenarios.steps.display")}>
                          <SelectValue>{selectedDisplay?.friendlyName ?? t("scenarios.steps.chooseDisplay")}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("scenarios.steps.chooseDisplay")}</SelectItem>
                          {selectedHost?.displays.map((display) => (
                            <SelectItem key={display.id} value={display.displayKey}>
                              {display.friendlyName || display.deviceName} · {display.width}×{display.height}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3">
                  <Field label={t("scenarios.steps.translationAudio")} className="sm:col-span-1">
                    <Select
                      value={step.translationAudioFileId ?? "__none__"}
                      disabled={isVideoStep}
                      onValueChange={(fileId) => {
                        if (fileId == null) return
                        const selected = fileId === "__none__" ? undefined : audioFiles.find((file) => file.id === fileId)
                        onUpdateStep(step.id, {
                          translationAudioFileId: selected?.id ?? null,
                          translationFile: selected?.filename ?? "",
                          translationDuration: selected?.duration ?? 0,
                        })
                      }}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 text-xs" aria-label={t("scenarios.steps.translationAudio")}>
                        <SelectValue>
                          {step.translationAudioFileId
                            ? audioFiles.find((file) => file.id === step.translationAudioFileId)?.name ?? t("scenarios.steps.translationFileUnavailable")
                            : t("scenarios.steps.noTranslation")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("scenarios.steps.noTranslation")}</SelectItem>
                        {audioFiles.map((file) => (
                          <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {step.translationAudioFileId && step.duration > 0 && step.translationDuration > 0 &&
                      Math.abs(step.duration - step.translationDuration) >= 1 && (
                        <span className="block text-[10px] text-amber-600 dark:text-amber-400" role="status">
                          ⚠ {t("scenarios.steps.durationMismatch", {
                            seconds: Math.round(Math.abs(step.duration - step.translationDuration)),
                          })}
                        </span>
                      )}
                  </Field>

                  <Field label={t("scenarios.steps.delayBeforeStartSeconds")}>
                    <div className="relative">
                      <StepDelayInput delay={step.delay} onCommit={(delay) => onUpdateStep(step.id, { delay })} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">с</span>
                    </div>
                  </Field>

                  <div className="min-w-0">
                    <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">{t("scenarios.steps.duration")}</div>
                    <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3 text-xs tabular-nums">
                      <Clock3 className="size-3.5 text-muted-foreground" />
                      <span className="font-semibold">{formatTime(step.duration)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
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
