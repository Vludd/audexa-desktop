import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ScheduleItem } from "@/types"
import { t } from "@/i18n"

interface Props {
  schedule: ScheduleItem[]
  selectedId: number | null
  onSelect: (id: number) => void
  onToggle: (id: number) => void
  isLoading?: boolean
  disabled?: boolean
}

export default function ScheduleTable({
  schedule,
  selectedId,
  onSelect,
  onToggle,
  isLoading = false,
  disabled = false,
}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-16">
              {t("schedule.toolbar.enabled")}
            </TableHead>

            <TableHead>{t("schedule.toolbar.time")}</TableHead>
            <TableHead>{t("schedule.toolbar.scenario")}</TableHead>
            <TableHead>{t("schedule.toolbar.days")}</TableHead>
            <TableHead>{t("schedule.toolbar.repeat")}</TableHead>
            <TableHead>{t("schedule.toolbar.nextRun")}</TableHead>
            <TableHead>{t("schedule.toolbar.status")}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-32 text-center text-muted-foreground"
              >
                Загрузка расписания…
              </TableCell>
            </TableRow>
          ) : schedule.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-32 text-center text-muted-foreground"
              >
                {t("schedule.toolbar.noSchedules")}
              </TableCell>
            </TableRow>
          ) : (
            schedule.map((item) => {
              const active =
                item.status === "active"

              const selected =
                item.id === selectedId

              return (
                <TableRow
                  key={item.id}
                  data-state={
                    selected
                      ? "selected"
                      : undefined
                  }
                  className="cursor-pointer"
                  onClick={() =>
                    onSelect(item.id)
                  }
                >
                  <TableCell
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >
                    <Switch
                      checked={item.enabled}
                      disabled={disabled || isLoading}
                      onCheckedChange={() =>
                        onToggle(item.id)
                      }
                      aria-label={t("schedule.toolbar.enable", {
                        id: item.id,
                      })}
                    />
                  </TableCell>

                  <TableCell className="text-base font-bold">
                    {item.time}
                  </TableCell>

                  <TableCell className="font-medium">
                    {item.scenarioName}
                  </TableCell>

                  <TableCell className="text-sm">
                    {item.days.length === 7
                      ? t("schedule.toolbar.everyDay")
                      : item.days
                          .map((day) => t(`schedule.weekdays.${day}`))
                          .join(", ")}
                  </TableCell>

                  <TableCell className="text-sm">
                    {t(`schedule.repeat.${item.repeat}`)}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {item.nextRun}
                  </TableCell>

                  <TableCell>
                    <span
                      className={
                        active
                          ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      <span className="text-[9px]">
                        {active ? "●" : "○"}
                      </span>

                      {active
                        ? t("schedule.status.active")
                        : t("schedule.status.inactive")}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}