import { useEffect, useState } from "react"

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

  useEffect(() => {
    const unsubscribe = subscribeBackendStatus((online) => {
      if (online) {
        toast.success(t("network.backendConnected"))
      } else {
        toast.error(t("network.backendDisconnected"))
      }
    })

    return unsubscribe
  }, [])

  const [page, setPage] =
    useState<Page>("dashboard")

  const { status } = useAudioSystem()

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

    updateRoom,
    addRoom,
    deleteRoom,
    duplicateRoom,

    isLoading: roomsLoading,
    error: roomsError,
    refetch: refetchRooms,
  } = useRooms()

  const {
    scenarios,
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
    isLoading: scenariosLoading,
    error: scenariosError,
    refetch: refetchScenarios,
  } = useScenarios({
    updateRoom,
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
              onPauseRoom={pauseRoom}
              onStopRoom={stopRoom}
              onStopAll={stopAllRooms}
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
              rooms={rooms}
              audioFiles={audioFiles}
              onPlay={playScenario}
              onStop={stopScenario}
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
        onOpenSettings={() => setPage("settings")}
      />

      <Toaster />
    </div>
  )
}