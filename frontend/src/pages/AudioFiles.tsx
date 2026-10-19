import { useState } from "react"
import type { BackendConnectionState } from "@/api/client"

import {
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Upload,
  X,
} from "lucide-react"

import Header from "@/components/Header"
import { t } from "@/i18n"
import AudioToolbar from "@/components/audio/AudioToolbar"
import AudioTable from "@/components/audio/AudioTable"
import AudioPlayer from "@/components/audio/AudioPlayer"

import ConfirmDialog from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useConfirm } from "@/hooks/useConfirm"
import { useAudioFiles } from "@/hooks/useAudioFiles"
import { useFilePicker } from "@/hooks/useFilePicker"
import BackendStatusBanner from "@/components/BackendStatusBanner"

interface Props {
  connectionState: BackendConnectionState
  onRetry?: () => void
}

export default function AudioFiles({ connectionState, onRetry }: Props) {
  const audio = useAudioFiles({})

  const filePicker = useFilePicker({
    accept: [".mp3", ".wav"],
    multiple: true,
    onPick: (files) => void audio.addFiles(files),
  })
  const confirm = useConfirm()
  const backendUnavailable = connectionState !== "online"
  const controlsBlocked = backendUnavailable || audio.isLoading || audio.error != null

  const [renameFileId, setRenameFileId] = useState<
    string | null
  >(null)

  const [renameName, setRenameName] = useState("")

  const renameFile = audio.files.find(
    (file) => file.id === renameFileId,
  )

  const handleRename = (id: string) => {
    if (controlsBlocked) return

    const file = audio.files.find(
      (item) => item.id === id,
    )

    if (!file) {
      return
    }

    setRenameFileId(id)
    setRenameName(file.name)
  }

  const handleRenameSubmit = async () => {
    if (controlsBlocked || !renameFileId) {
      return
    }

    const success = await audio.renameFile(
      renameFileId,
      renameName,
    )

    if (success) {
      setRenameFileId(null)
      setRenameName("")
    }
  }

  const handleDelete = (id: string) => {
    if (controlsBlocked) return

    const file = audio.files.find(
      (item) => item.id === id,
    )

    if (!file) {
      return
    }

    confirm.confirm({
      title: t("audio.confirmDelete.title"),
      description: t("audio.confirmDelete.description", {
        name: file.name,
      }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      variant: "destructive",
      onConfirm: async () => {
        await audio.deleteFile(id)
      },
    })
  }

  const handleDeleteSelected = () => {
    if (controlsBlocked) return

    const count = audio.selectedIds.length

    if (!count) {
      return
    }

    confirm.confirm({
      title: t("audio.confirmDelete.selectedTitle"),
      description: t("audio.confirmDelete.selectedDescription", {
        count,
      }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      variant: "destructive",
      onConfirm: async () => {
        await audio.deleteSelectedFiles()
      },
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title={t("pages.audioFiles.title")}
        subtitle={t("pages.audioFiles.subtitle")}
      />

      <BackendStatusBanner
        connectionState={connectionState}
        onRetry={() => { void onRetry?.() }}
      />

      <div inert={controlsBlocked} aria-disabled={controlsBlocked || undefined} className="shrink-0">
        <AudioToolbar
          query={audio.query}
          onQueryChange={audio.setQuery}
          fileCount={audio.files.length}
          storageBytes={audio.files.reduce((total, file) => total + file.size, 0)}
          onAdd={() => { if (!controlsBlocked) void filePicker.open() }}
          isAddPending={filePicker.isOpening}
          selectedCount={audio.selectedIds.length}
          onDeleteSelected={handleDeleteSelected}
          disabled={controlsBlocked}
        />
      </div>

      {connectionState === "online" && (audio.isLoading || audio.error != null) && (
        <div role="status" className="mx-4 mt-2 flex shrink-0 items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1">
            {audio.error ? t("common.audioFilesRefreshFailed") : t("common.audioFilesLoading")}{" "}
            {t("common.backendControlsBlocked")}
          </span>
          {audio.error && (
            <Button type="button" size="sm" variant="outline" disabled={audio.isLoading} onClick={() => { onRetry?.(); void audio.reload() }}>
              <RotateCcw className="size-3.5" />
              {t("common.retryLoading")}
            </Button>
          )}
        </div>
      )}

      <input {...filePicker.inputProps} disabled={controlsBlocked} />

      <div
        className="relative min-h-0 flex-1 overflow-auto p-4"
        inert={controlsBlocked}
        aria-disabled={controlsBlocked || undefined}
        onDragEnter={(event) => { if (!controlsBlocked) audio.handleDragEnter(event) }}
        onDragOver={(event) => { if (!controlsBlocked) audio.handleDragOver(event) }}
        onDragLeave={(event) => { if (!controlsBlocked) audio.handleDragLeave(event) }}
        onDrop={(event) => { if (!controlsBlocked) audio.handleDrop(event) }}
      >
        {audio.isDragging && (
          <div className="absolute inset-4 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/95 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="size-5" />
              </div>

              <span className="font-medium">
                {t("audio.import.drop")}
              </span>

              <span className="text-sm text-muted-foreground">
                {t("audio.import.supported")}
              </span>
            </div>
          </div>
        )}

        {audio.isUploading && (
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            {t("audio.import.uploading")}
          </div>
        )}

        {audio.isLoading && audio.files.length === 0 ? (
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex h-14 items-center gap-4 px-4"
                >
                  <div className="size-4 animate-pulse rounded bg-muted" />
                  <div className="size-7 animate-pulse rounded-full bg-muted" />
                  <div className="h-4 w-52 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-64 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-10 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ) : audio.error && audio.files.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border bg-card text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <X className="size-5" />
            </div>

            <div className="mt-3 text-sm font-medium">
              {t("audio.import.loadError")}
            </div>

            <div className="mt-1 max-w-md text-xs text-muted-foreground">
              {audio.error}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={audio.reload}
            >
              <RotateCcw className="size-4" />
              {t("audio.import.retry")}
            </Button>
          </div>
        ) : audio.filteredFiles.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border bg-card text-center">
            {audio.query ? (
              <>
                <div className="text-sm font-medium">
                  {t("audio.import.noResults")}
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  {t("audio.import.searchHint")}
                </div>
              </>
            ) : (
              <>
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
                  ♪
                </div>

                <div className="mt-3 text-sm font-medium">
                  {t("audio.import.empty")}
                </div>

                <div className="mt-1 max-w-md text-xs text-muted-foreground">
                  {t("audio.import.emptyDescription")}
                </div>

                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => void filePicker.open()}
                  disabled={controlsBlocked || filePicker.isOpening}
                  aria-busy={filePicker.isOpening}
                >
                  {filePicker.isOpening ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}

                  {filePicker.isOpening
                    ? t("audio.toolbar.opening")
                    : t("audio.toolbar.add")}
                </Button>
              </>
            )}
          </div>
        ) : (
          <AudioTable
            files={audio.filteredFiles}
            selected={audio.selectedId}
            selectedIds={audio.selectedIds}
            currentFileId={audio.currentFileId}
            isPlaying={audio.isPlaying}
            isPlayPending={audio.isPlayPending}
            currentTime={audio.currentTime}
            duration={audio.duration}
            onSelect={audio.selectFile}
            onToggleSelection={audio.toggleSelection}
            onToggleSelectAll={audio.toggleSelectAll}
            onTogglePlay={audio.togglePlay}
            onRename={handleRename}
            onDelete={handleDelete}
            onGainPreview={audio.previewFileGain}
            onGainCommit={audio.commitFileGain}
          />
        )}
      </div>

      <div className="shrink-0 bg-background" inert={controlsBlocked} aria-disabled={controlsBlocked || undefined}>
        <AudioPlayer
          file={audio.currentFile}
          isPlaying={audio.isPlaying}
          isPlayPending={audio.isPlayPending}
          playbackError={audio.playbackError}
          currentTime={audio.currentTime}
          duration={audio.duration}
          previewVolume={audio.previewVolume}
          onPlay={audio.playCurrent}
          onPause={audio.pause}
          onStop={audio.stop}
          onSeek={audio.seek}
          onPreviewVolumeChange={audio.changePreviewVolume}
          onSkip={audio.skip}
        />
      </div>

      <ConfirmDialog
        open={confirm.open && !controlsBlocked}
        onOpenChange={(open) => {
          if (!open) {
            confirm.close()
          }
        }}
        title={confirm.options?.title ?? ""}
        description={confirm.options?.description}
        confirmLabel={confirm.options?.confirmLabel}
        cancelLabel={confirm.options?.cancelLabel}
        variant={confirm.options?.variant}
        loading={confirm.loading}
        onConfirm={confirm.handleConfirm}
      />

      <Dialog
        open={renameFileId !== null && !controlsBlocked}
        onOpenChange={(open) => {
          if (!open) {
            setRenameFileId(null)
            setRenameName("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("audio.rename.title")}
            </DialogTitle>

            <DialogDescription>
              {t("audio.rename.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="audio-file-name"
              className="text-sm font-medium"
            >
              {t("audio.rename.name")}
            </label>

            <Input
              id="audio-file-name"
              value={renameName}
              onChange={(event) =>
                setRenameName(event.target.value)
              }
              placeholder={t("audio.rename.placeholder")}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleRenameSubmit()
                }
              }}
            />

            {renameFile && (
              <div className="text-xs text-muted-foreground">
                {t("audio.rename.file", {
                  filename: renameFile.filename,
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameFileId(null)
                setRenameName("")
              }}
              disabled={controlsBlocked || audio.isRenaming}
            >
              {t("common.cancel")}
            </Button>

            <Button
              onClick={() => void handleRenameSubmit()}
              disabled={
                audio.isRenaming ||
                !renameName.trim()
              }
            >
              {audio.isRenaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}

              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}