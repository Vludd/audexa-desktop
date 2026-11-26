import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { videoApi, type UpdateVideoFileRequest, type VideoFile } from "@/api/video"
import { VIDEO_FILES_QUERY_KEY } from "@/hooks/useVideoFiles"

export function useVideoLibrary() {
  const queryClient = useQueryClient()

  const uploadFile = useCallback((file: File) => videoApi.upload(file), [])

  const updateFile = useCallback(async (id: string, request: UpdateVideoFileRequest) => {
    const updated = await videoApi.update(id, request)
    queryClient.setQueryData<VideoFile[]>(VIDEO_FILES_QUERY_KEY, (files) =>
      files?.map((file) => file.id === id ? updated : file),
    )
    return updated
  }, [queryClient])

  const deleteFile = useCallback(async (id: string) => {
    await videoApi.delete(id)
    queryClient.setQueryData<VideoFile[]>(VIDEO_FILES_QUERY_KEY, (files) =>
      files?.filter((file) => file.id !== id),
    )
  }, [queryClient])

  return { uploadFile, updateFile, deleteFile }
}
