import { useMemo, useState } from "react"
import { AlertCircle, Check, CircleAlert, Loader2, RefreshCw, Save, X } from "lucide-react"

import type { AudioDevice } from "@/api/audioDevices"
import type { AudioOutputMapping, AudioSettingsConfig } from "@/api/audioSettings"
import type { Room } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { t } from "@/i18n"
// import OutputDiagnostics from "./OutputDiagnostics"

type Mapping = AudioOutputMapping

interface LineMappingSettingsProps {
  rooms: Room[]
  selectedDevice: AudioDevice | null
  configuredDevice: AudioDevice | null
  savedConfig: AudioSettingsConfig | null
  isSaving: boolean
  backendError: string | null
  isRefreshing: boolean
  onRefresh: () => void
  onSave: (config: AudioSettingsConfig) => Promise<void>
}

const EMPTY_OUTPUTS: AudioDevice["outputs"] = []

function buildMappings(
  rooms: Room[],
  outputs: AudioDevice["outputs"],
  savedMappings: Mapping[],
  preserveSavedMappings: boolean,
): Mapping[] {
  // For the configured device, persisted mappings are the source of truth.
  // Never auto-assign a replacement output when a saved room is intentionally
  // unassigned: that can duplicate an output and create a false conflict.
  if (preserveSavedMappings) {
    return rooms.flatMap((room) => {
      const saved = savedMappings.filter((mapping) => mapping.roomId === room.id)
      return saved.length > 0 ? saved : [{ roomId: room.id, outputId: null }]
    })
  }

  // When switching to a different device, seed a simple one-output-per-room
  // proposal without reusing an output. Extra rooms remain unassigned.
  return rooms.map((room, index) => ({
    roomId: room.id,
    outputId: outputs[index]?.id ?? null,
  }))
}

export default function LineMappingSettings({
  rooms,
  selectedDevice,
  configuredDevice,
  savedConfig,
  isSaving,
  backendError,
  isRefreshing,
  onRefresh,
  onSave,
}: LineMappingSettingsProps) {
  const outputs = selectedDevice?.outputs ?? EMPTY_OUTPUTS
  const savedMappings = savedConfig?.mappings ?? []
  const validOutputIds = new Set(outputs.map((output) => output.id))
  const preserveSavedMappings = selectedDevice?.id === (savedConfig?.deviceId ?? null)
  const initialMappings = buildMappings(rooms, outputs, savedMappings, preserveSavedMappings)
  const initialTranslationOutput =
    savedConfig?.translationOutputId && validOutputIds.has(savedConfig.translationOutputId)
      ? savedConfig.translationOutputId
      : null

  const [mappings, setMappings] = useState<Mapping[]>(initialMappings)
  const [translationOutput, setTranslationOutput] = useState<string | null>(initialTranslationOutput)
  const savedSnapshot = initialMappings
  const savedTranslationOutput = initialTranslationOutput

  const roomById = useMemo(
    () => new Map(rooms.map((room) => [room.id, room])),
    [rooms],
  )

  const outputById = useMemo(
    () => new Map(outputs.map((output) => [output.id, output])),
    [outputs],
  )

  const mappingByRoomId = useMemo(() => {
    const grouped = new Map<string, Mapping[]>()
    mappings.forEach((mapping) => {
      const items = grouped.get(mapping.roomId) ?? []
      items.push(mapping)
      grouped.set(mapping.roomId, items)
    })
    return grouped
  }, [mappings])

  const assignedOutputs = useMemo(() => {
    const map = new Map<string, string>()
    mappings.forEach((mapping) => {
      if (mapping.outputId) map.set(mapping.outputId, mapping.roomId)
    })
    return map
  }, [mappings])

  const translationOutputOwner = translationOutput
    ? assignedOutputs.get(translationOutput) ?? null
    : null

  const conflictCount = useMemo(() => {
    const usage = new Map<string, number>()
    mappings.forEach((mapping) => {
      if (mapping.outputId) usage.set(mapping.outputId, (usage.get(mapping.outputId) ?? 0) + 1)
    })
    if (translationOutput) {
      usage.set(translationOutput, (usage.get(translationOutput) ?? 0) + 1)
    }
    return [...usage.values()].filter((count) => count > 1).length
  }, [mappings, translationOutput])

  const assignedCount = mappings.filter((mapping) => mapping.outputId).length
  const freeOutputCount = Math.max(
    0,
    outputs.length - assignedOutputs.size - (translationOutput && !assignedOutputs.has(translationOutput) ? 1 : 0),
  )

  const isDeviceDirty = Boolean(
    selectedDevice && selectedDevice.id !== (savedConfig?.deviceId ?? null),
  )

  const isDirty =
    isDeviceDirty ||
    JSON.stringify(mappings) !== JSON.stringify(savedSnapshot) ||
    translationOutput !== savedTranslationOutput

  const updateMapping = (roomId: string, outputId: string, checked: boolean) => {
    setMappings((current) => {
      const withoutOutput = current.filter((mapping) => !(mapping.roomId === roomId && mapping.outputId === outputId))
      if (!checked) return withoutOutput
      return [...withoutOutput, { roomId, outputId }]
    })
  }

  const clearRoomMappings = (roomId: string) => {
    setMappings((current) => current.filter((mapping) => mapping.roomId !== roomId))
  }

  const handleReset = () => {
    setMappings(savedSnapshot)
    setTranslationOutput(savedTranslationOutput)
  }

  const handleSave = async () => {
    if (!selectedDevice || conflictCount > 0) return

    const config: AudioSettingsConfig = {
      version: 1,
      deviceId: selectedDevice.id,
      mappings,
      translationOutputId: translationOutput,
    }

    await onSave(config)
  }



  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-sm">{t("settings.lineMapping.title")}</CardTitle>
            <CardDescription className="mt-1 text-xs">
              {t("settings.lineMapping.description")}
            </CardDescription>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {t("settings.lineMapping.configuredDevice")}
              </span>
              {configuredDevice ? (
                <Badge variant={configuredDevice.status === "online" ? "secondary" : "destructive"}>
                  {configuredDevice.name}
                  {configuredDevice.status !== "online" ? ` · ${t("settings.lineMapping.deviceOffline")}` : ""}
                </Badge>
              ) : (
                <Badge variant="outline">{t("settings.lineMapping.noConfiguredDevice")}</Badge>
              )}
              {selectedDevice && configuredDevice && selectedDevice.id !== configuredDevice.id && (
                <span className="text-amber-600">
                  {t("settings.lineMapping.editingDifferentDevice", { name: selectedDevice.name })}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline">
              {t("settings.lineMapping.summary", { rooms: rooms.length, outputs: outputs.length })}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {t("settings.lineMapping.refresh")}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {backendError && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <div className="font-medium">
                {t("settings.lineMapping.backendUnavailable")}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t("settings.lineMapping.reconnecting")}
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {backendError}
              </div>
            </div>
          </div>
        )}

        {!selectedDevice ? (
          <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {t("settings.lineMapping.selectDevice")}
          </div>
        ) : outputs.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {t("settings.lineMapping.noOutputs")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">{t("settings.lineMapping.assigned")}</div>
                <div className="mt-1 text-sm font-semibold">{assignedCount} / {mappings.length}</div>
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">{t("settings.lineMapping.free")}</div>
                <div className="mt-1 text-sm font-semibold">{freeOutputCount}</div>
              </div>
              <div className={[
                "rounded-md border px-3 py-2",
                conflictCount > 0 ? "border-destructive/50 bg-destructive/5" : "bg-muted/20",
              ].join(" ")}>
                <div className="text-xs text-muted-foreground">{t("settings.lineMapping.conflicts")}</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                  {conflictCount > 0 ? (
                    <><CircleAlert className="size-3.5 text-destructive" />{conflictCount}</>
                  ) : (
                    <><Check className="size-3.5 text-green-600" />0</>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("settings.lineMapping.rooms")}
              </div>
              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-[48px_minmax(0,1fr)_minmax(220px,1.5fr)_32px_100px] items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>#</span>
                  <span>{t("settings.lineMapping.room")}</span>
                  <span>{t("settings.lineMapping.output")}</span>
                  <span />
                  <span>{t("settings.lineMapping.status")}</span>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {rooms.map((room, index) => {
                    const roomMappings = mappingByRoomId.get(room.id) ?? []
                    const selectedIds = new Set(roomMappings.map((mapping) => mapping.outputId).filter((id): id is string => Boolean(id)))
                    const hasConflict = roomMappings.some((mapping) => mapping.outputId && assignedOutputs.get(mapping.outputId) !== room.id)

                    return (
                      <div
                        key={room.id}
                        className={[
                          "grid grid-cols-[48px_minmax(0,1fr)_minmax(220px,1.5fr)_32px_100px] items-center gap-3 border-b px-3 py-1.5 last:border-b-0 hover:bg-muted/20",
                          hasConflict ? "bg-destructive/5" : "",
                        ].join(" ")}
                      >
                        <span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                        <div className="min-w-0"><div className="truncate text-sm font-medium">{room.name}</div></div>
                        <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 rounded-md border bg-background px-2 py-1.5 sm:grid-cols-3">
                          {outputs.map((candidate) => {
                            const owner = assignedOutputs.get(candidate.id)
                            const occupiedByOtherRoom = owner !== undefined && owner !== room.id
                            return (
                              <label key={candidate.id} className="flex min-w-0 items-center gap-1.5 text-xs" title={candidate.name}>
                                <input
                                  type="checkbox"
                                  className="size-3.5 shrink-0 accent-primary"
                                  checked={selectedIds.has(candidate.id)}
                                  disabled={occupiedByOtherRoom}
                                  onChange={(event) => updateMapping(room.id, candidate.id, event.target.checked)}
                                />
                                <span className="truncate">{candidate.name}</span>
                              </label>
                            )
                          })}
                          {outputs.length === 0 && <span className="text-xs text-muted-foreground">Нет доступных выходов</span>}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={roomMappings.length === 0}
                          aria-label={t("settings.lineMapping.clearOutput", { name: room.name })}
                          title={t("settings.lineMapping.clearOutput", { name: room.name })}
                          onClick={() => clearRoomMappings(room.id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                        <div>
                          {hasConflict ? (
                            <Badge variant="destructive" className="text-[10px]">{t("settings.lineMapping.conflict")}</Badge>
                          ) : roomMappings.some((mapping) => mapping.outputId) ? (
                            <Badge variant="secondary" className="gap-1 text-[10px]"><Check className="size-3" />{roomMappings.filter((mapping) => mapping.outputId).length} OUT</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">{t("common.notAssigned")}</Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("settings.lineMapping.specialLines")}
              </div>
              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(150px,220px)_100px] items-center gap-3 bg-primary/5 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t("settings.lineMapping.translation")}</div>
                    <div className="truncate text-xs text-muted-foreground">{t("settings.lineMapping.dedicatedOutput")}</div>
                  </div>
                  <div className="min-w-0 rounded-md border bg-background">
                    <Select value={translationOutput ?? ""} onValueChange={setTranslationOutput}>
                      <SelectTrigger className="h-8 w-full border-0 bg-transparent px-2 shadow-none focus:ring-0">
                        <SelectValue placeholder={t("common.notAssigned")}>
                          {translationOutput ? outputById.get(translationOutput)?.name ?? t("common.notAssigned") : t("common.notAssigned")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {outputs.map((output) => {
                          const owner = assignedOutputs.get(output.id)
                          const ownerRoom = owner ? roomById.get(owner) : undefined
                          return (
                            <SelectItem key={output.id} value={output.id} disabled={Boolean(owner)}>
                              <div className="flex min-w-0 items-center gap-2">
                                <span>{output.name}</span>
                                {ownerRoom && <span className="truncate text-xs text-muted-foreground">· {ownerRoom.name}</span>}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    {translationOutputOwner ? (
                      <Badge variant="destructive" className="text-[10px]">{t("settings.lineMapping.conflict")}</Badge>
                    ) : translationOutput ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]"><Check className="size-3" />{t("settings.lineMapping.ok")}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">{t("common.notAssigned")}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* <OutputDiagnostics
              device={selectedDevice}
              outputIds={mappings.map((mapping) => mapping.outputId).filter((value): value is string => Boolean(value))}
            /> */}

            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <div className="text-xs text-muted-foreground">
                {isDirty ? <span className="text-foreground">{t("settings.lineMapping.unsaved")}</span> : t("settings.lineMapping.saved")}
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <Button variant="ghost" size="sm" onClick={handleReset} disabled={isSaving}>{t("common.cancel")}</Button>
                )}
                <Button size="sm" disabled={!isDirty || conflictCount > 0 || isSaving} onClick={() => void handleSave()}>
                  <Save className="mr-2 size-3.5" />
                  {isSaving ? t("settings.lineMapping.saving") : t("common.save")}
                </Button>
              </div>
            </div>

          </>
        )}
      </CardContent>
    </Card>
  )
}
