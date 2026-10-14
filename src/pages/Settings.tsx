import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import Header from "@/components/Header"
import { t } from "@/i18n"

import AudioDeviceSettings from "@/components/settings/AudioDeviceSettings"
import LineMappingSettings from "@/components/settings/LineMappingSettings"
import StartupSettings from "@/components/settings/StartupSettings"
import LoggingSettings from "@/components/settings/LoggingSettings"
import ThemeSettings from "@/components/settings/ThemeSettings"
import LanguageSwitcher from "@/components/LanguageSwitcher"

import { audioDevicesApi } from "@/api/audioDevices"
import { audioSettingsApi, type AudioSettingsConfig } from "@/api/audioSettings"
import type { Room } from "@/types"
import { toast } from "@/lib/toast"

const AUDIO_DEVICES_QUERY_KEY = ["audio-devices"] as const
const AUDIO_SETTINGS_QUERY_KEY = ["audio-settings"] as const

interface SettingsProps {
  rooms: Room[]
}

function SettingsSection({
  id,
  title,
  description,
  children,
  className = "",
}: {
  id?: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`space-y-2 ${className}`}>
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
  const queryClient = useQueryClient()
  const [selectedDeviceId, setSelectedDeviceId] = useState("")
  const [isSavingAudioConfig, setIsSavingAudioConfig] = useState(false)

  const devicesQuery = useQuery({
    queryKey: AUDIO_DEVICES_QUERY_KEY,
    queryFn: audioDevicesApi.getAll,
  })
  const audioConfigQuery = useQuery({
    queryKey: AUDIO_SETTINGS_QUERY_KEY,
    queryFn: audioSettingsApi.get,
  })
  const savedAudioConfig = audioConfigQuery.data ?? null

  const devices = useMemo(() => {
    const response = devicesQuery.data
    const outputDevices = response?.devices.filter(
      (device) => device.outputCount > 0 && device.outputs.length > 0,
    ) ?? []
    const configuredDevice = savedAudioConfig?.deviceId
      ? response?.devices.find((device) => device.id === savedAudioConfig.deviceId)
      : undefined

    return configuredDevice &&
      !outputDevices.some((device) => device.id === configuredDevice.id)
      ? [configuredDevice, ...outputDevices]
      : outputDevices
  }, [devicesQuery.data, savedAudioConfig])

  const devicesSupported = devicesQuery.data?.supported ?? true
  const devicesError =
    devicesQuery.error instanceof Error
      ? devicesQuery.error.message
      : devicesQuery.data?.error && devicesQuery.data.devices.length === 0
        ? devicesQuery.data.error
        : null
  const selectedDeviceIdForView =
    (selectedDeviceId && devices.some((device) => device.id === selectedDeviceId)
      ? selectedDeviceId
      : null) ??
    (savedAudioConfig?.deviceId &&
    devices.some((device) => device.id === savedAudioConfig.deviceId)
      ? savedAudioConfig.deviceId
      : null) ??
    devices.find((device) => device.status === "online")?.id ??
    devices[0]?.id ??
    ""

  useEffect(() => {
    if (window.location.hash !== "#audio-device-settings") return

    document
      .getElementById("audio-device-settings")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })

    const url = new URL(window.location.href)
    url.hash = ""
    window.history.replaceState(window.history.state, "", url)
  }, [])

  useEffect(() => {
    if (audioConfigQuery.error) {
      toast.error(t("settings.lineMapping.saveFailed"), {
        description:
          audioConfigQuery.error instanceof Error
            ? audioConfigQuery.error.message
            : t("settings.lineMapping.saveFailedDescription"),
      })
    }
  }, [audioConfigQuery.error])

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceIdForView) ?? null,
    [devices, selectedDeviceIdForView],
  )

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
  }

  const handleSaveAudioConfig = async (config: AudioSettingsConfig) => {
    setIsSavingAudioConfig(true)

    try {
      const saved = await audioSettingsApi.save(config)
      queryClient.setQueryData(AUDIO_SETTINGS_QUERY_KEY, saved)
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
            id="audio-device-settings"
            title={t("settings.sections.audio.title")}
            description={t("settings.sections.audio.description")}
          >
            <AudioDeviceSettings
              devices={devices}
              selectedDeviceId={selectedDeviceIdForView}
              onDeviceChange={handleDeviceChange}
              isLoading={devicesQuery.isLoading || audioConfigQuery.isLoading}
              isRefreshing={devicesQuery.isFetching && !devicesQuery.isLoading}
              supported={devicesSupported}
              error={devicesError}
              onRefresh={() => void devicesQuery.refetch()}
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
