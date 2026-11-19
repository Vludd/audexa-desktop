import { useMemo, useState } from "react";
import {
  Monitor,
  MonitorCheck,
  MonitorOff,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react";

import Header from "@/components/Header";
import DisplayPlaybackControls from "@/components/media-hosts/DisplayPlaybackControls";
import { useMediaHosts } from "@/hooks/useMediaHosts";
import { t } from "@/i18n";
import type { MediaHost } from "@/api/mediaHosts";

function formatLastSeen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function HostCard({ host }: { host: MediaHost }) {
  const online = host.status.toLowerCase() === "online";
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Monitor className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {host.name}
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {host.machineName}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${online ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
        >
          {online ? (
            <Wifi className="size-3.5" />
          ) : (
            <WifiOff className="size-3.5" />
          )}
          {online ? t("common.online") : t("common.offline")}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] text-muted-foreground">
            {t("mediaHosts.ipAddress")}
          </p>
          <p className="mt-1 text-xs font-medium tabular-nums">
            {host.ipAddress || "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">
            {t("mediaHosts.agentVersion")}
          </p>
          <p className="mt-1 text-xs font-medium">{host.agentVersion || "—"}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">
            {t("mediaHosts.lastSeen")}
          </p>
          <p className="mt-1 text-xs font-medium">
            {formatLastSeen(host.lastSeenAtUtc)}
          </p>
        </div>
      </div>
      <div className="border-t bg-muted/20 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold">{t("mediaHosts.displays")}</p>
          <span className="text-[11px] text-muted-foreground">
            {host.displays.length}
          </span>
        </div>
        {host.displays.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            {t("mediaHosts.noDisplays")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {host.displays.map((display) => (
              <div
                key={display.id}
                className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border bg-card p-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  {display.isPrimary ? (
                    <MonitorCheck className="size-4 text-primary" />
                  ) : (
                    <MonitorOff className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {display.friendlyName || display.deviceName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {display.width} × {display.height}
                    {display.refreshRate > 0
                      ? ` · ${display.refreshRate} Hz`
                      : ""}
                  </p>
                </div>
                {display.isPrimary && (
                  <span className="shrink-0 rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                    {t("mediaHosts.primary")}
                  </span>
                )}
                <div className="w-full basis-full">
                  <DisplayPlaybackControls
                    hostId={host.id}
                    displayKey={display.displayKey}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function MediaHosts() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading, isFetching, error, refetch } = useMediaHosts();
  const hosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((host) =>
      [host.name, host.machineName, host.ipAddress ?? ""].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [data, search]);
  const onlineCount = data.filter(
    (host) => host.status.toLowerCase() === "online",
  ).length;
  const displayCount = data.reduce(
    (total, host) => total + host.displays.length,
    0,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title={t("pages.mediaHosts.title")}
        subtitle={t("pages.mediaHosts.subtitle")}
      />
      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("mediaHosts.totalHosts")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.length}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("mediaHosts.onlineHosts")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {onlineCount}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("mediaHosts.totalDisplays")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {displayCount}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("mediaHosts.searchPlaceholder")}
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            {t("common.retry")}
          </button>
        </div>
        {isLoading ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("mediaHosts.loading")}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm font-medium">{t("mediaHosts.loadError")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error.message}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-md border bg-card px-3 py-2 text-xs font-medium"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : hosts.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Monitor className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              {search ? t("mediaHosts.noSearchResults") : t("mediaHosts.empty")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("mediaHosts.emptyDescription")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {hosts.map((host) => (
              <HostCard key={host.id} host={host} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
