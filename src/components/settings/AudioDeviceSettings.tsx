import { useMemo } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react"

import type { AudioDevice } from "@/api/audioDevices"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { t } from "@/i18n"
import OutputDiagnostics from "./OutputDiagnostics"

interface AudioDeviceSettingsProps {
  devices: AudioDevice[]
  selectedDeviceId: string
  onDeviceChange: (deviceId: string) => void
  isLoading: boolean
  isRefreshing?: boolean
  supported: boolean
  error: string | null
  onRefresh: () => void
}

export default function AudioDeviceSettings({
  devices,
  selectedDeviceId,
  onDeviceChange,
  isLoading,
  isRefreshing = false,
  supported,
  error,
  onRefresh,
}: AudioDeviceSettingsProps) {
  const selectedDevice = useMemo(
    () =>
      devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {t("settings.audioDevice.title")}
        </CardTitle>

        <CardDescription className="text-xs">
          {t("settings.audioDevice.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label>{t("settings.audioDevice.device")}</Label>

            <Select
              value={selectedDeviceId}
              onValueChange={(value) =>
                onDeviceChange(value ?? "")
              }
              disabled={
                isLoading ||
                !supported ||
                devices.length === 0
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    isLoading
                      ? t("settings.audioDevice.loading")
                      : t("settings.audioDevice.notFound")
                  }
                >
                  {selectedDevice?.name ??
                    (isLoading
                      ? t("settings.audioDevice.loading")
                      : t("settings.audioDevice.notFound"))}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                {devices.map((device) => (
                  <SelectItem
                    key={device.id}
                    value={device.id}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate">
                        {device.name}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {device.type}
                      </span>

                      {device.status === "offline" && (
                        <span className="text-xs text-muted-foreground">
                          · {t("settings.audioDevice.offline")}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {t("settings.audioDevice.refresh")}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />

            <div>
              <div className="font-medium">
                {t("settings.audioDevice.loadError")}
              </div>

              <div className="mt-0.5 text-xs text-muted-foreground">
                {error}
              </div>
            </div>
          </div>
        )}

        {!isLoading &&
          supported &&
          devices.length === 0 &&
          !error && (
            <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {t("settings.audioDevice.noneFound")}
            </div>
          )}

        {!supported && (
          <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            {t("settings.audioDevice.unsupported")}
          </div>
        )}

        {selectedDevice?.status === "offline" && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <div className="font-medium text-destructive">
                {t("settings.audioDevice.configuredDeviceOffline")}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t("settings.audioDevice.configuredDeviceOfflineDescription")}
              </div>
            </div>
          </div>
        )}

        {selectedDevice && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [
                  t("settings.audioDevice.type"),
                  selectedDevice.type,
                ],
                [
                  t("settings.audioDevice.outputs"),
                  selectedDevice.outputCount,
                ],
                [
                  t("settings.audioDevice.inputs"),
                  selectedDevice.inputCount,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border bg-muted/20 px-3 py-2"
                >
                  <div className="text-xs text-muted-foreground">
                    {label}
                  </div>

                  <div className="mt-1 text-sm font-medium">
                    {value}
                  </div>
                </div>
              ))}

              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  {t("settings.audioDevice.status")}
                </div>

                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  {selectedDevice.status === "online" ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      {t("settings.audioDevice.online")}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-3.5 text-destructive" />
                      {t("settings.audioDevice.offline")}
                    </>
                  )}
                </div>
              </div>
            </div>

            {selectedDevice.status === "online" ? (
              <OutputDiagnostics device={selectedDevice} />
            ) : (
              <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                {t("settings.audioDevice.outputDiagnosticsUnavailable")}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}