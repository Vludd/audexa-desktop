import { MonitorCheck, MonitorOff } from "lucide-react"

import type { DisplayDevice } from "@/api/mediaHosts"
import DisplayPlaybackControls from "@/components/media-hosts/DisplayPlaybackControls"
import { t } from "@/i18n"

interface Props {
  hostId: string
  display: DisplayDevice
  disabled: boolean
}

export default function DisplayCard({ hostId, display, disabled }: Props) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
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
          {display.refreshRate > 0 ? ` · ${display.refreshRate} Hz` : ""}
        </p>
      </div>
      {display.isPrimary && (
        <span className="shrink-0 rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
          {t("mediaHosts.primary")}
        </span>
      )}
      <div className="w-full basis-full">
        <DisplayPlaybackControls
          hostId={hostId}
          displayKey={display.displayKey}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
