import { useMemo, useRef, useState } from "react"
import { FileVideo, Film, FolderOpen, HardDrive, Search, Trash2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type VideoDraft = {
  id: string
  file: File
  duration: number | null
  width: number | null
  height: number | null
}

const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".m4v", ".mkv", ".mov", ".avi", ".webm", ".mpeg", ".mpg"]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "—"
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remaining = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`
}

function isSupportedVideo(file: File) {
  const name = file.name.toLowerCase()
  return SUPPORTED_VIDEO_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export default function VideoLibraryPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drafts, setDrafts] = useState<VideoDraft[]>([])
  const [query, setQuery] = useState("")
  const [dragging, setDragging] = useState(false)
  const totalBytes = useMemo(() => drafts.reduce((total, item) => total + item.file.size, 0), [drafts])
  const visibleDrafts = useMemo(
    () => drafts.filter((item) => item.file.name.toLowerCase().includes(query.toLowerCase())),
    [drafts, query],
  )

  const addFiles = (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(isSupportedVideo)
    const next = accepted.map((file) => {
      const url = URL.createObjectURL(file)
      const draft: VideoDraft = { id: crypto.randomUUID(), file, duration: null, width: null, height: null }
      const video = document.createElement("video")
      video.preload = "metadata"
      video.onloadedmetadata = () => {
        setDrafts((current) => current.map((item) => item.id === draft.id
          ? { ...item, duration: Number.isFinite(video.duration) ? video.duration : null, width: video.videoWidth || null, height: video.videoHeight || null }
          : item))
        URL.revokeObjectURL(url)
        video.removeAttribute("src")
        video.load()
      }
      video.onerror = () => URL.revokeObjectURL(url)
      video.src = url
      return draft
    })
    if (next.length) setDrafts((current) => [...current, ...next])
  }

  const removeDraft = (id: string) => setDrafts((current) => {
    return current.filter((item) => item.id !== id)
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}>
      <input ref={inputRef} type="file" accept={SUPPORTED_VIDEO_EXTENSIONS.join(",")} multiple className="hidden"
        onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = "" }} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3"><div className="text-xs text-muted-foreground">Видеофайлов в подборке</div><div className="mt-1 text-2xl font-semibold tabular-nums">{drafts.length}</div></div>
        <div className="rounded-lg border bg-card px-4 py-3"><div className="text-xs text-muted-foreground">Общий размер</div><div className="mt-1 text-2xl font-semibold tabular-nums">{formatBytes(totalBytes)}</div></div>
        <div className="rounded-lg border bg-card px-4 py-3"><div className="text-xs text-muted-foreground">Поддерживаемые контейнеры</div><div className="mt-1 text-sm font-semibold">MP4 · MKV · MOV · AVI · WebM</div></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск видео..." className="pl-9" /></div>
        <Button onClick={() => inputRef.current?.click()}><Upload className="size-4" />Добавить видео</Button>
      </div>

      <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 px-3 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-start gap-2"><HardDrive className="mt-0.5 size-4 shrink-0 text-blue-400" /><div><span className="font-medium text-foreground">Этап проектирования интерфейса.</span> Выбранные файлы пока находятся только в памяти этой страницы. Сохранение в центральную медиатеку будет подключено на следующем этапе.</div></div>
      </div>

      {dragging && <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-8 backdrop-blur-sm"><div className="flex w-full max-w-lg flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-card p-10 text-center shadow-xl"><div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-7" /></div><div className="text-lg font-semibold">Перетащите видеофайлы сюда</div><div className="text-sm text-muted-foreground">MP4, MKV, MOV, AVI, WebM</div></div></div>}

      {visibleDrafts.length === 0 ? (
        <div className="flex min-h-64 flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-card/40 px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">{query ? <Search className="size-6" /> : <Film className="size-7" />}</div>
          <div className="mt-4 text-sm font-semibold">{query ? "Ничего не найдено" : "Видеотека пока пуста"}</div>
          <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{query ? "Попробуйте изменить поисковый запрос." : "Добавьте видеофайлы или перетащите их в эту область. После подключения Backend они будут загружаться в централизованное хранилище Audexa."}</p>
          {!query && <Button className="mt-4" variant="outline" onClick={() => inputRef.current?.click()}><FolderOpen className="size-4" />Выбрать файлы</Button>}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
          <div className="grid grid-cols-[minmax(0,1fr)_100px_100px_44px] items-center gap-3 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><span>Файл</span><span>Разрешение</span><span>Длительность</span><span /></div>
          <div className="divide-y">{visibleDrafts.map((item) => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_100px_100px_44px] items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><FileVideo className="size-5" /></div><div className="min-w-0"><div className="truncate text-sm font-medium">{item.file.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{item.file.name.split(".").pop()?.toUpperCase()} · {formatBytes(item.file.size)}</div></div></div>
            <span className="text-xs text-muted-foreground">{item.width && item.height ? `${item.width} × ${item.height}` : "—"}</span><span className="text-xs tabular-nums text-muted-foreground">{formatDuration(item.duration)}</span>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Удалить ${item.file.name} из предпросмотра`} onClick={() => removeDraft(item.id)}><Trash2 className="size-4" /></Button>
          </div>)}</div>
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span>{drafts.length} выбрано · {formatBytes(totalBytes)}</span>{drafts.length > 0 && <Button variant="ghost" size="sm" className="h-8" onClick={() => { setDrafts([]) }}><X className="size-3.5" />Очистить подборку</Button>}</div>
    </div>
  )
}
