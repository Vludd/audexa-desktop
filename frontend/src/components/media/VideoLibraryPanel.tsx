import { useMemo, useState } from "react";
import {
  FileVideo,
  Film,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
  Check,
  AlertCircle,
} from "lucide-react";

import type { VideoFile } from "@/api/video";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVideoLibrary } from "@/hooks/useVideoLibrary";
import { useFilePicker } from "@/hooks/useFilePicker";
import VideoGainControl from "@/components/media/VideoGainControl";
import VideoToolbar, {
  ALL_VIDEO_FILE_TYPES,
} from "@/components/media/VideoToolbar";
import { t } from "@/i18n";

const ACCEPTED = [
  ".mp4",
  ".m4v",
  ".mkv",
  ".mov",
  ".avi",
  ".webm",
  ".mpeg",
  ".mpg",
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function getLoadErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : t("mediaLibrary.videoPanel.errors.load");
}

interface Props {
  videoFiles: VideoFile[];
  loading: boolean;
  loadError: unknown;
  onReload: () => Promise<unknown>;
}

export default function VideoLibraryPanel({
  videoFiles,
  loading,
  loadError,
  onReload,
}: Props) {
  const { uploadFile, updateFile, deleteFile: removeFile } = useVideoLibrary();
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fileTypes = useMemo(
    () =>
      Array.from(
        new Set(
          videoFiles
            .map((file) => file.format.trim().toUpperCase())
            .filter(Boolean),
        ),
      ).sort(),
    [videoFiles],
  );
  const [fileTypeFilter, setFileTypeFilter] = useState(ALL_VIDEO_FILE_TYPES);
  const activeFileTypeFilter = fileTypes.includes(fileTypeFilter)
    ? fileTypeFilter
    : ALL_VIDEO_FILE_TYPES;

  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return videoFiles.filter((item) => {
      const matchesQuery = `${item.name} ${item.fileName} ${item.format}`
        .toLocaleLowerCase()
        .includes(normalized);
      const matchesType =
        activeFileTypeFilter === ALL_VIDEO_FILE_TYPES ||
        item.format.trim().toUpperCase() === activeFileTypeFilter;
      return matchesQuery && matchesType;
    });
  }, [videoFiles, query, activeFileTypeFilter]);

  const totalBytes = useMemo(
    () => videoFiles.reduce((sum, item) => sum + item.size, 0),
    [videoFiles],
  );

  const displayedError =
    error ?? (loadError ? getLoadErrorMessage(loadError) : null);
  const hasActiveFilters =
    query.trim().length > 0 || activeFileTypeFilter !== ALL_VIDEO_FILE_TYPES;

  const uploadFiles = async (picked: FileList | File[]) => {
    const candidates = Array.from(picked);
    if (!candidates.length) return;
    setUploading(true);
    setError(null);
    const failures: string[] = [];
    for (const file of candidates) {
      try {
        await uploadFile(file);
      } catch (e) {
        failures.push(
          `${file.name}: ${e instanceof Error ? e.message : t("mediaLibrary.videoPanel.errors.upload")}`,
        );
      }
    }
    try {
      await onReload();
    } catch (e) {
      failures.push(
        e instanceof Error
          ? `${t("mediaLibrary.videoPanel.errors.refresh")}: ${e.message}`
          : t("mediaLibrary.videoPanel.errors.refresh"),
      );
    }
    setUploading(false);
    if (failures.length) setError(failures.join("\n"));
  };

  const filePicker = useFilePicker({
    accept: ACCEPTED,
    multiple: true,
    onPick: (files) => {
      void uploadFiles(files);
    },
  });

  const saveRename = async (id: string) => {
    const name = editingName.trim();
    if (!name) {
      setError(t("mediaLibrary.videoPanel.errors.emptyName"));
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await updateFile(id, { name });
      setEditingId(null);
      setEditingName("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("mediaLibrary.videoPanel.errors.rename"),
      );
    } finally {
      setBusyId(null);
    }
  };

  const saveGain = async (
    item: VideoFile,
    gainDb: number,
  ): Promise<boolean> => {
    if (gainDb === item.gainDb) return true;
    setBusyId(item.id);
    setError(null);
    try {
      await updateFile(item.id, { name: item.name, gainDb });
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("mediaLibrary.videoPanel.errors.gain"),
      );
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const deleteFile = async (item: VideoFile) => {
    if (
      !window.confirm(
        t("mediaLibrary.videoPanel.confirmDelete", { name: item.name }),
      )
    )
      return;
    setBusyId(item.id);
    setError(null);
    try {
      await removeFile(item.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("mediaLibrary.videoPanel.errors.delete"),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <input {...filePicker.inputProps} disabled={uploading} />

      <div className="shrink-0">
        <VideoToolbar
          query={query}
          onQueryChange={setQuery}
          fileTypes={fileTypes}
          fileTypeFilter={activeFileTypeFilter}
          onFileTypeFilterChange={setFileTypeFilter}
          fileCount={videoFiles.length}
          storageBytes={totalBytes}
          isUploading={uploading}
          isAddPending={filePicker.isOpening}
          onAdd={() => {
            void filePicker.open();
          }}
        />
      </div>

      {displayedError && (
        <div
          role="alert"
          className="mx-4 mt-2 flex shrink-0 items-start gap-2 whitespace-pre-line rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">{displayedError}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={t("common.close")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div
        className="relative min-h-0 flex-1 overflow-auto p-4"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void uploadFiles(event.dataTransfer.files);
        }}
      >
        {dragging && (
          <div className="absolute inset-4 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/95 p-8 text-center backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Upload className="size-8 text-primary" />
              <div className="text-lg font-semibold">
                {t("mediaLibrary.videoPanel.dragDrop.title")}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("mediaLibrary.videoPanel.dragDrop.formats")}
              </div>
            </div>
          </div>
        )}

        {loading && videoFiles.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("mediaLibrary.videoPanel.loading")}
          </div>
        ) : visibleFiles.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed bg-card/40 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {hasActiveFilters ? (
                <Search className="size-6" />
              ) : (
                <Film className="size-7" />
              )}
            </div>
            <div className="mt-4 text-sm font-semibold">
              {hasActiveFilters
                ? t("mediaLibrary.videoPanel.noResults")
                : t("mediaLibrary.videoPanel.empty")}
            </div>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              {hasActiveFilters
                ? t("mediaLibrary.videoPanel.noResultsDescription")
                : t("mediaLibrary.videoPanel.emptyDescription")}
            </p>
            {!hasActiveFilters && (
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  void filePicker.open();
                }}
                disabled={uploading || filePicker.isOpening}
              >
                <Upload className="size-4" />
                {t("mediaLibrary.videoPanel.chooseFiles")}
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <div className="grid grid-cols-[minmax(0,1fr)_90px_100px] items-center gap-3 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>{t("mediaLibrary.videoPanel.table.file")}</span>
              <span>{t("mediaLibrary.videoPanel.table.size")}</span>
              <span className="text-right">
                {t("mediaLibrary.videoPanel.table.actions")}
              </span>
            </div>
            <div className="divide-y">
              {visibleFiles.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_90px_100px] items-center gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <FileVideo className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter")
                                void saveRename(item.id);
                              if (event.key === "Escape") setEditingId(null);
                            }}
                            className="h-8"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            disabled={busyId === item.id}
                            onClick={() => void saveRename(item.id)}
                            aria-label={t("common.save")}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => setEditingId(null)}
                            aria-label={t("common.cancel")}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="truncate text-sm font-medium">
                            {item.name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.fileName} · {item.format}
                          </div>
                          <VideoGainControl
                            item={item}
                            disabled={busyId === item.id}
                            onSave={(gainDb) => saveGain(item, gainDb)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(item.size)}
                  </span>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={busyId === item.id || editingId !== null}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingName(item.name);
                      }}
                      aria-label={t("mediaLibrary.videoPanel.renameFile", {
                        name: item.name,
                      })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      disabled={busyId === item.id || editingId !== null}
                      onClick={() => void deleteFile(item)}
                      aria-label={t("mediaLibrary.videoPanel.deleteFile", {
                        name: item.name,
                      })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
