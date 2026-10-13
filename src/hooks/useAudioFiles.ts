import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import type { AudioFile } from "@/types"
import { audioApi } from "@/api/audio"
import { toast } from "@/lib/toast"
import { logger } from "@/lib/logger"
import { t } from "@/i18n"

const AUDIO_FILES_QUERY_KEY = ["audio-files"] as const

interface UseAudioFilesOptions {
  initialFiles?: AudioFile[]
}

const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
]

type PlaybackState =
  | "idle"
  | "starting"
  | "playing"
  | "paused"
  | "stopped"
  | "error"

const MIN_VOLUME_DB = -60
const MAX_VOLUME_DB = 12

function decibelsToGain(decibels: number) {
  if (decibels <= MIN_VOLUME_DB) return 0
  return 10 ** (decibels / 20)
}

function isSupportedAudioFile(file: File) {
  const name = file.name.toLowerCase()

  return SUPPORTED_AUDIO_EXTENSIONS.some((extension) =>
    name.endsWith(extension),
  )
}

export function useAudioFiles({
  initialFiles = [],
}: UseAudioFilesOptions) {
  const queryClient = useQueryClient()


  const {
    data: files = initialFiles,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: AUDIO_FILES_QUERY_KEY,
    queryFn: audioApi.getAll,
  })


  const [query, setQuery] = useState("")

  const [selectedId, setSelectedId] = useState<string | null>(
    null,
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])


  const [isDragging, setIsDragging] = useState(false)

  const dragCounterRef = useRef(0)


  const [currentFileId, setCurrentFileId] = useState<
    string | null
  >(null)

  const [isPlaying, setIsPlaying] = useState(false)
  
  const [playbackState, setPlaybackState] =
  useState<PlaybackState>("idle")

  const playbackStateRef = useRef<PlaybackState>("idle")

  const [playbackError, setPlaybackError] =
    useState<string | null>(null)

  const playRequestRef = useRef(0)

  const [currentTime, setCurrentTime] = useState(0)

  const [duration, setDuration] = useState(0)
  const [previewVolume, setPreviewVolume] = useState(1)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)


  const selectedFile = useMemo(
    () =>
      files.find((file) => file.id === selectedId) ?? null,
    [files, selectedId],
  )

  const currentFile = useMemo(
    () =>
      files.find((file) => file.id === currentFileId) ?? null,
    [files, currentFileId],
  )

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return files
    }

    return files.filter(
      (file) =>
        file.name.toLowerCase().includes(normalizedQuery) ||
        file.filename.toLowerCase().includes(normalizedQuery),
    )
  }, [files, query])

  const setPlayback = useCallback(
    (state: PlaybackState) => {
      playbackStateRef.current = state
      setPlaybackState(state)
    },
    [],
  )


  const ensureAudioElement = useCallback(() => {
    if (audioRef.current) {
      return audioRef.current
    }

    const audio = new Audio()
    audio.preload = "metadata"
    audio.crossOrigin = "anonymous"
    audio.volume = previewVolume

    const audioContext = new AudioContext()
    const source = audioContext.createMediaElementSource(audio)
    const gainNode = audioContext.createGain()
    gainNode.gain.value = 1
    source.connect(gainNode)
    gainNode.connect(audioContext.destination)
    audioContextRef.current = audioContext
    gainNodeRef.current = gainNode

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime)
    }

    audio.onloadedmetadata = () => {
      setDuration(
        Number.isFinite(audio.duration)
          ? audio.duration
          : 0,
      )
    }

    audio.onplaying = () => {
      setIsPlaying(true)
      setPlayback("playing")
      setPlaybackError(null)
    }

    audio.onpause = () => {
      setIsPlaying(false)

      if (playbackStateRef.current === "starting") {
        return
      }

      if (audio.currentTime === 0) {
        setPlayback("stopped")
      } else {
        setPlayback("paused")
      }
    }

    audio.onended = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      setPlayback("stopped")
    }

    audio.onerror = () => {
      setIsPlaying(false)

      const mediaError = audio.error

      logger.error(
        "AUDIO",
        "playback.failed",
        t("audio.errors.playback"),
        {
          fileId: currentFileId,
          mediaErrorCode: mediaError?.code,
          mediaErrorMessage: mediaError?.message,
        },
      )

      setPlayback("error")
      setPlaybackError(
        mediaError?.message ||
          t("audio.errors.playback"),
      )
    }

    audioRef.current = audio

    return audio
  }, [currentFileId, previewVolume, setPlayback])


  const play = useCallback(
    async (fileId: string) => {
      const file = files.find(
        (item) => item.id === fileId,
      )

      if (!file) {
        return
      }

      const requestId = ++playRequestRef.current

      setPlaybackError(null)
      setPlaybackState("starting")

      let audio: HTMLAudioElement | null = null

      try {
        audio = ensureAudioElement()

        if (currentFileId !== fileId) {
          audio.pause()

          audio.src = audioApi.getStreamUrl(fileId)
          audio.currentTime = 0

          const fileVolume = Math.max(
            MIN_VOLUME_DB,
            Math.min(file.volumeDb, MAX_VOLUME_DB),
          )

          if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = decibelsToGain(fileVolume)
          }

          setCurrentFileId(fileId)
          setCurrentTime(0)
          setDuration(file.duration || 0)
        }

        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume()
        }

        await audio.play()
      } catch (error) {
        if (
          requestId !== playRequestRef.current
        ) {
          return
        }

        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return
        }

        if (audio && !audio.paused) {
          return
        }

        logger.error(
          "AUDIO",
          "playback.start_failed",
          t("audio.errors.playbackStart"),
          {
            fileId,
            error: error instanceof Error ? error.message : String(error),
          },
        )

        setIsPlaying(false)
        setPlaybackState("error")
        setPlaybackError(
          t("audio.errors.playback"),
        )
      }
    },
    [currentFileId, ensureAudioElement, files],
  )

  const playCurrent = useCallback(async () => {
    if (!currentFileId) {
      return
    }

    await play(currentFileId)
  }, [currentFileId, play])

  const pause = useCallback(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    audio.pause()
    setPlaybackState("paused")
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    playRequestRef.current += 1

    audio.pause()
    audio.currentTime = 0

    setCurrentTime(0)
    setIsPlaying(false)
    setPlaybackState("stopped")
    setPlaybackError(null)
  }, [])

  const togglePlay = useCallback(
    async (fileId: string) => {
      if (
        currentFileId === fileId &&
        isPlaying
      ) {
        pause()
        return
      }

      await play(fileId)
    },
    [
      currentFileId,
      isPlaying,
      pause,
      play,
    ],
  )

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current

      if (!audio) {
        return
      }

      const maxTime = Number.isFinite(audio.duration)
        ? audio.duration
        : duration

      const nextTime = Math.max(
        0,
        Math.min(time, maxTime || 0),
      )

      audio.currentTime = nextTime
      setCurrentTime(nextTime)
    },
    [duration],
  )

  const skip = useCallback(
    (seconds: number) => {
      const audio = audioRef.current

      if (!audio) {
        return
      }

      seek(audio.currentTime + seconds)
    },
    [seek],
  )

  const changePreviewVolume = useCallback((value: number) => {
    const normalizedVolume = Math.max(0, Math.min(value, 1))
    setPreviewVolume(normalizedVolume)
    if (audioRef.current) {
      audioRef.current.volume = normalizedVolume
    }
  }, [])

  const gainMutation = useMutation({
    mutationFn: ({
      id,
      volumeDb,
    }: {
      id: string
      volumeDb: number
    }) =>
      audioApi.update(id, {
        name:
          files.find((file) => file.id === id)?.name ?? "",
        volumeDb,
      }),
    onMutate: async ({ id, volumeDb }) => {
      await queryClient.cancelQueries({
        queryKey: AUDIO_FILES_QUERY_KEY,
      })

      const previousFiles =
        queryClient.getQueryData<AudioFile[]>(AUDIO_FILES_QUERY_KEY)

      queryClient.setQueryData<AudioFile[]>(
        AUDIO_FILES_QUERY_KEY,
        (current = []) =>
          current.map((file) =>
            file.id === id ? { ...file, volumeDb } : file,
          ),
      )

      return { previousFiles }
    },
    onSuccess: (updatedFile) => {
      queryClient.setQueryData<AudioFile[]>(
        AUDIO_FILES_QUERY_KEY,
        (current = []) =>
          current.map((file) =>
            file.id === updatedFile.id ? updatedFile : file,
          ),
      )
    },
    onError: (error, _variables, context) => {
      if (context?.previousFiles) {
        queryClient.setQueryData(
          AUDIO_FILES_QUERY_KEY,
          context.previousFiles,
        )
      } else {
        void queryClient.invalidateQueries({
          queryKey: AUDIO_FILES_QUERY_KEY,
        })
      }
      toast.error(t("audio.errors.volume"), {
        description:
          error instanceof Error ? error.message : undefined,
      })
    },
  })

  const previewFileGain = useCallback(
    (id: string, value: number) => {
      const normalizedVolume = Math.round(
        Math.max(MIN_VOLUME_DB, Math.min(value, MAX_VOLUME_DB)),
      )

      queryClient.setQueryData<AudioFile[]>(
        AUDIO_FILES_QUERY_KEY,
        (current = []) =>
          current.map((file) =>
            file.id === id
              ? { ...file, volumeDb: normalizedVolume }
              : file,
          ),
      )

      if (id === currentFileId && gainNodeRef.current) {
        gainNodeRef.current.gain.value = decibelsToGain(normalizedVolume)
      }
    },
    [currentFileId, queryClient],
  )

  const commitFileGain = useCallback(
    (id: string, gainDb: number) => {
      const volumeDb = Math.round(
        Math.max(MIN_VOLUME_DB, Math.min(gainDb, MAX_VOLUME_DB)),
      )

      gainMutation.mutate({ id, volumeDb })
    },
    [gainMutation],
  )


  const selectFile = useCallback((id: string) => {
    setSelectedId(id)
  }, [])


  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter(
            (selectedId) => selectedId !== id,
          )
        : [...current, id],
    )
  }, [])

  const toggleSelectAll = useCallback(() => {
    const visibleIds = filteredFiles.map(
      (file) => file.id,
    )

    setSelectedIds((current) => {
      const allSelected =
        visibleIds.length > 0 &&
        visibleIds.every((id) =>
          current.includes(id),
        )

      if (allSelected) {
        return current.filter(
          (id) => !visibleIds.includes(id),
        )
      }

      return Array.from(
        new Set([
          ...current,
          ...visibleIds,
        ]),
      )
    })
  }, [filteredFiles])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])


  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      audioApi.upload(file),

    onSuccess: (file) => {
      void queryClient.invalidateQueries({
        queryKey: AUDIO_FILES_QUERY_KEY,
      })

      toast.success(t("audio.notifications.added"), {
        description: file.name,
      })
    },

    onError: (error, file) => {
      toast.error(t("audio.errors.upload"), {
        description:
          error instanceof Error
            ? error.message
            : file.name,
      })
    },
  })

  const addFiles = useCallback(
    async (incomingFiles: File[]) => {
      if (!incomingFiles.length) {
        return
      }

      for (const file of incomingFiles) {
        if (!isSupportedAudioFile(file)) {
          toast.error(t("audio.errors.unsupportedFormat"), {
            description:
              t("audio.errors.supportedFormatsHint", {
                name: file.name,
              }),
          })

          continue
        }

        try {
          await uploadMutation.mutateAsync(file)
        } catch {
          // Error is already handled by mutation onError.
        }
      }
    },
    [uploadMutation],
  )


  const renameMutation = useMutation({
    mutationFn: ({
      id,
      name,
    }: {
      id: string
      name: string
    }) =>
      audioApi.update(id, {
        name,
        volumeDb:
          files.find((file) => file.id === id)?.volumeDb ?? 0,
      }),

    onSuccess: (file) => {
      void queryClient.invalidateQueries({
        queryKey: AUDIO_FILES_QUERY_KEY,
      })

      toast.success(t("audio.notifications.renamed"), {
        description: file.name,
      })
    },

    onError: (error) => {
      toast.error(t("audio.errors.rename"), {
        description:
          error instanceof Error
            ? error.message
            : undefined,
      })
    },
  })

  const renameFile = useCallback(
    async (id: string, name: string) => {
      const normalizedName = name.trim()

      if (!normalizedName) {
        toast.warning(t("audio.errors.emptyName"))
        return false
      }

      try {
        await renameMutation.mutateAsync({
          id,
          name: normalizedName,
        })

        return true
      } catch {
        return false
      }
    },
    [renameMutation],
  )


  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      audioApi.delete(id),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: AUDIO_FILES_QUERY_KEY,
      })
    },

    onError: (error) => {
      toast.error(t("audio.errors.delete"), {
        description:
          error instanceof Error
            ? error.message
            : undefined,
      })
    },
  })


  const deleteSelectedMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => audioApi.delete(id)),
      )
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: AUDIO_FILES_QUERY_KEY,
      })
    },

    onError: (error) => {
      toast.error(t("audio.errors.deleteSelected"), {
        description:
          error instanceof Error
            ? error.message
            : undefined,
      })
    },
  })

  const deleteFile = useCallback(
    async (id: string) => {
      const file = files.find(
        (item) => item.id === id,
      )

      try {
        await deleteMutation.mutateAsync(id)

        if (currentFileId === id) {
          stop()

          if (audioRef.current) {
            audioRef.current.removeAttribute("src")
            audioRef.current.load()
          }

          setCurrentFileId(null)
          setDuration(0)
          setCurrentTime(0)
        }

        setSelectedId((current) =>
          current === id ? null : current,
        )

        setSelectedIds((current) =>
          current.filter(
            (selectedId) => selectedId !== id,
          ),
        )

        toast.success(t("audio.notifications.deleted"), {
          description: file?.name,
        })

        return true
      } catch {
        return false
      }
    },
    [currentFileId, deleteMutation, files, stop],
  )

  const deleteSelectedFiles = useCallback(
    async () => {
      if (!selectedIds.length) {
        return false
      }

      const idsToDelete = [...selectedIds]
      const idsSet = new Set(idsToDelete)

      try {
        await deleteSelectedMutation.mutateAsync(
          idsToDelete,
        )

        if (
          currentFileId !== null &&
          idsSet.has(currentFileId)
        ) {
          stop()

          if (audioRef.current) {
            audioRef.current.removeAttribute("src")
            audioRef.current.load()
          }

          setCurrentFileId(null)
          setCurrentTime(0)
          setDuration(0)
        }

        setSelectedId((current) =>
          current !== null &&
          idsSet.has(current)
            ? null
            : current,
        )

        setSelectedIds([])

        toast.success(t("audio.notifications.deletedMany"), {
          description: t("audio.notifications.deletedCount", {
            count: idsToDelete.length,
          }),
        })

        return true
      } catch {
        return false
      }
    },
    [
      currentFileId,
      deleteSelectedMutation,
      selectedIds,
      stop,
    ],
  )


  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()

      dragCounterRef.current += 1
      setIsDragging(true)
    },
    [],
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
    },
    [],
  )

  const handleDragLeave = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()

      dragCounterRef.current -= 1

      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setIsDragging(false)
      }
    },
    [],
  )

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()

      dragCounterRef.current = 0
      setIsDragging(false)

      const droppedFiles = Array.from(
        event.dataTransfer.files,
      )

      await addFiles(droppedFiles)
    },
    [addFiles],
  )


  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.removeAttribute("src")
        audio.load()
      }

      audioRef.current = null
      gainNodeRef.current = null

      const audioContext = audioContextRef.current
      audioContextRef.current = null
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close()
      }
    }
  }, [])


  const error =
    queryError instanceof Error
      ? queryError.message
      : queryError
        ? t("audio.import.loadError")
        : null


  return {
    files,
    filteredFiles,

    isLoading,

    error,

    reload: () => {
      void refetch()
    },

    query,
    setQuery,

    selectedId,
    selectedFile,
    selectFile,

    selectedIds,
    toggleSelection,
    toggleSelectAll,
    clearSelection,

    isDragging,
    addFiles,

    currentFileId,
    currentFile,

    isPlaying,
    isPlayPending: playbackState === "starting",
    playbackState,
    playbackError,

    currentTime,
    duration,
    previewVolume,

    play,
    playCurrent,
    togglePlay,
    pause,
    stop,
    seek,
    skip,
    changePreviewVolume,
    previewFileGain,
    commitFileGain,

    renameFile,
    deleteFile,
    deleteSelectedFiles,

    isUploading: uploadMutation.isPending,
    isRenaming: renameMutation.isPending,
    isDeleting:
      deleteMutation.isPending ||
      deleteSelectedMutation.isPending,

    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}