import type { MediaHost } from "@/api/mediaHosts"
import { t } from "@/i18n"
import { formatLastSeen } from "@/lib/mediaHosts"

export default function MediaHostDetails({ host }: { host: MediaHost }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span>
        {t("mediaHosts.ipAddress")}:{" "}
        <strong className="font-medium text-foreground">
          {host.ipAddress || "—"}
        </strong>
      </span>
      <span>
        {t("mediaHosts.agentVersion")}:{" "}
        <strong className="font-medium text-foreground">
          {host.agentVersion || "—"}
        </strong>
      </span>
      <span>
        {t("mediaHosts.lastSeen")}:{" "}
        <strong className="font-medium text-foreground">
          {formatLastSeen(host.lastSeenAtUtc)}
        </strong>
      </span>
    </div>
  )
}
