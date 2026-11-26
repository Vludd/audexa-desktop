import { useState } from "react"
import { AlertCircle, Film } from "lucide-react"

import type { VideoFile } from "@/api/video"
import { videoApi } from "@/api/video"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { t } from "@/i18n"

interface Props {
  video: VideoFile | null
  onOpenChange: (open: boolean) => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null || !Number.isFinite(durationMs)) return "—"

  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`
}

export default function VideoPreviewDialog({ video, onOpenChange }: Props) {
  const [playbackError, setPlaybackError] = useState(false)

  return (
    <Dialog
      open={video !== null}
      onOpenChange={(open) => {
        if (!open) setPlaybackError(false)
        onOpenChange(open)
      }}
    >
      <DialogContent
        className="w-[48vw] max-w-[1640px]! max-h-[96vh] gap-0 overflow-hidden p-0"
        showCloseButton
      >
        {video && (
          <>
            <DialogHeader className="min-w-0 shrink-0 border-b px-5 py-4 pr-16 text-left">
              <DialogTitle className="line-clamp-2 break-words text-base font-semibold leading-snug">
                {video.name}
              </DialogTitle>
              <DialogDescription className="truncate text-xs">
                {video.fileName}
              </DialogDescription>
            </DialogHeader>

            <div className="relative w-full min-h-0 bg-black">
              <div className="aspect-video max-h-[calc(96vh-150px)] w-full">
                <video
                  key={video.id}
                  className="block h-full max-h-[calc(96vh-150px)] w-full bg-black object-contain"
                  src={videoApi.getStreamUrl(video.id)}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setPlaybackError(true)}
                  onCanPlay={() => setPlaybackError(false)}
                />
              </div>

              {playbackError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center text-white">
                  <AlertCircle className="size-8 text-destructive" />
                  <p className="max-w-lg text-sm font-medium">
                    {t("mediaLibrary.videoPanel.preview.playbackError")}
                  </p>
                  <p className="max-w-lg text-xs text-white/65">
                    {t("mediaLibrary.videoPanel.preview.formatHint")}
                  </p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-t bg-card px-5 py-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Film className="size-4" />
                <span className="font-medium text-foreground">{video.format}</span>
              </span>
              <span>
                <span className="mr-1 text-muted-foreground/70">
                  {t("mediaLibrary.videoPanel.preview.duration")}
                </span>
                {formatDuration(video.durationMs)}
              </span>
              {video.width && video.height && (
                <span>
                  <span className="mr-1 text-muted-foreground/70">
                    {t("mediaLibrary.videoPanel.preview.resolution")}
                  </span>
                  {video.width} × {video.height}
                </span>
              )}
              <span>
                <span className="mr-1 text-muted-foreground/70">
                  {t("mediaLibrary.videoPanel.preview.size")}
                </span>
                {formatBytes(video.size)}
              </span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
