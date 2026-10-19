import type { BackendConnectionState } from "@/api/client"
import { t } from "@/i18n"
import { AlertTriangle, RotateCcw, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  connectionState: BackendConnectionState
  onRetry: () => void
}

export default function BackendStatusBanner({
  connectionState,
  onRetry,
}: Props) {
  if (connectionState === "online") return null

  const isOffline = connectionState === "offline"

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-3 my-2 flex shrink-0 items-center gap-3 rounded-lg border border-border/80 bg-card px-3 py-2.5 shadow-sm sm:mx-4"
    >
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
          isOffline
            ? "bg-destructive/10 text-destructive"
            : "bg-amber-500/10 text-amber-500"
        }`}
      >
        {isOffline ? (
          <WifiOff className="size-[18px]" />
        ) : (
          <AlertTriangle className="size-[18px]" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {isOffline
              ? t("common.backendUnavailable")
              : t("common.backendReconnecting")}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              isOffline
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-500/10 text-amber-500"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isOffline
                  ? "bg-destructive"
                  : "animate-pulse bg-amber-500"
              }`}
            />
            {isOffline ? "Offline" : "Reconnecting"}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("common.backendControlsBlocked")}
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="h-8 shrink-0 gap-2 px-2.5 text-xs sm:px-3"
      >
        <RotateCcw className="size-3.5" />
        <span className="hidden sm:inline">
          {t("common.retryLoading")}
        </span>
        <span className="sm:hidden">Retry</span>
      </Button>
    </div>
  )
}