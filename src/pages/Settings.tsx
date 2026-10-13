import { useCallback, useEffect, useMemo, useState } from "react"

import Header from "@/components/Header"
import { t } from "@/i18n"

import AudioDeviceSettings from "@/components/settings/AudioDeviceSettings"
import LineMappingSettings from "@/components/settings/LineMappingSettings"
import StartupSettings from "@/components/settings/StartupSettings"
import LoggingSettings from "@/components/settings/LoggingSettings"
import ThemeSettings from "@/components/settings/ThemeSettings"
import LanguageSwitcher from "@/components/LanguageSwitcher"

import { audioDevicesApi, type AudioDevice } from "@/api/audioDevices"
import { audioSettingsApi, type AudioSettingsConfig } from "@/api/audioSettings"
import type { Room } from "@/types"
import { toast } from "@/lib/toast"

interface SettingsProps {
  rooms: Room[]
}

function SettingsSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`space-y-2 ${className}`}>
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

export default function Settings({ rooms }: SettingsProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState("")
  const [savedAudioConfig, setSavedAudioConfig] = useState<AudioSettingsConfig | null>(null)
  const [isSavingAudioConfig, setIsSavingAudioConfig] = useState(false)
  const [isLoadingDevices, setIsLoadingDevices] = useState(true)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [devicesSupported, setDevicesSupported] = useState(true)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  )

  const applyDevicesResponse = useCallback(
    (
      response: Awaited<ReturnType<typeof audioDevicesApi.getAll>>,
      preferredDeviceId?: string | null,
    ) => {
      // Backend intentionally returns the complete Windows audio inventory.
      // Settings only exposes render-capable devices because capture-only
      // endpoints (microphones / microphone arrays) are not useful here.
      const outputDevices = response.devices.filter(
        (device) => device.outputCount > 0 && device.outputs.length > 0,
      )

      // Keep the currently configured device visible even when it is
      // temporarily disconnected. This is important: configuration is
      // persistent, connection state is not.
      const configuredDevice = preferredDeviceId
        ? response.devices.find((device) => device.id === preferredDeviceId)
        : undefined

      const visibleDevices = configuredDevice &&
        !outputDevices.some((device) => device.id === configuredDevice.id)
        ? [configuredDevice, ...outputDevices]
        : outputDevices

      setDevices(visibleDevices)
      setDevicesSupported(response.supported)

      setSelectedDeviceId((current) => {
        if (current && visibleDevices.some((device) => device.id === current)) {
          return current
        }

        if (preferredDeviceId && visibleDevices.some((device) => device.id === preferredDeviceId)) {
          return preferredDeviceId
        }

        return visibleDevices.find((device) => device.status === "online")?.id ?? visibleDevices[0]?.id ?? ""
      })

      setDevicesError(
        response.error && response.devices.length === 0 ? response.error : null,
      )
    },
    [],
  )

  const fetchDevices = async () => {
    setIsLoadingDevices(true)
    setDevicesError(null)

    try {
      const response = await audioDevicesApi.getAll()
      applyDevicesResponse(response, savedAudioConfig?.deviceId)
    } catch (error) {
      setDevices([])
      setSelectedDeviceId("")
      setDevicesError(
        error instanceof Error ? error.message : "Не удалось получить аудиоустройства",
      )
    } finally {
      setIsLoadingDevices(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([audioSettingsApi.get(), audioDevicesApi.getAll()]).then(
      ([configResult, devicesResult]) => {
        if (cancelled) return

        const config =
          configResult.status === "fulfilled"
            ? configResult.value
            : null

        setSavedAudioConfig(config)
        setIsLoadingConfig(false)

        if (configResult.status === "rejected") {
          toast.error(t("settings.lineMapping.saveFailed"), {
            description:
              configResult.reason instanceof Error
                ? configResult.reason.message
                : t("settings.lineMapping.saveFailedDescription"),
          })
        }

        if (devicesResult.status === "fulfilled") {
          applyDevicesResponse(
            devicesResult.value,
            config?.deviceId ?? null,
          )
        } else {
          setDevices([])
          setSelectedDeviceId(config?.deviceId ?? "")
          setDevicesError(
            devicesResult.reason instanceof Error
              ? devicesResult.reason.message
              : "Не удалось получить аудиоустройства",
          )
        }

        setIsLoadingDevices(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [applyDevicesResponse])

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
  }

  const handleSaveAudioConfig = async (config: AudioSettingsConfig) => {
    setIsSavingAudioConfig(true)

    try {
      const saved = await audioSettingsApi.save(config)
      setSavedAudioConfig(saved)
      setSelectedDeviceId(saved.deviceId ?? "")
      toast.success(t("settings.lineMapping.saveSuccess"))
    } catch (error) {
      toast.error(t("settings.lineMapping.saveFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("settings.lineMapping.saveFailedDescription"),
      })
      throw error
    } finally {
      setIsSavingAudioConfig(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title={t("pages.settings.title")}
        subtitle={t("pages.settings.subtitle")}
      />

      <main className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-6xl space-y-6">
          <SettingsSection
            title={t("settings.sections.general.title")}
            description={t("settings.sections.general.description")}
          >
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <LanguageSwitcher />
              <ThemeSettings />
            </div>
          </SettingsSection>

          <SettingsSection
            title={t("settings.sections.application.title")}
            description={t("settings.sections.application.description")}
          >
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <StartupSettings />
              <LoggingSettings />
            </div>
          </SettingsSection>

          <SettingsSection
            title={t("settings.sections.audio.title")}
            description={t("settings.sections.audio.description")}
          >
            <AudioDeviceSettings
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              onDeviceChange={handleDeviceChange}
              isLoading={isLoadingDevices || isLoadingConfig}
              supported={devicesSupported}
              error={devicesError}
              onRefresh={() => void fetchDevices()}
            />
          </SettingsSection>

          <SettingsSection
            title={t("settings.sections.outputMapping.title")}
            description={t("settings.sections.outputMapping.description")}
          >
            <LineMappingSettings
              key={JSON.stringify({
                deviceId: selectedDevice?.id ?? null,
                outputIds: selectedDevice?.outputs.map((output) => output.id) ?? [],
                roomIds: rooms.map((room) => room.id),
                savedConfig: savedAudioConfig,
              })}
              rooms={rooms}
              selectedDevice={selectedDevice}
              savedConfig={savedAudioConfig}
              isSaving={isSavingAudioConfig}
              onSave={handleSaveAudioConfig}
            />
          </SettingsSection>
        </div>
      </main>
    </div>
  )
}
