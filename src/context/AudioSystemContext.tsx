import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { audioDevicesApi, type AudioDevice } from "@/api/audioDevices"
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
  engine: "stopped",
  error: null,
}

function calculateStatus(
  config: AudioSettingsConfig | null,
  devices: AudioDevice[],
  requestError: string | null,
): SystemStatus {
  if (requestError) {
    return {
      ...EMPTY_STATUS,
      state: "error",
      error: requestError,
    }
  }

  if (!config?.deviceId) {
    return {
      ...EMPTY_STATUS,
      state: "unconfigured",
      engine: "stopped",
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
      engine: "stopped",
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
    validMappings.length === config.mappings.length &&
    duplicateOutputs.size === 0

  return {
    state: mappingHealthy ? "ready" : "degraded",
    device: device.name,
    deviceId: device.id,
    online: true,
    outputs: device.outputCount,
    availableOutputs: device.outputs.length,
    mappedOutputs: validMappings.length,
    mappings: config.mappings.length,
    sampleRate: device.sampleRate,
    bufferSize: device.bufferSize,
    engine: mappingHealthy ? "running" : "error",
    error: mappingHealthy
      ? null
      : "Часть сопоставлений выходов требует проверки",
  }
}

export function AudioSystemProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [supported, setSupported] = useState(true)
  const [config, setConfig] = useState<AudioSettingsConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)

    try {
      const [nextConfig, nextDevices] = await Promise.all([
        audioSettingsApi.get(),
        audioDevicesApi.getAll(),
      ])

      setConfig(nextConfig)
      setDevices(nextDevices.devices)
      setSupported(nextDevices.supported)

      if (nextDevices.error && nextDevices.devices.length === 0) {
        setError(nextDevices.error)
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить аудиосистему",
      )
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
      void audioDevicesApi
        .getAll()
        .then((response) => {
          setDevices(response.devices)
          setSupported(response.supported)
          if (response.error && response.devices.length === 0) {
            setError(response.error)
          } else {
            setError(null)
          }
        })
        .catch((requestError) => {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Не удалось проверить аудиоустройство",
          )
        })
    }, 5000)

    return () => window.clearInterval(timer)
  }, [isLoading])

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
        : calculateStatus(config, devices, error),
    [config, devices, error, isLoading],
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
