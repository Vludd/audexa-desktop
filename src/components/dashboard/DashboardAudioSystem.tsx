import { Badge } from "@/components/ui/badge"
import type { SystemStatus } from "@/types"
import { t } from "@/i18n"

interface DashboardAudioSystemProps {
  system: SystemStatus
}

const stateLabel: Record<SystemStatus["state"], string> = {
  unconfigured: "Не настроено",
  initializing: "Инициализация",
  ready: "ONLINE",
  degraded: "DEGRADED",
  disconnected: "DISCONNECTED",
  error: "ERROR",
}

export default function DashboardAudioSystem({ system }: DashboardAudioSystemProps) {
  const healthy = system.state === "ready"
  const degraded = system.state === "degraded"

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t("dashboard.audioSystem.title")}</h3>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3.5">
        <InfoRow label={t("dashboard.audioSystem.backend")} value={system.backend.toUpperCase()} />

        <InfoRow label={t("dashboard.audioSystem.device")} value={system.device ?? "—"} />

        <InfoRow
          label={t("dashboard.audioSystem.status")}
          value={
            <Badge variant={healthy ? "success" : degraded ? "warning" : "destructive"}>
              {stateLabel[system.state]}
            </Badge>
          }
        />

        <InfoRow
          label="Audio Engine"
          value={system.engine.toUpperCase()}
        />

        <InfoRow
          label={t("dashboard.audioSystem.outputs")}
          value={`${system.availableOutputs} / ${system.outputs}`}
        />

        <InfoRow
          label="Mapping"
          value={`${system.mappedOutputs} / ${system.mappings}`}
        />

        <InfoRow
          label={t("dashboard.audioSystem.frequency")}
          value={
            system.sampleRate
              ? `${system.sampleRate / 1000} ${t("units.kilohertz")}`
              : "—"
          }
        />

        <InfoRow
          label={t("dashboard.audioSystem.buffer")}
          value={system.bufferSize ? `${system.bufferSize} ${t("dashboard.audioSystem.samples")}` : "—"}
        />
      </div>

      {(system.error || system.lastUpdated) && (
        <div className="border-t px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          {system.error}
          {system.lastUpdated && (
            <div className="mt-1 text-muted-foreground">
              Обновлено: {new Date(system.lastUpdated).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  )
}
