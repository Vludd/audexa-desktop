import { useMemo, useState } from "react"
import { Check, CircleAlert, LoaderCircle, Play, Square } from "lucide-react"

import type { AudioDevice } from "@/api/audioDevices"
import { audioDiagnosticsApi, type AudioTestMode } from "@/api/audioDiagnostics"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { t, type TranslationKey } from "@/i18n"
import { toast } from "@/lib/toast"

type TestStatus = "idle" | "testing" | "success" | "error"

const DURATION_LABELS: Record<string, TranslationKey> = {
  "500": "settings.lineMapping.diagnosticsDuration500",
  "800": "settings.lineMapping.diagnosticsDuration800",
  "1000": "settings.lineMapping.diagnosticsDuration1000",
}

const VOLUME_LABELS: Record<string, TranslationKey> = {
  "0.1": "settings.lineMapping.diagnosticsVolumeMinus20",
  "0.25": "settings.lineMapping.diagnosticsVolumeMinus12",
  "0.5": "settings.lineMapping.diagnosticsVolumeMinus6",
}

function formatDuration(value: string) {
  const label = DURATION_LABELS[value]

  return label
    ? t(label, { unit: t("units.second") })
    : `${Number(value) / 1000} ${t("units.second")}`
}

function formatVolume(value: string) {
  const label = VOLUME_LABELS[value]

  return label
    ? t(label, { unit: t("units.decibel") })
    : value
}

interface OutputDiagnosticsProps {
  device: AudioDevice
}

export default function OutputDiagnostics({
  device,
}: OutputDiagnosticsProps) {
  const [mode, setMode] = useState<AudioTestMode>("voice")
  const [durationMs, setDurationMs] = useState("800")
  const [volume, setVolume] = useState("0.25")
  const [statuses, setStatuses] = useState<Record<string, TestStatus>>({})
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null)
  const [runningAll, setRunningAll] = useState(false)

  const outputs = useMemo(
    () => [...new Map(device.outputs.map((output) => [output.id, output])).values()],
    [device.outputs],
  )

  const testRequest = {
    deviceId: device.id,
    mode,
    durationMs: Number(durationMs),
    volume: Number(volume),
  }

  const testOutput = async (outputId: string) => {
    setActiveOutputId(outputId)
    setStatuses((current) => ({
      ...current,
      [outputId]: "testing",
    }))

    try {
      const result = await audioDiagnosticsApi.testOutput({
        ...testRequest,
        outputId,
      })

      setStatuses((current) => ({
        ...current,
        [outputId]: result.ok ? "success" : "error",
      }))

      if (!result.ok) {
        toast.error(t("settings.lineMapping.diagnosticsTestFailed"), {
          description: result.message,
        })
      }
    } catch (error) {
      setStatuses((current) => ({
        ...current,
        [outputId]: "error",
      }))

      toast.error(t("settings.lineMapping.diagnosticsTestFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("settings.lineMapping.diagnosticsBackendRequired"),
      })
    } finally {
      setActiveOutputId(null)
    }
  }

  const testAll = async () => {
    if (outputs.length === 0) return

    setRunningAll(true)

    setStatuses(
      Object.fromEntries(
        outputs.map((output) => [output.id, "testing"]),
      ) as Record<string, TestStatus>,
    )

    try {
      const results = await audioDiagnosticsApi.testOutputs({
        ...testRequest,
        outputIds: outputs.map((output) => output.id),
      })

      setStatuses((current) => {
        const next = { ...current }

        results.forEach((result) => {
          next[result.outputId] = result.ok ? "success" : "error"
        })

        return next
      })
    } catch (error) {
      setStatuses(
        Object.fromEntries(
          outputs.map((output) => [output.id, "error"]),
        ) as Record<string, TestStatus>,
      )

      toast.error(t("settings.lineMapping.diagnosticsTestFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("settings.lineMapping.diagnosticsBackendRequired"),
      })
    } finally {
      setRunningAll(false)
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/10 p-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">
          {t("settings.lineMapping.diagnosticsTitle")}
        </div>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("settings.lineMapping.diagnosticsDescription")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">
              {t("settings.lineMapping.diagnosticsMode")}
          </Label>

          <Select
            value={mode}
            onValueChange={(value) =>
              setMode(value as AudioTestMode)
            }
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue>
                {mode === "voice"
                  ? t("settings.lineMapping.diagnosticsVoiceShort")
                  : t("settings.lineMapping.diagnosticsTone")}
              </SelectValue>
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="voice">
                {t("settings.lineMapping.diagnosticsVoiceShort")}
              </SelectItem>

              <SelectItem value="tone">
                {t("settings.lineMapping.diagnosticsTone")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            {t("settings.lineMapping.diagnosticsDuration")}
          </Label>

          <Select
            value={durationMs}
            onValueChange={(value) => setDurationMs(value ?? "")}
            disabled={mode === "voice"}
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue>
                {formatDuration(durationMs)}
              </SelectValue>
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="500">{formatDuration("500")}</SelectItem>
              <SelectItem value="800">{formatDuration("800")}</SelectItem>
              <SelectItem value="1000">{formatDuration("1000")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            {t("settings.lineMapping.diagnosticsVolume")}
          </Label>

          <Select
            value={volume}
            onValueChange={(value) => setVolume(value ?? "")}
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue>
                {formatVolume(volume)}
              </SelectValue>
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="0.1">{formatVolume("0.1")}</SelectItem>
              <SelectItem value="0.25">{formatVolume("0.25")}</SelectItem>
              <SelectItem value="0.5">{formatVolume("0.5")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-8 self-end mb-1.5"
          disabled={runningAll || outputs.length === 0}
          onClick={() => void testAll()}
        >
          <Play className="size-3.5" />
          {t("settings.lineMapping.diagnosticsTestAll")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-[48px_minmax(0,1fr)_140px_64px] items-center gap-3 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>#</span>
          <span>{t("settings.lineMapping.output")}</span>
          <span>{t("settings.lineMapping.status")}</span>
          <span className="text-right">
            {t("settings.lineMapping.diagnosticsTest")}
          </span>
        </div>

        {outputs.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t("settings.audioDevice.outputChannelsUnavailable")}
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            {outputs.map((output) => {
              const status = statuses[output.id] ?? "idle"

              return (
                <div
                  key={output.id}
                  className="grid grid-cols-[48px_minmax(0,1fr)_140px_64px] items-center gap-3 border-t px-3 py-2"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(output.index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {output.name}
                    </div>
                  </div>

                  <div>
                    {status === "idle" && (
                      <span className="text-xs text-muted-foreground">
                        —
                      </span>
                    )}

                    {status === "testing" && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px]"
                      >
                        <LoaderCircle className="size-3 animate-spin" />
                        {t("settings.lineMapping.diagnosticsTesting")}
                      </Badge>
                    )}

                    {status === "success" && (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[10px]"
                      >
                        <Check className="size-3" />
                        {t(
                          "settings.lineMapping.diagnosticsSignalSent",
                        )}
                      </Badge>
                    )}

                    {status === "error" && (
                      <Badge
                        variant="destructive"
                        className="gap-1 text-[10px]"
                      >
                        <CircleAlert className="size-3" />
                        {t("settings.lineMapping.diagnosticsFailed")}
                      </Badge>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={
                        runningAll || activeOutputId !== null
                      }
                      onClick={() => void testOutput(output.id)}
                      title={t(
                        "settings.lineMapping.testNamedOutput",
                        {
                          name: output.name,
                        },
                      )}
                      aria-label={t(
                        "settings.lineMapping.testNamedOutput",
                        {
                          name: output.name,
                        },
                      )}
                    >
                      {status === "testing" ? (
                        <Square className="size-3" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t("settings.lineMapping.diagnosticsSignalNotice")}
      </p>
    </div>
  )
}