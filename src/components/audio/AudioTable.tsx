import { Loader2, Pause, Play } from "lucide-react"

import type { AudioFile } from "@/types"
import { t } from "@/i18n"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { formatTime, getProgress } from "@/lib/audio"

import AudioFileActions from "./AudioFileActions"

interface Props {
  files: AudioFile[]
  selected: string | null
  selectedIds: string[]
  currentFileId: string | null
  isPlaying: boolean
  isPlayPending: boolean
  currentTime: number
  duration: number

  onSelect: (id: string) => void
  onToggleSelection: (id: string) => void
  onToggleSelectAll: () => void
  onTogglePlay: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  onGainPreview: (id: string, gainDb: number) => void
  onGainCommit: (id: string, gainDb: number) => void
}

function fmtSize(bytes: number) {
  if (!bytes) {
    return "—"
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} ${t("units.megabyte")}`
}

export default function AudioTable({
  files,
  selected,
  selectedIds,
  currentFileId,
  isPlaying,
  isPlayPending,
  currentTime,
  duration,
  onSelect,
  onToggleSelection,
  onToggleSelectAll,
  onTogglePlay,
  onRename,
  onDelete,
  onGainPreview,
  onGainCommit,
}: Props) {
  const allSelected =
    files.length > 0 &&
    files.every((file) =>
      selectedIds.includes(file.id),
    )

  const someSelected =
    files.some((file) =>
      selectedIds.includes(file.id),
    ) && !allSelected

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 px-3">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={onToggleSelectAll}
                aria-label={t("audio.table.selectAll")}
              />
            </TableHead>

            <TableHead className="w-11" />

            <TableHead className="min-w-56">
              {t("audio.table.name")}
            </TableHead>

            <TableHead className="min-w-64">
              {t("audio.table.filename")}
            </TableHead>

            <TableHead>{t("audio.table.format")}</TableHead>
            <TableHead>{t("audio.table.sampleRate")}</TableHead>
            <TableHead>{t("audio.table.duration")}</TableHead>
            <TableHead>{t("audio.table.size")}</TableHead>
            <TableHead className="min-w-48">
              {t("audio.table.gain")}
            </TableHead>

            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {files.map((file) => {
            const isCurrent =
              currentFileId === file.id
            const showPlaybackProgress =
              isCurrent && (isPlaying || isPlayPending || currentTime > 0)
            const playbackDuration = duration || file.duration || 0

            const isChecked =
              selectedIds.includes(file.id)

            return (
              <TableRow
                key={file.id}
                data-state={
                  selected === file.id
                    ? "selected"
                    : undefined
                }
                className={[
                  "group cursor-pointer transition-colors",
                  isCurrent &&
                    "bg-primary/[0.045] hover:bg-primary/[0.07]",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onSelect(file.id)}
              >
                <TableCell
                  className="w-10 px-3"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() =>
                      onToggleSelection(file.id)
                    }
                    aria-label={t("audio.table.selectFile", {
                      name: file.name,
                    })}
                  />
                </TableCell>

                <TableCell
                  className="pr-0"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  <Button
                    variant={
                      isCurrent
                        ? "secondary"
                        : "ghost"
                    }
                    size="icon-sm"
                    className={[
                      "size-7 rounded-full",
                      isCurrent &&
                        "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={
                      isCurrent && isPlaying
                        ? t("audio.table.pause")
                        : t("audio.table.play")
                    }
                    disabled={
                      isCurrent && isPlayPending
                    }
                    onClick={() =>
                      onTogglePlay(file.id)
                    }
                  >
                    {isCurrent && isPlayPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isCurrent && isPlaying ? (
                      <Pause className="size-3.5" />
                    ) : (
                      <Play className="size-3.5 translate-x-px" />
                    )}
                  </Button>
                </TableCell>

                <TableCell className="max-w-80">
                  <div
                    className={[
                      "truncate font-medium",
                      isCurrent && "text-primary",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={file.name}
                  >
                    {file.name}
                  </div>

                  {isCurrent && (
                    <>
                      <div className="mt-0.5 text-[11px] font-medium text-primary">
                        {isPlaying
                          ? t("audio.table.playing")
                          : isPlayPending
                            ? t("audio.table.starting")
                            : t("audio.table.selected")}
                      </div>

                      {showPlaybackProgress && (
                        <div className="mt-1 flex items-center gap-2">
                          <div
                            role="progressbar"
                            aria-label={t("audio.player.position")}
                            aria-valuemin={0}
                            aria-valuemax={playbackDuration}
                            aria-valuenow={Math.min(currentTime, playbackDuration)}
                            className="h-1 min-w-12 flex-1 overflow-hidden rounded-full bg-muted"
                          >
                            <div
                              className="h-full rounded-full bg-primary transition-[width]"
                              style={{
                                width: `${getProgress(currentTime, playbackDuration)}%`,
                              }}
                            />
                          </div>
                          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                            {formatTime(currentTime)} / {formatTime(playbackDuration)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </TableCell>

                <TableCell className="max-w-80">
                  <div
                    className="truncate font-mono text-xs text-muted-foreground"
                    title={file.filename}
                  >
                    {file.filename}
                  </div>
                </TableCell>

                <TableCell>
                  <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {file.format}
                  </span>
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {file.sampleRate / 1000} {t("units.kilohertz")}
                </TableCell>

                <TableCell className="font-mono text-xs">
                  {Number.isFinite(file.duration) && file.duration >= 0
                    ? formatTime(file.duration)
                    : "—"}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {fmtSize(file.size)}
                </TableCell>

                <TableCell
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <div className="flex min-w-40 items-center gap-2">
                    <Slider
                      value={[file.volumeDb]}
                      min={-60}
                      max={12}
                      step={1}
                      onValueChange={(value) => {
                        const gainDb = Array.isArray(value)
                          ? value[0]
                          : value
                        if (typeof gainDb === "number") {
                          onGainPreview(file.id, gainDb)
                        }
                      }}
                      onValueCommitted={(value) => {
                        const gainDb = Array.isArray(value)
                          ? value[0]
                          : value
                        if (typeof gainDb === "number") {
                          onGainCommit(file.id, gainDb)
                        }
                      }}
                      aria-label={t("audio.table.gainFor", {
                        name: file.name,
                      })}
                      title={t("audio.player.gainHint")}
                    />
                    <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                      {file.volumeDb > 0 ? "+" : ""}
                      {file.volumeDb} dB
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  <AudioFileActions
                    onRename={() =>
                      onRename(file.id)
                    }
                    onDelete={() =>
                      onDelete(file.id)
                    }
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}