import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Monitor,
  MonitorCheck,
  MonitorOff,
  Pencil,
  Unlink,
  Trash2,
  Check,
  X,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react";

import Header from "@/components/Header";
import DisplayPlaybackControls from "@/components/media-hosts/DisplayPlaybackControls";
import { useMediaHosts } from "@/hooks/useMediaHosts";
import { t } from "@/i18n";
import { mediaHostsApi, type MediaHost, type MediaHostPairingCreated } from "@/api/mediaHosts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatLastSeen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function HostCard({
  host,
  busy,
  onRename,
  onRevoke,
  onDelete,
}: {
  host: MediaHost;
  busy: boolean;
  onRename: (hostId: string, name: string) => Promise<void>;
  onRevoke: (hostId: string) => Promise<void>;
  onDelete: (hostId: string) => Promise<void>;
}) {
  const online = host.status.toLowerCase() === "online";
  const disabled = host.status.toLowerCase() === "disabled";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(host.name);
  const [actionError, setActionError] = useState("");

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized || normalized === host.name) {
      setEditing(false);
      setName(host.name);
      return;
    }
    setActionError("");
    try {
      await onRename(host.id, normalized);
      setEditing(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("mediaHosts.actions.actionError"));
    }
  };

  const revoke = async () => {
    if (!window.confirm(t("mediaHosts.actions.revokeConfirm", { name: host.name }))) return;
    setActionError("");
    try {
      await onRevoke(host.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("mediaHosts.actions.actionError"));
    }
  };

  const remove = async () => {
    if (!window.confirm(t("mediaHosts.actions.deleteConfirm", { name: host.name }))) return;
    setActionError("");
    try {
      await onDelete(host.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("mediaHosts.actions.actionError"));
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Monitor className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <form onSubmit={(event) => void saveName(event)} className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("mediaHosts.actions.name")}
                />
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  title={t("mediaHosts.actions.save")}
                  className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setEditing(false); setName(host.name); setActionError(""); }}
                  title={t("common.cancel")}
                  className="inline-flex size-8 items-center justify-center rounded-md border"
                >
                  <X className="size-4" />
                </button>
              </form>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-foreground">{host.name}</h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setName(host.name); setEditing(true); setActionError(""); }}
                  title={t("mediaHosts.actions.rename")}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{host.machineName}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${disabled ? "bg-destructive/10 text-destructive" : online ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
        >
          {disabled ? <Unlink className="size-3.5" /> : online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {disabled ? t("mediaHosts.actions.unpaired") : online ? t("common.online") : t("common.offline")}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>{t("mediaHosts.ipAddress")}: <strong className="font-medium text-foreground">{host.ipAddress || "—"}</strong></span>
          <span>{t("mediaHosts.agentVersion")}: <strong className="font-medium text-foreground">{host.agentVersion || "—"}</strong></span>
          <span>{t("mediaHosts.lastSeen")}: <strong className="font-medium text-foreground">{formatLastSeen(host.lastSeenAtUtc)}</strong></span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!disabled ? (
            <Button
              variant="destructive"
              onClick={() => void revoke()}
              disabled={busy}
            >
              <Unlink className="size-3.5" />
              {t("mediaHosts.actions.unpair")}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => void remove()}
              disabled={busy}
            >
              <Trash2 className="size-3.5" />
              {t("mediaHosts.actions.delete")}
            </Button>
          )}
        </div>
      </div>
      {actionError && (
        <p className="border-t bg-destructive/5 px-4 py-2 text-xs text-destructive">{actionError}</p>
      )}
      <div className="border-t bg-muted/20 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold">{t("mediaHosts.displays")}</p>
          <span className="text-[11px] text-muted-foreground">{host.displays.length}</span>
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
                  {display.isPrimary ? <MonitorCheck className="size-4 text-primary" /> : <MonitorOff className="size-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{display.friendlyName || display.deviceName}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {display.width} × {display.height}{display.refreshRate > 0 ? ` · ${display.refreshRate} Hz` : ""}
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
                    disabled={!online || disabled || busy}
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showPairingForm, setShowPairingForm] = useState(false);
  const [pairingName, setPairingName] = useState("");
  const [pairingDescription, setPairingDescription] = useState("");
  const [pairing, setPairing] = useState<MediaHostPairingCreated | null>(null);
  const [pairingError, setPairingError] = useState("");
  const [pairingBusy, setPairingBusy] = useState(false);
  const { data = [], isLoading, isFetching, error, refetch } = useMediaHosts();
  const renameMutation = useMutation({
    mutationFn: ({ hostId, name }: { hostId: string; name: string }) => mediaHostsApi.rename(hostId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media-hosts"] }),
  });
  const revokeMutation = useMutation({
    mutationFn: mediaHostsApi.revoke,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media-hosts"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: mediaHostsApi.deleteRecord,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media-hosts"] }),
  });

  const createPairing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPairingBusy(true);
    setPairingError("");
    try {
      const result = await mediaHostsApi.createPairing({
        hostName: pairingName.trim(),
        description: pairingDescription.trim() || undefined,
      });
      setPairing(result);
      setPairingName("");
      setPairingDescription("");
      setShowPairingForm(false);
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : t("mediaHosts.pairing.createError"));
    } finally {
      setPairingBusy(false);
    }
  };
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t("mediaHosts.pairing.title")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("mediaHosts.pairing.description")}
            </p>
          </div>
          <Button
            onClick={() => { setShowPairingForm((value) => !value); setPairingError(""); }}
          >
            {t("mediaHosts.pairing.addAgent")}
          </Button>
        </div>

        {showPairingForm && (
          <form onSubmit={(event) => void createPairing(event)} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1.5 text-xs font-medium">
              {t("mediaHosts.pairing.hostName")}

              <Input
                autoFocus
                required
                maxLength={200}
                value={pairingName}
                onChange={(event) => setPairingName(event.target.value)}
                placeholder={t("mediaHosts.pairing.hostNamePlaceholder")}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium">
              {t("mediaHosts.pairing.hostDescription")}

              <Input
                maxLength={1000}
                value={pairingDescription}
                onChange={(event) => setPairingDescription(event.target.value)}
                placeholder={t("mediaHosts.pairing.descriptionPlaceholder")}
              />
            </label>
            <Button
              type="submit"
              disabled={pairingBusy || !pairingName.trim()}
            >
              {pairingBusy ? t("mediaHosts.pairing.creating") : t("mediaHosts.pairing.createCode")}
            </Button>
            {pairingError && <p className="text-xs text-destructive sm:col-span-3">{pairingError}</p>}
          </form>
        )}

        {pairing && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div>
              <p className="text-xs font-semibold">{t("mediaHosts.pairing.codeTitle")}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("mediaHosts.pairing.codeHint")}
              </p>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          onClick={() => void navigator.clipboard.writeText(pairing.pairingCode)}
                        >
                          <span className="mt-1 font-mono text-xl font-bold tracking-[0.18em]">
                            {pairing.pairingCode}
                          </span>
                        </Button>
                      }
                    />
                    <TooltipContent>{t("mediaHosts.pairing.copyCode")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("mediaHosts.pairing.codeCopyHint")}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => setPairing(null)}
            >
              {t("mediaHosts.pairing.close")}
            </Button>
          </div>
        )}

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
              <HostCard
                key={host.id}
                host={host}
                busy={
                  (renameMutation.isPending && renameMutation.variables?.hostId === host.id) ||
                  (revokeMutation.isPending && revokeMutation.variables === host.id) ||
                  (deleteMutation.isPending && deleteMutation.variables === host.id)
                }
                onRename={(hostId, name) => renameMutation.mutateAsync({ hostId, name })}
                onRevoke={(hostId) => revokeMutation.mutateAsync(hostId)}
                onDelete={(hostId) => deleteMutation.mutateAsync(hostId)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
