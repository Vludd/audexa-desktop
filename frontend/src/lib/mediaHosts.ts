import type { MediaHost } from "@/api/mediaHosts"

export function formatLastSeen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function filterMediaHosts(hosts: MediaHost[], search: string) {
  const query = search.trim().toLowerCase()
  if (!query) return hosts

  return hosts.filter((host) =>
    [host.name, host.machineName, host.ipAddress ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    ),
  )
}

export function getMediaHostSummary(hosts: MediaHost[]) {
  return {
    totalHosts: hosts.length,
    onlineHosts: hosts.filter(
      (host) => host.status.toLowerCase() === "online",
    ).length,
    totalDisplays: hosts.reduce(
      (total, host) => total + host.displays.length,
      0,
    ),
  }
}
