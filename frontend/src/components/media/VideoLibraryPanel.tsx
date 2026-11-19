import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  FileVideo, Film, HardDrive, Loader2, Pencil, RefreshCw, Search,
  Trash2, Upload, X, Check, AlertCircle,
} from "lucide-react"

import { videoApi, type VideoFile } from "@/api/video"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const ACCEPTED = ".mp4,.m4v,.mkv,.mov,.avi,.webm,.mpeg,.mpg"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function getLoadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Не удалось загрузить видеотеку"
}

export default function VideoLibraryPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<VideoFile[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setFiles(await videoApi.getAll())
    } catch (e) {
      setError(getLoadErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    void videoApi.getAll()
      .then((loadedFiles) => {
        if (active) setFiles(loadedFiles)
      })
      .catch((error: unknown) => {
        if (active) setError(getLoadErrorMessage(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return files.filter((item) =>
      `${item.name} ${item.fileName} ${item.format}`.toLocaleLowerCase().includes(normalized),
    )
  }, [files, query])

  const totalBytes = useMemo(() => files.reduce((sum, item) => sum + item.size, 0), [files])

  const uploadFiles = async (picked: FileList | File[]) => {
    const candidates = Array.from(picked)
    if (!candidates.length) return
    setUploading(true)
    setError(null)
    const failures: string[] = []
    for (const file of candidates) {
      try {
        await videoApi.upload(file)
      } catch (e) {
        failures.push(`${file.name}: ${e instanceof Error ? e.message : "ошибка загрузки"}`)
      }
    }
    await load()
    setUploading(false)
    if (failures.length) setError(failures.join("\n"))
  }

  const saveRename = async (id: string) => {
    const name = editingName.trim()
    if (!name) {
      setError("Название не может быть пустым.")
      return
    }
    setBusyId(id)
    setError(null)
    try {
      const updated = await videoApi.update(id, { name })
      setFiles((current) => current.map((item) => item.id === id ? updated : item))
      setEditingId(null)
      setEditingName("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переименовать видео")
    } finally {
      setBusyId(null)
    }
  }

  const deleteFile = async (item: VideoFile) => {
    if (!window.confirm(`Удалить «${item.name}» из видеотеки? Это действие нельзя отменить.`)) return
    setBusyId(item.id)
    setError(null)
    try {
      await videoApi.delete(item.id)
      setFiles((current) => current.filter((file) => file.id !== item.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить видео")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void uploadFiles(event.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void uploadFiles(event.target.files)
          event.target.value = ""
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Видеофайлов</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{files.length}</div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Занято в хранилище</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{formatBytes(totalBytes)}</div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Поддерживаемые контейнеры</div>
          <div className="mt-1 text-sm font-semibold">MP4 · MKV · MOV · AVI · WebM</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск видео..." className="pl-9" />
        </div>
        <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading || uploading} aria-label="Обновить видеотеку">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? "Загрузка..." : "Добавить видео"}
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 whitespace-pre-line rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Закрыть"><X className="size-4" /></button>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-8 backdrop-blur-sm">
          <div className="flex w-full max-w-lg flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-card p-10 text-center shadow-xl">
            <Upload className="size-8 text-primary" />
            <div className="text-lg font-semibold">Перетащите видеофайлы сюда</div>
            <div className="text-sm text-muted-foreground">MP4, MKV, MOV, AVI, WebM и MPEG</div>
          </div>
        </div>
      )}

      {loading && files.length === 0 ? (
        <div className="flex min-h-64 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Загрузка видеотеки...
        </div>
      ) : visibleFiles.length === 0 ? (
        <div className="flex min-h-64 flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-card/40 px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {query ? <Search className="size-6" /> : <Film className="size-7" />}
          </div>
          <div className="mt-4 text-sm font-semibold">{query ? "Ничего не найдено" : "Видеотека пока пуста"}</div>
          <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            {query ? "Попробуйте изменить поисковый запрос." : "Добавьте видеофайлы или перетащите их в эту область. Они будут сохранены в хранилище Audexa."}
          </p>
          {!query && <Button className="mt-4" variant="outline" onClick={() => inputRef.current?.click()}><Upload className="size-4" />Выбрать файлы</Button>}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
          <div className="grid grid-cols-[minmax(0,1fr)_90px_100px] items-center gap-3 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Файл</span><span>Размер</span><span className="text-right">Действия</span>
          </div>
          <div className="divide-y">
            {visibleFiles.map((item) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_90px_100px] items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><FileVideo className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <Input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => {
                          if (event.key === "Enter") void saveRename(item.id)
                          if (event.key === "Escape") setEditingId(null)
                        }} className="h-8" />
                        <Button size="icon" variant="ghost" className="size-8" disabled={busyId === item.id} onClick={() => void saveRename(item.id)} aria-label="Сохранить"><Check className="size-4" /></Button>
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditingId(null)} aria-label="Отмена"><X className="size-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.fileName} · {item.format}</div>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{formatBytes(item.size)}</span>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="size-8" disabled={busyId === item.id || editingId !== null} onClick={() => { setEditingId(item.id); setEditingName(item.name) }} aria-label="Переименовать"><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" disabled={busyId === item.id || editingId !== null} onClick={() => void deleteFile(item)} aria-label="Удалить"><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>{files.length} файлов · {formatBytes(totalBytes)}</span>
        <span className="inline-flex items-center gap-1"><HardDrive className="size-3.5" /> Хранилище Audexa</span>
      </div>
    </div>
  )
}
