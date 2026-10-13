import {
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { AudioFile } from "@/types"
import { t } from "@/i18n"
import { formatTime } from "@/lib/audio"

interface Props {
  file: AudioFile | null
  isPlaying: boolean
  isPlayPending: boolean
  playbackError: string | null
  currentTime: number
  duration: number
  previewVolume: number
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (value: number) => void
  onPreviewVolumeChange: (value: number) => void
  onSkip: (seconds: number) => void
}

export default function AudioPlayer({
  file,
  isPlaying,
  isPlayPending,
  playbackError,
  currentTime,
  duration,
  previewVolume,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onPreviewVolumeChange,
  onSkip,
}: Props) {
  const actualDuration =
    duration || file?.duration || 0

  const progress = useMemo(() => {
    if (
      !actualDuration ||
      !Number.isFinite(actualDuration)
    ) {
      return 0
    }

    return Math.min(
      (currentTime / actualDuration) * 100,
      100,
    )
  }, [currentTime, actualDuration])

  if (!file) {
    return (
      <div className="border-t bg-card px-5 py-3">
        <div className="flex min-h-12 items-center justify-center text-xs text-muted-foreground">
          {t("audio.player.chooseFile")}
        </div>
      </div>
    )
  }

  return (
    <div className="border-t bg-card px-5 py-3">
      <div className="flex items-center gap-3">
        <Button
          variant="default"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          disabled={isPlayPending}
          onClick={isPlaying ? onPause : onPlay}
          title={
            isPlaying
              ? t("audio.table.pause")
              : t("audio.table.play")
          }
        >
          {isPlayPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4 translate-x-px" />
          )}
        </Button>

        <div className="min-w-44 max-w-72 shrink-0">
          <div
            className="truncate text-sm font-medium"
            title={file.name}
          >
            {file.name}
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{file.format}</span>
            <span>·</span>
            <span>
              {file.sampleRate / 1000} {t("units.kilohertz")}
            </span>
            <span>·</span>
            <span>
              {(file.size / 1024 / 1024).toFixed(1)} {t("units.megabyte")}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              {formatTime(currentTime)}
            </span>

            <Slider
              trackClassName="!h-1.5 bg-muted-foreground/20"
              value={[
                Math.min(
                  currentTime,
                  actualDuration,
                ),
              ]}
              max={actualDuration || 1}
              step={0.1}
              onValueChange={(value) => {
                const v = Array.isArray(value)
                  ? value[0]
                  : value

                onSeek(v ?? 0)
              }}
              aria-label={t("audio.player.position")}
            />

            <span className="w-10 shrink-0 font-mono text-[11px] text-muted-foreground">
              {formatTime(actualDuration)}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {playbackError
                ? playbackError
                : t("audio.player.progress", {
                    percent: Math.round(progress),
                  })}
            </span>
          </div>
        </div>

        <div className="hidden items-center gap-0.5 md:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            title={t("audio.player.back")}
            onClick={() => onSkip(-10)}
          >
            <RotateCcw className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            title={t("audio.player.forward")}
            onClick={() => onSkip(10)}
          >
            <RotateCw className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            title={t("audio.player.stop")}
            onClick={onStop}
          >
            <Square className="size-4" />
          </Button>
        </div>

        <div className="flex w-32 shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            title={
              previewVolume === 0
                ? t("audio.player.unmute")
                : t("audio.player.mute")
            }
            aria-label={
              previewVolume === 0
                ? t("audio.player.unmute")
                : t("audio.player.mute")
            }
            onClick={() =>
              onPreviewVolumeChange(previewVolume === 0 ? 1 : 0)
            }
          >
            {previewVolume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </Button>
          <Slider
            value={[previewVolume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value
              if (typeof next === "number") {
                onPreviewVolumeChange(next)
              }
            }}
            aria-label={t("audio.player.previewVolume")}
          />
        </div>
      </div>
    </div>
  )
}