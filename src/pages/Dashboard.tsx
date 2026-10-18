import type { LogEntry, Room, ScheduleItem, SystemStatus } from "@/types"
import type { PlaybackSession, PlaybackState } from "@/api/playback"
import type { BackendConnectionState } from "@/api/client"

import Header from "@/components/Header"
import { t } from "@/i18n"
import DashboardHealth from "@/components/dashboard/DashboardHealth"
import DashboardPlayback from "@/components/dashboard/DashboardPlayback"
import DashboardPlaybackSessions from "@/components/dashboard/DashboardPlaybackSessions"
import DashboardRooms from "@/components/dashboard/DashboardRooms"
import DashboardSchedule from "@/components/dashboard/DashboardSchedule"
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions"
import DashboardAudioSystem from "@/components/dashboard/DashboardAudioSystem"
import DashboardIssues from "@/components/dashboard/DashboardIssues"

interface Props {
  rooms: Room[]
  schedule: ScheduleItem[]
  system: SystemStatus
  connectionState: BackendConnectionState
  logs: LogEntry[]
  playback?: PlaybackState
  playbackSessions: PlaybackSession[]
  onPauseSession: (sessionId: string) => void
  onResumeSession: (sessionId: string) => void
  onStopSession: (sessionId: string) => void
  onStopAll: () => void
  onPause: () => void
  onResume: () => void
  onSkipStep: (sessionId: string, stepNumber: number) => void
  onVolumeChange: (roomId: string, volume: number) => Promise<void>
  onGainChange: (audioFileId: string, gainDb: number) => Promise<void>
  onNavigate: (page: string) => void
}

export default function Dashboard({
  rooms,
  schedule,
  system,
  connectionState,
  logs,
  playback,
  playbackSessions,
  onPauseSession,
  onResumeSession,
  onStopSession,
  onStopAll,
  onPause,
  onResume,
  onSkipStep,
  onVolumeChange,
  onGainChange,
  onNavigate,
}: Props) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Header
          title={t("pages.dashboard.title")}
          subtitle={t("pages.dashboard.subtitle")}
        />

        <main className="min-h-0 flex-1 overflow-auto p-4">
          <div className="flex flex-col gap-4">
            <DashboardHealth
              rooms={rooms}
              system={system}
              connectionState={connectionState}
              logs={logs}
            />

            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
              <div className="flex min-w-0 flex-col gap-3">
                <DashboardPlaybackSessions
                  sessions={playbackSessions}
                  onSkipStep={onSkipStep}
                  onPause={onPauseSession}
                  onResume={onResumeSession}
                  onStop={onStopSession}
                />
                <DashboardPlayback
                  rooms={rooms}
                  system={system}
                  playback={playback}
                  playbackSessions={playbackSessions}
                  onNavigate={onNavigate}
                  onPause={onPause}
                  onResume={onResume}
                  onSkipStep={onSkipStep}
                  onVolumeChange={onVolumeChange}
                  onGainChange={onGainChange}
                />

                <DashboardRooms
                  rooms={rooms}
                  onNavigate={onNavigate}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-3 self-start">
                <DashboardSchedule
                  schedule={schedule}
                  onNavigate={onNavigate}
                />

                <DashboardQuickActions
                  onNavigate={onNavigate}
                />

                <DashboardAudioSystem
                  system={system}
                  connectionState={connectionState}
                />
              </div>
            </div>

            <DashboardIssues
              logs={logs}
              rooms={rooms}
              system={system}
              onNavigate={onNavigate}
              onStopAll={onStopAll}
            />
          </div>
        </main>
      </div>
    </>
  )
}
