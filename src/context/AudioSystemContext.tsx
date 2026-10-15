import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useQuery } from "@tanstack/react-query"
import { audioDevicesApi, type AudioDevice } from "@/api/audioDevices"
import { playbackApi } from "@/api/playback"
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

function calculateStatus(
  config: AudioSettingsConfig | null,
  devices: AudioDevice[],
  requestError: string | null,
  playbackStatus: string | undefined,
  playbackError: boolean,
  lastUpdated: string | null,
): SystemStatus {
  const engine: SystemStatus["engine"] = playbackError
    ? "error"
    : playbackStatus === undefined
      ? "unknown"
      : playbackStatus === "starting"
      ? "starting"
      : playbackStatus === "playing" || playbackStatus === "paused" || playbackStatus === "waiting"
        ? "running"
        : playbackStatus === "error"
          ? "error"
          : "stopped"
  if (requestError) {
    return {
      ...EMPTY_STATUS,
      state: "error",
      engine,
      error: requestError,
      lastUpdated,
    }
  }

  if (!config?.deviceId) {
    return {
      ...EMPTY_STATUS,
      state: "unconfigured",
      engine,
      lastUpdated,
    }
  }

  const device = devices.find((item) => item.id === config.deviceId) ?? null

  if (!device || device.status === "offline") {
    return {
      ...EMPTY_STATUS,
      state: "disconnected",
      device: device?.name ?? "Неизвестное аудиоустройство",
      deviceId: config.deviceId,
      outputs: device?.outputCount ?? 0,
      availableOutputs: 0,
      mappings: config.mappings.length,
      mappedOutputs: 0,
      engine,
      lastUpdated,
    }
  }

  const outputIds = new Set(device.outputs.map((output) => output.id))
  const validMappings = config.mappings.filter(
    (mapping) => mapping.outputId && outputIds.has(mapping.outputId),
  )

  const duplicateOutputs = new Set<string>()
  const seenOutputs = new Set<string>()

  for (const mapping of config.mappings) {
    if (!mapping.outputId || !outputIds.has(mapping.outputId)) continue
    if (seenOutputs.has(mapping.outputId)) {
      duplicateOutputs.add(mapping.outputId)
    }
    seenOutputs.add(mapping.outputId)
  }

  const mappingHealthy =
    config.mappings.length > 0 &&
    validMappings.length === config.mappings.length &&
    duplicateOutputs.size === 0

  const systemHealthy =
    mappingHealthy && engine !== "error" && engine !== "unknown"

  return {
    state: systemHealthy ? "ready" : "degraded",
    device: device.name,
    deviceId: device.id,
    online: true,
    outputs: device.outputCount,
    availableOutputs: device.outputs.length,
    mappedOutputs: validMappings.length,
    mappings: config.mappings.length,
    sampleRate: device.sampleRate,
    bufferSize: device.bufferSize,
    engine,
    error: !mappingHealthy
      ? "Сопоставления выходов отсутствуют или требуют проверки"
      : engine === "error"
        ? "Не удалось получить достоверное состояние движка воспроизведения"
        : engine === "unknown"
          ? "Состояние движка воспроизведения ещё не подтверждено"
          : null,
    lastUpdated,
  }
}

export function AudioSystemProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [supported, setSupported] = useState(true)
  const [config, setConfig] = useState<AudioSettingsConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const playbackQuery = useQuery({
    queryKey: ["playback"],
    queryFn: playbackApi.getState,
    refetchInterval: 1000,
    staleTime: 0,
  })
  const refreshInFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true

    try {
      const [nextConfig, nextDevices] = await Promise.all([
        audioSettingsApi.get(),
        audioDevicesApi.getAll(),
      ])

      setConfig(nextConfig)
      setDevices(nextDevices.devices)
      setSupported(nextDevices.supported)
      setLastUpdated(new Date().toISOString())
      setError(
        nextDevices.error && nextDevices.devices.length === 0
          ? nextDevices.error
          : null,
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить аудиосистему",
      )
    } finally {
      refreshInFlight.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      audioSettingsApi.get(),
      audioDevicesApi.getAll(),
    ])
      .then(([nextConfig, nextDevices]) => {
        if (cancelled) return
        setConfig(nextConfig)
        setDevices(nextDevices.devices)
        setSupported(nextDevices.supported)
        setLastUpdated(new Date().toISOString())
        setError(
          nextDevices.error && nextDevices.devices.length === 0
            ? nextDevices.error
            : null,
        )
      })
      .catch((requestError) => {
        if (cancelled) return
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Не удалось загрузить аудиосистему",
        )
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
      const nextConfig: AudioSettingsConfig = {
        version: 1,
        deviceId: deviceId || null,
        mappings: config?.mappings ?? [],
        translationOutputId: config?.translationOutputId ?? null,
      }

      return saveConfig(nextConfig)
    },
    [config, saveConfig],
  )

  const selectedDevice = config?.deviceId
    ? devices.find((device) => device.id === config.deviceId) ?? null
    : null

  const status = useMemo(
    () =>
      isLoading
        ? EMPTY_STATUS
        : calculateStatus(
            config,
            devices,
            error,
            playbackQuery.data?.status,
            Boolean(playbackQuery.error),
            lastUpdated,
          ),
    [config, devices, error, isLoading, playbackQuery.data?.status, playbackQuery.error, lastUpdated],
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
