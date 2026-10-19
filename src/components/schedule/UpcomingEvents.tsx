import { Button } from "@/components/ui/button"
import type { ScheduleItem } from "@/types"
import { t } from "@/i18n"

interface Props {
  items: ScheduleItem[]
}

export default function UpcomingEvents({
  items,
}: Props) {
  return (
    <aside className="w-[230px] shrink-0 overflow-auto border-l bg-card p-3.5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold">
          {t("schedule.upcoming.title")}
        </div>

        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          disabled
        >
          {t("schedule.upcoming.all")}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <div className="text-sm font-medium">
            {t("schedule.upcoming.empty")}
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            {t("schedule.upcoming.emptyDescription")}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex gap-3"
            >
              <div className="flex flex-col items-center pt-1">
                <span className="size-2.5 shrink-0 rounded-full bg-primary" />

                {index <
                  items.length - 1 && (
                  <span className="mt-1 w-px flex-1 bg-border" />
                )}
              </div>

              <div className="min-w-0 pb-1">
                <div className="text-sm font-bold">
                  {item.time}
                </div>

                <div className="truncate text-xs font-medium">
                  {item.scenarioName}
                </div>

                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.nextRun}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </aside>
  )
}