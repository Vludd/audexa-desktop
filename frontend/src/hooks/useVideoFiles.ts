import { useQuery } from "@tanstack/react-query"

import { videoApi } from "@/api/video"

export const VIDEO_FILES_QUERY_KEY = ["video-files"] as const

export function useVideoFiles() {
  const query = useQuery({
    queryKey: VIDEO_FILES_QUERY_KEY,
    queryFn: videoApi.getAll,
    staleTime: 30_000,
  })

  return {
    files: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    reload: query.refetch,
  }
}
