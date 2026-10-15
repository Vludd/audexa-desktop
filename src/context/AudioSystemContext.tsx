import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { audioDevicesApi, type AudioDevice } from "@/api/audioDevices"
import { isBackendOnline } from "@/api/client"
import { audioSystemApi } from "@/api/audioSystem"
import {
  audioSettingsApi,
  type AudioSettingsConfig,
} from "@/api/audioSettings"
import type { SystemStatus } from "@/types/system"
import {
  AudioSystemContext,
  type AudioSystemContextValue,
} from "./audioSystemContextValue"

const EMPTY_STATUS: SystemStatus = {
  state: "initializing",
  backend: "unknown",
  device: null,
  deviceId: null,
  online: false,
  outputs: 0,
  availableOutputs: 0,
  mappedOutputs: 0,
  mappings: 0,
  sampleRate: null,
  bufferSize: null,
  engine: "unknown",
  error: null,
  lastUpdated: null,
}

export function AudioSystemProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [supported, setSupported] = useState(true)
  const [config, setConfig] = useState<AudioSettingsConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(EMPTY_STATUS)
  const refreshInFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true

    try {
      const [nextConfig, nextDevices, nextStatus] = await Promise.all([
        audioSettingsApi.get(),
        audioDevicesApi.getAll(),
        audioSystemApi.getStatus(),
      ])

      setConfig(nextConfig)
      setDevices(nextDevices.devices)
      setSupported(nextDevices.supported)
      setSystemStatus(nextStatus)
      setError(
        nextDevices.error && nextDevices.devices.length === 0
          ? nextDevices.error
          : null,
      )
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : "Не удалось загрузить аудиосистему"
      setError(message)
      setSystemStatus({ ...EMPTY_STATUS, state: "error", backend: isBackendOnline() ? "online" : "offline", error: message, lastUpdated: null })
    } finally {
      refreshInFlight.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      audioSettingsApi.get(),
      audioDevicesApi.getAll(),
      audioSystemApi.getStatus(),
    ])
      .then(([nextConfig, nextDevices, nextStatus]) => {
        if (cancelled) return
        setConfig(nextConfig)
        setDevices(nextDevices.devices)
        setSupported(nextDevices.supported)
        setSystemStatus(nextStatus)
          setError(
          nextDevices.error && nextDevices.devices.length === 0
            ? nextDevices.error
            : null,
        )
      })
      .catch((requestError) => {
        if (cancelled) return
        const message = requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить аудиосистему"
        setError(message)
        setSystemStatus({ ...EMPTY_STATUS, state: "error", backend: isBackendOnline() ? "online" : "offline", error: message, lastUpdated: null })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isLoading) return

    const timer = window.setInterval(() => {
      void refresh()
    }, 5000)

    return () => window.clearInterval(timer)
  }, [isLoading, refresh])

  const saveConfig = useCallback(async (nextConfig: AudioSettingsConfig) => {
    setIsSaving(true)
    setError(null)

    try {
      const saved = await audioSettingsApi.save(nextConfig)
      setConfig(saved)
      try {
        const nextStatus = await audioSystemApi.getStatus()
        setSystemStatus(nextStatus)
      } catch {
        // Keep the save result, but do not fabricate a refreshed system status.
      }
      return saved
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Не удалось сохранить настройки аудиосистемы"
      setError(message)
      throw requestError
    } finally {
      setIsSaving(false)
    }
  }, [])

  const selectDevice = useCallback(
    async (deviceId: string) => {
      const sameDevice = Boolean(deviceId) && deviceId === config?.deviceId
      const nextConfig: AudioSettingsConfig = {
        version: 1,
        deviceId: deviceId || null,
        // Output IDs are device-specific. Never carry mappings from a previous
        // device into a newly selected device.
        mappings: sameDevice ? (config?.mappings ?? []) : [],
        translationOutputId: sameDevice ? (config?.translationOutputId ?? null) : null,
      }

      return saveConfig(nextConfig)
    },
    [config, saveConfig],
  )

  const selectedDevice = config?.deviceId
    ? devices.find((device) => device.id === config.deviceId) ?? null
    : null

  const status = useMemo(
    () => isLoading ? EMPTY_STATUS : systemStatus,
    [isLoading, systemStatus],
  )

  const value = useMemo<AudioSystemContextValue>(
    () => ({
      devices,
      supported,
      config,
      selectedDevice,
      status,
      isLoading,
      isSaving,
      error,
      refresh,
      saveConfig,
      selectDevice,
    }),
    [
      devices,
      supported,
      config,
      selectedDevice,
      status,
      isLoading,
      isSaving,
      error,
      refresh,
      saveConfig,
      selectDevice,
    ],
  )

  return (
    <AudioSystemContext.Provider value={value}>
      {children}
    </AudioSystemContext.Provider>
  )
}
