import { useState } from "react"
import { Film, Music2 } from "lucide-react"

import type { BackendConnectionState } from "@/api/client"
import BackendStatusBanner from "@/components/BackendStatusBanner"
import Header from "@/components/Header"
import AudioLibraryPanel from "@/components/audio/AudioLibraryPanel"
import VideoLibraryPanel from "@/components/media/VideoLibraryPanel"
import { t } from "@/i18n"
import { useVideoFiles } from "@/hooks/useVideoFiles"

interface Props {
  audioFileCount: number
  connectionState: BackendConnectionState
  onRetry?: () => void
}

type MediaTab = "audio" | "video"

export default function MediaLibrary({ audioFileCount, connectionState, onRetry }: Props) {
  const [activeTab, setActiveTab] = useState<MediaTab>("audio")
  const video = useVideoFiles()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title={t("pages.mediaLibrary.title")}
        subtitle={t("pages.mediaLibrary.subtitle")}
      />

      <BackendStatusBanner
        connectionState={connectionState}
        onRetry={() => { void onRetry?.() }}
      />

      <div role="group" aria-label={t("mediaLibrary.tabs.label")} className="flex shrink-0 items-center gap-1 border-b bg-card px-4 pt-2">
        <button
          type="button"
          onClick={() => setActiveTab("audio")}
          className={`inline-flex h-9 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${activeTab === "audio" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          aria-pressed={activeTab === "audio"}
        >
          <Music2 className="size-4" />
          {t("mediaLibrary.tabs.audio")}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{audioFileCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("video")}
          className={`inline-flex h-9 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${activeTab === "video" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          aria-pressed={activeTab === "video"}
        >
          <Film className="size-4" />
          {t("mediaLibrary.tabs.video")}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{video.files.length}</span>
        </button>
      </div>

      {activeTab === "audio" ? (
        <AudioLibraryPanel connectionState={connectionState} onRetry={onRetry} />
      ) : (
        <VideoLibraryPanel
          videoFiles={video.files}
          loading={video.isLoading}
          loadError={video.error}
          onReload={video.reload}
        />
      )}
    </div>
  )
}
