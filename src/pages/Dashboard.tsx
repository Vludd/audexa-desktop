import type { LogEntry, Room, ScheduleItem, SystemStatus } from "@/types"

import Header from "@/components/Header"
import { t } from "@/i18n"
import DashboardHealth from "@/components/dashboard/DashboardHealth"
import DashboardPlayback from "@/components/dashboard/DashboardPlayback"
import DashboardRooms from "@/components/dashboard/DashboardRooms"
import DashboardSchedule from "@/components/dashboard/DashboardSchedule"
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions"
import DashboardAudioSystem from "@/components/dashboard/DashboardAudioSystem"
import DashboardIssues from "@/components/dashboard/DashboardIssues"

interface Props {
  rooms: Room[]
  schedule: ScheduleItem[]
  system: SystemStatus
  logs: LogEntry[]
  onStopAll: () => void
  onPauseRoom: (roomId: string) => void
  onStopRoom: (roomId: string) => void
  onNavigate: (page: string) => void
}

export default function Dashboard({
  rooms,
  schedule,
  system,
  logs,
  onStopAll,
  onPauseRoom,
  onStopRoom,
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
              logs={logs}
            />

            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
              <div className="flex min-w-0 flex-col gap-3">
                <DashboardPlayback
                  rooms={rooms}
                  onNavigate={onNavigate}
                  onPauseRoom={onPauseRoom}
                  onStopRoom={onStopRoom}
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
                />
              </div>
            </div>

            <DashboardIssues
              logs={logs}
              rooms={rooms}
              onNavigate={onNavigate}
              onStopAll={onStopAll}
            />
          </div>
        </main>
      </div>
    </>
  )
}
