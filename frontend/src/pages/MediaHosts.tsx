import { useMemo, useState } from "react"
import { Monitor } from "lucide-react"

import Header from "@/components/Header"
import MediaHostCard from "@/components/media-hosts/MediaHostCard"
import MediaHostsToolbar from "@/components/media-hosts/MediaHostsToolbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useMediaHostMutations } from "@/hooks/useMediaHostMutations"
import { useMediaHostPairing } from "@/hooks/useMediaHostPairing"
import { useMediaHosts } from "@/hooks/useMediaHosts"
import { t } from "@/i18n"
import { filterMediaHosts, getMediaHostSummary } from "@/lib/mediaHosts"
import BackendStatusBanner from "@/components/BackendStatusBanner"
import { BackendConnectionState } from "@/api/client"

interface Props {
  connectionState: BackendConnectionState
  onRetry?: () => void
}

export default function MediaHosts({
  connectionState, 
  onRetry, 
}: Props) {
  const [search, setSearch] = useState("")
  const { data = [], isLoading, isFetching, error, refetch } = useMediaHosts()
  const backendUnavailable = connectionState !== "online"
  const controlsBlocked = backendUnavailable
  const {
    showPairingForm,
    pairingName,
    setPairingName,
    pairingDescription,
    setPairingDescription,
    pairing,
    pairingError,
    pairingBusy,
    createPairing,
    togglePairingForm,
    closePairing,
  } = useMediaHostPairing()
  const { renameHost, revokeHost, deleteHost, isHostBusy } =
    useMediaHostMutations()

  const hosts = useMemo(
    () => filterMediaHosts(data, search),
    [data, search],
  )
  const summary = getMediaHostSummary(data)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title={t("pages.mediaHosts.title")}
        subtitle={t("pages.mediaHosts.subtitle")}
      />

      <BackendStatusBanner
        connectionState={connectionState}
        onRetry={() => { void onRetry?.() }}
      />

      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {t("mediaHosts.pairing.title")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("mediaHosts.pairing.description")}
            </p>
          </div>
          <Button
            onClick={togglePairingForm}
            disabled={controlsBlocked}
          >
            {t("mediaHosts.pairing.addAgent")}
          </Button>
        </div>

        {showPairingForm && !controlsBlocked && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void createPairing()
            }}
            className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <label className="grid gap-1.5 text-xs font-medium">
              {t("mediaHosts.pairing.hostName")}
              <Input
                autoFocus
                required
                maxLength={200}
                value={pairingName}
                disabled={controlsBlocked}
                onChange={(event) => setPairingName(event.target.value)}
                placeholder={t("mediaHosts.pairing.hostNamePlaceholder")}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium">
              {t("mediaHosts.pairing.hostDescription")}
              <Input
                maxLength={1000}
                value={pairingDescription}
                disabled={controlsBlocked}
                onChange={(event) => setPairingDescription(event.target.value)}
                placeholder={t("mediaHosts.pairing.descriptionPlaceholder")}
              />
            </label>
            <Button
              type="submit"
              disabled={pairingBusy || !pairingName.trim() || controlsBlocked}
            >
              {pairingBusy
                ? t("mediaHosts.pairing.creating")
                : t("mediaHosts.pairing.createCode")}
            </Button>
            {pairingError && (
              <p className="text-xs text-destructive sm:col-span-3">
                {pairingError}
              </p>
            )}
          </form>
        )}

        {pairing && !controlsBlocked && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div>
              <p className="text-xs font-semibold">
                {t("mediaHosts.pairing.codeTitle")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("mediaHosts.pairing.codeHint")}
              </p>
              <div className="flex items-center pt-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            void navigator.clipboard.writeText(
                              pairing.pairingCode,
                            )
                          }
                        >
                          <span className="mt-1 font-mono text-xl font-bold tracking-[0.18em]">
                            {pairing.pairingCode}
                          </span>
                        </Button>
                      }
                    />
                    <TooltipContent>
                      {t("mediaHosts.pairing.copyCode")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("mediaHosts.pairing.codeCopyHint")}
              </p>
            </div>

            <Button variant="outline" onClick={closePairing} disabled={controlsBlocked}>
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
              {summary.totalHosts}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("mediaHosts.onlineHosts")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.onlineHosts}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("mediaHosts.totalDisplays")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.totalDisplays}
            </p>
          </div>
        </div>

        <MediaHostsToolbar
          search={search}
          onSearchChange={setSearch}
          isFetching={isFetching}
          onRefresh={() => void refetch()}
        />

        {isLoading ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("mediaHosts.loading")}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm font-medium">{t("mediaHosts.loadError")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
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
              {search
                ? t("mediaHosts.noSearchResults")
                : t("mediaHosts.empty")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("mediaHosts.emptyDescription")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {hosts.map((host) => (
              <MediaHostCard
                key={host.id}
                host={host}
                busy={isHostBusy(host.id)}
                onRename={renameHost}
                onRevoke={revokeHost}
                onDelete={deleteHost}
                disabled={controlsBlocked}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
