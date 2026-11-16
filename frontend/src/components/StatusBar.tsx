import { Radio } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { t } from "@/i18n"
import type { SystemStatus } from "../types"
import type { BackendConnectionState } from "@/api/client"
import { Button } from "./ui/button"

interface Props {
  status: SystemStatus
  connectionState: BackendConnectionState
  onNavigate: (page: string) => void
}

export default function StatusBar({ status, connectionState, onNavigate }: Props) {
  const stateText =
    connectionState === "offline"
      ? "BACKEND OFFLINE"
      : connectionState === "reconnecting"
        ? "BACKEND RECONNECTING"
        : status.state === "ready"
        ? t("common.online")
        : status.state === "degraded"
          ? "DEGRADED"
          : status.state === "initializing"
            ? "INIT"
            : status.state === "unconfigured"
              ? "UNCONFIGURED"
              : status.state === "disconnected"
                ? "DEVICE OFFLINE"
                : "ERROR"

  const stateClass =
    connectionState === "offline" ||
    (connectionState === "online" &&
      (status.state === "error" || status.state === "disconnected"))
      ? "text-red-400"
      : connectionState === "reconnecting"
        ? "text-amber-400"
        : status.state === "ready"
          ? "text-emerald-400"
          : "text-amber-400"

  const dotClass =
    connectionState === "offline" ||
    (connectionState === "online" &&
      (status.state === "error" || status.state === "disconnected"))
      ? "bg-red-400"
      : connectionState === "reconnecting"
        ? "bg-amber-400"
        : status.state === "ready"
          ? "bg-emerald-400"
          : "bg-amber-400"

  return (
    <footer className="flex h-8 shrink-0 items-center border-t bg-[#1d2b3d] px-4 text-[11px] text-[#9db0c8]">
      <label>
        {t("statusBar.audioDevice")}: <strong className="text-[#d7e2ef]">{status.device ?? "—"}</strong>
      </label>
      <Separator orientation="vertical" className="mx-3 h-3.5 bg-white/15" />
      <label>
        {t("statusBar.backend")}: <strong className={connectionState === "online" ? "text-emerald-400" : connectionState === "offline" ? "text-red-400" : "text-amber-400"}>{connectionState.toUpperCase()}</strong>
      </label>
      <Separator orientation="vertical" className="mx-3 h-3.5 bg-white/15" />

      <label className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${dotClass}`} />
        <strong className={stateClass}>{stateText}</strong>
      </label>

      <Separator orientation="vertical" className="mx-3 h-3.5 bg-white/15" />
      <label>
        {t("statusBar.outputs")}: <strong className="text-[#d7e2ef]">{status.availableOutputs} / {status.outputs}</strong>
      </label>

      {status.sampleRate && (
        <>
          <Separator orientation="vertical" className="mx-3 h-3.5 bg-white/15" />
          <label>
            {t("statusBar.frequency")}: <strong className="text-[#d7e2ef]">{status.sampleRate / 1000} {t("units.kilohertz")}</strong>
          </label>
        </>
      )}

      {status.bufferSize && (
        <>
          <Separator orientation="vertical" className="mx-3 h-3.5 bg-white/15" />
          <label>
            {t("statusBar.buffer")}: <strong className="text-[#d7e2ef]">{status.bufferSize} {t("statusBar.samples")}</strong>
          </label>
        </>
      )}

      <div className="flex-1" />

      <Button
        type="button"
        variant="ghost"
        className="justify-start gap-2.5"
        onClick={() => {
          window.location.hash = "audio-device-settings"
          onNavigate("settings")
        }}
      >
        <Radio className="size-4" />
        {t("statusBar.audioSettings")}
      </Button>
    </footer>
  )
}
