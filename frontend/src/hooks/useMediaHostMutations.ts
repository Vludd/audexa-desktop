import { useMutation, useQueryClient } from "@tanstack/react-query"

import { mediaHostsApi } from "@/api/mediaHosts"
import { MEDIA_HOSTS_QUERY_KEY } from "@/hooks/useMediaHosts"

export function useMediaHostMutations() {
  const queryClient = useQueryClient()

  const renameMutation = useMutation({
    mutationFn: ({ hostId, name }: { hostId: string; name: string }) =>
      mediaHostsApi.rename(hostId, name),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MEDIA_HOSTS_QUERY_KEY }),
  })
  const revokeMutation = useMutation({
    mutationFn: mediaHostsApi.revoke,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MEDIA_HOSTS_QUERY_KEY }),
  })
  const deleteMutation = useMutation({
    mutationFn: mediaHostsApi.deleteRecord,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MEDIA_HOSTS_QUERY_KEY }),
  })

  function isHostBusy(hostId: string) {
    return (
      (renameMutation.isPending &&
        renameMutation.variables?.hostId === hostId) ||
      (revokeMutation.isPending && revokeMutation.variables === hostId) ||
      (deleteMutation.isPending && deleteMutation.variables === hostId)
    )
  }

  return {
    renameHost: (hostId: string, name: string) =>
      renameMutation.mutateAsync({ hostId, name }),
    revokeHost: (hostId: string) => revokeMutation.mutateAsync(hostId),
    deleteHost: (hostId: string) => deleteMutation.mutateAsync(hostId),
    isHostBusy,
  }
}
