import { Clock3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ScheduleItem } from "@/types"
import { t } from "@/i18n"

interface DashboardScheduleProps {
  schedule: ScheduleItem[]
  onNavigate: (page: string) => void
}

export default function DashboardSchedule({
  schedule,
  onNavigate,
}: DashboardScheduleProps) {
  const upcomingSchedule = schedule
    .filter((item) => item.enabled)
    .slice(0, 4)

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">
          {t("dashboard.schedule.title")}
        </h3>

        <Button
          variant="link"
          className="h-auto p-0 text-xs"
          onClick={() => onNavigate("schedule")}
        >
          {t("dashboard.schedule.all")}
        </Button>
      </div>

      <div className="p-3.5">
        {upcomingSchedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock3 className="mb-2 size-7 text-muted-foreground/50" />

            <div className="text-sm text-muted-foreground">
              {t("dashboard.schedule.empty")}
            </div>

            <Button
              variant="link"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() => onNavigate("schedule")}
            >
              {t("dashboard.schedule.open")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {upcomingSchedule.map((item, index) => (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate("schedule")}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="flex w-12 shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums text-primary">
                    <Clock3 className="size-3.5" />
                    {item.time}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.scenarioName}
                  </span>
                </button>

                {index < upcomingSchedule.length - 1 && (
                  <div className="h-px bg-border" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}