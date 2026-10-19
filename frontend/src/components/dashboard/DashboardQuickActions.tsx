import { PlayCircle, Radio } from "lucide-react"

import { Button } from "@/components/ui/button"
import { t } from "@/i18n"

interface DashboardQuickActionsProps {
  onNavigate: (page: string) => void
}

export default function DashboardQuickActions({
  onNavigate,
}: DashboardQuickActionsProps) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center border-b px-4 py-3">
        <h3 className="text-sm font-semibold">
          {t("dashboard.quickActions.title")}
        </h3>
      </div>

      <div className="flex flex-col gap-2 p-3.5">
        <Button
          type="button"
          variant="success"
          className="w-full justify-start gap-2.5"
          onClick={() => onNavigate("scenarios")}
        >
          <PlayCircle className="size-4" />
          {t("dashboard.quickActions.runScenario")}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2.5"
          onClick={() => {
            window.location.hash = "audio-device-settings"
            onNavigate("settings")
          }}
        >
          <Radio className="size-4" />
          {t("dashboard.quickActions.testOutputs")}
        </Button>
      </div>
    </div>
  )
}