import { Settings } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { t } from "@/i18n"
import type { SystemStatus } from "../types"

interface Props {
  status: SystemStatus
  onOpenSettings?: () => void
}

export default function StatusBar({ status, onOpenSettings }: Props) {
  const stateText =
    status.state === "ready"
      ? t("common.online")
      : status.state === "degraded"
        ? "DEGRADED"
        : status.state === "initializing"
          ? "INIT"
          : t("common.offline")

  const stateClass =
    status.state === "ready"
      ? "text-emerald-400"
      : status.state === "degraded"
        ? "text-amber-400"
        : "text-red-400"

  const dotClass =
    status.state === "ready"
      ? "bg-emerald-400"
      : status.state === "degraded"
        ? "bg-amber-400"
        : "bg-red-400"

  return (
    <footer className="flex h-8 shrink-0 items-center border-t bg-[#1d2b3d] px-4 text-[11px] text-[#9db0c8]">
      <span>
        {t("statusBar.audioDevice")}: <strong className="text-[#d7e2ef]">{status.device ?? "—"}</strong>
      </span>
      <Separator orientation="vertical" className="mx-3 h-3.5 bg-white/15" />

      <span className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${dotClass}`} />
        <strong className={stateClass}>{stateText}</strong>
      </span>

      <Separator orientation="vertical" className="mx-3 h-3.5 bg-white/15" />
      <span>
        {t("statusBar.outputs")}: <strong className="text-[#d7e2ef]">{status.availableOutputs} / {status.outputs}</strong>
      </span>

      {status.sampleRate && (
        <>
          <Separator orientation="vertical" className="mx-3 h-3.5 bg-white/15" />
          <span>
            {t("statusBar.frequency")}: <strong className="text-[#d7e2ef]">{status.sampleRate / 1000} {t("units.kilohertz")}</strong>
          </span>
        </>
      )}

      {status.bufferSize && (
        <>
          <Separator orientation="vertical" className="mx-3 h-3.5 bg-white/15" />
          <span>
            {t("statusBar.buffer")}: <strong className="text-[#d7e2ef]">{status.bufferSize} {t("statusBar.samples")}</strong>
          </span>
        </>
      )}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenSettings}
        className="flex h-6 items-center gap-1.5 rounded px-2 text-[11px] text-[#9db0c8] transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Settings className="size-3" />
        {t("statusBar.audioSettings")}
      </button>
    </footer>
  )
}
