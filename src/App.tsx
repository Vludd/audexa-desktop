import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { subscribeBackendStatus } from "@/api/client"
import { useAudioSystem } from "@/context/useAudioSystem"

import { useLocale } from "@/i18n"
import { t } from "@/i18n"
import { toast } from "@/lib/toast"
import type { Page } from "./types"

import { useRooms } from "./hooks/useRooms"
import { useAudioFiles } from "./hooks/useAudioFiles"
import { useScenarios } from "./hooks/useScenarios"
import { useSchedule } from "./hooks/useSchedule"
import { usePlayback } from "./hooks/usePlayback"
import { playbackApi } from "./api/playback"
import { useLogs } from "./hooks/useLogs"

import Sidebar from "./components/Sidebar"
import Toaster from "./components/ui/Toaster"
import StatusBar from "./components/StatusBar"

import Dashboard from "./pages/Dashboard"
import Rooms from "./pages/Rooms"
import Scenarios from "./pages/Scenarios"
import Schedule from "./pages/Schedule"
import AudioFiles from "./pages/AudioFiles"
import Settings from "./pages/Settings"
import Logs from "./pages/Logs"

export default function App() {
  useLocale()

  const queryClient = useQueryClient()
  const [page, setPage] =
    useState<Page>("dashboard")

  useEffect(() => {
    const unsubscribe = subscribeBackendStatus((online) => {
      if (online) {
        toast.success(t("network.backendConnected"))
        // Invalidate active query caches after reconnection so stale data is
        // replaced by a fresh snapshot without restarting the desktop app.
        void queryClient.invalidateQueries()
      } else {
        // api/client.ts already records the connection transition in the log.
        toast.error(t("network.backendDisconnected"), { logError: false })
      }
    })

    return unsubscribe
  }, [queryClient])

  const { status, connectionState } = useAudioSystem()
  const { data: playback, sessions: playbackSessions } = usePlayback()

  const { files: audioFiles } = useAudioFiles({})

  const {
    rooms,
    operations,

    playRoom,
    stopRoom,
    pauseRoom,

    previewRoomVolume,
    saveRoomVolume,

    updateRoomFromForm,
    stopAllRooms,

    addRoom,
    deleteRoom,
    duplicateRoom,

    isLoading: roomsLoading,
    error: roomsError,
    refetch: refetchRooms,
  } = useRooms()

  const {
    scenarios,
    saveStatuses,
    retrySaveScenario,
    playScenario,
    stopScenario,
    createScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
    addStep,
    updateStep,
    removeStep,
    moveStep,
    validateScenario,
    roomIdsWithoutOutputs,
    testScenario,
    isLoading: scenariosLoading,
    error: scenariosError,
    refetch: refetchScenarios,
  } = useScenarios({
    rooms,
    audioFiles,
  })

  const {
    schedule,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    duplicateSchedule,
    toggleSchedule,
    isLoading: scheduleLoading,
    isSaving: scheduleSaving,
    error: scheduleError,
    refetch: refetchSchedule,
  } = useSchedule()

  const {
    logs,
    clearLogs,
  } = useLogs()

  return (
    <div className="flex h-screen min-w-0 flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          current={page}
          onChange={setPage}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {page === "dashboard" && (
            <Dashboard
              rooms={rooms}
              schedule={schedule}
              system={status}
              logs={logs}
              playback={playback}
              playbackSessions={playbackSessions}
              onPauseSession={(sessionId) => {
                void playbackApi.pauseSession(sessionId).then(() => queryClient.invalidateQueries({ queryKey: ["playback-sessions"] })).catch((error) =>
                  toast.error("Не удалось приостановить сценарий", { description: error instanceof Error ? error.message : String(error) }),
                )
              }}
              onResumeSession={(sessionId) => {
                void playbackApi.resumeSession(sessionId).then(() => queryClient.invalidateQueries({ queryKey: ["playback-sessions"] })).catch((error) =>
                  toast.error("Не удалось продолжить сценарий", { description: error instanceof Error ? error.message : String(error) }),
                )
              }}
              onStopSession={(sessionId) => {
                void playbackApi.stopSession(sessionId).then(() => queryClient.invalidateQueries({ queryKey: ["playback-sessions"] })).catch((error) =>
                  toast.error("Не удалось остановить сценарий", { description: error instanceof Error ? error.message : String(error) }),
                )
              }}
              onPause={pauseRoom}
              onResume={() => {
                void playbackApi.resume().catch((error) =>
                  toast.error("Не удалось продолжить воспроизведение", {
                    description: error instanceof Error ? error.message : String(error),
                  }),
                )
              }}
              onSkipStep={(sessionId, stepNumber) => {
                void playbackApi.skipStep(sessionId, stepNumber)
                  .then(() => queryClient.invalidateQueries({ queryKey: ["playback-sessions"] }))
                  .catch((error) =>
                    toast.error("Не удалось пропустить шаг", {
                      description: error instanceof Error ? error.message : String(error),
                    }),
                  )
              }}
              onStopAll={stopAllRooms}
              onVolumeChange={async (roomId, volume) => {
                try {
                  const nextState = await playbackApi.setRoomVolume(roomId, volume)
                  queryClient.setQueryData(["playback"], nextState)
                } catch (error) {
                  toast.error("Не удалось изменить громкость", {
                    description: error instanceof Error ? error.message : String(error),
                  })
                  throw error
                }
              }}
              onGainChange={async (audioFileId, gainDb) => {
                if (!audioFileId) return
                try {
                  const nextState = await playbackApi.setAudioGain(audioFileId, gainDb)
                  queryClient.setQueryData(["playback"], nextState)
                } catch (error) {
                  toast.error("Не удалось изменить усиление", {
                    description: error instanceof Error ? error.message : String(error),
                  })
                  throw error
                }
              }}
              onNavigate={(nextPage) =>
                setPage(nextPage as Page)
              }
            />
          )}

          {page === "rooms" && (
            <Rooms
              rooms={rooms}
              operations={operations}

              onPlay={playRoom}
              onStop={stopRoom}
              onPause={pauseRoom}

              onVolumePreview={previewRoomVolume}
              onVolumeCommit={saveRoomVolume}

              onAddRoom={addRoom}
              onUpdateRoom={updateRoomFromForm}
              onDeleteRoom={deleteRoom}
              onDuplicateRoom={duplicateRoom}

              isLoading={roomsLoading}

              error={
                roomsError instanceof Error
                  ? roomsError
                  : roomsError
                    ? new Error(String(roomsError))
                    : null
              }

              onRetry={() => {
                void refetchRooms()
              }}
            />
          )}

          {page === "scenarios" && (
            <Scenarios
              scenarios={scenarios}
              saveStatuses={saveStatuses}
              onRetrySave={retrySaveScenario}
              rooms={rooms}
              audioFiles={audioFiles}
              onPlay={playScenario}
              onTest={testScenario}
              onStop={stopScenario}
              onPause={pauseRoom}
              onResume={() => {
                void playbackApi.resume().catch((error) =>
                  toast.error("Не удалось продолжить воспроизведение", {
                    description: error instanceof Error ? error.message : String(error),
                  }),
                )
              }}
              playback={playback}
              playbackSessions={playbackSessions}
              onPauseSession={(sessionId) => {
                void playbackApi.pauseSession(sessionId).then(() => queryClient.invalidateQueries({ queryKey: ["playback-sessions"] })).catch((error) =>
                  toast.error("Не удалось приостановить сценарий", { description: error instanceof Error ? error.message : String(error) }),
                )
              }}
              onResumeSession={(sessionId) => {
                void playbackApi.resumeSession(sessionId).then(() => queryClient.invalidateQueries({ queryKey: ["playback-sessions"] })).catch((error) =>
                  toast.error("Не удалось продолжить сценарий", { description: error instanceof Error ? error.message : String(error) }),
                )
              }}
              onCreate={createScenario}
              onUpdate={updateScenario}
              onDelete={deleteScenario}
              onDuplicate={
                duplicateScenario
              }
              onAddStep={addStep}
              onUpdateStep={updateStep}
              onRemoveStep={removeStep}
              onMoveStep={moveStep}
              onValidate={
                validateScenario
              }
              roomIdsWithoutOutputs={roomIdsWithoutOutputs}
              isLoading={scenariosLoading}
              error={scenariosError}
              onRetry={() => {
                void refetchScenarios()
              }}
            />
          )}

          {page === "schedule" && (
            <Schedule
              schedule={schedule}
              scenarios={scenarios}
              onAdd={addSchedule}
              onUpdate={updateSchedule}
              onDelete={deleteSchedule}
              onDuplicate={
                duplicateSchedule
              }
              onToggle={toggleSchedule}
              isLoading={scheduleLoading}
              isSaving={scheduleSaving}
              error={scheduleError}
              onRetry={() => {
                void refetchSchedule()
              }}
            />
          )}

          {page === "audiofiles" && (
            <AudioFiles />
          )}

          {page === "settings" && (
            <Settings rooms={rooms} />
          )}

          {page === "logs" && (
            <Logs
              logs={logs}
              onClear={clearLogs}
            />
          )}
        </main>
      </div>

      <StatusBar
        status={status}
        connectionState={connectionState}
        onOpenSettings={() => setPage("settings")}
      />

      <Toaster />
    </div>
  )
}