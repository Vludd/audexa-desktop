import type { Scenario } from "@/types"
import type { ScenarioSaveStatus } from "@/hooks/useScenarios"
import { cn } from "cn"
import { t } from "@/i18n"
import { formatTime } from "@/lib/audio"
import { getScenarioDuration } from "@/lib/scenarios"

interface Props {
  scenarios: Scenario[]
  selected: string | null
  onSelect: (id: string) => void
  saveStatuses: Record<string, ScenarioSaveStatus>
}

export default function ScenarioList({
  scenarios,
  selected,
  onSelect,
  saveStatuses,
}: Props) {
  return (
    <aside className="max-h-36 w-full shrink-0 overflow-auto border-b bg-card xl:max-h-none xl:w-[240px] xl:border-b-0 xl:border-r">
      <div className="border-b px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("scenarios.list.title")}
      </div>

      {scenarios.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">
          {t("scenarios.list.noResults")}
        </div>
      ) : (
        scenarios.map((scenario, index) => {
          const active = selected === scenario.id

          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelect(scenario.id)}
              className={cn(
                "w-full border-l-2 px-3.5 py-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:bg-muted/60",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-bold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {scenario.name}
                </span>

                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    scenario.status === "active"
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/30",
                  )}
                />
              </div>

              {scenario.description && (
                <div className="ml-8 mt-1 truncate text-[11px] text-muted-foreground">
                  {scenario.description}
                </div>
              )}

              <div className="ml-8 mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  {scenario.steps.length}{" "}
                  {scenario.steps.length === 1
                    ? t("scenarios.list.step")
                    : t("scenarios.list.steps")}
                </span>

                <span>·</span>

                <span>
                  {formatTime(getScenarioDuration(scenario))}
                </span>

                {saveStatuses[scenario.id] && (
                  <>
                    <span>·</span>
                    <span
                      className={cn(
                        saveStatuses[scenario.id] === "error"
                          ? "text-destructive"
                          : saveStatuses[scenario.id] === "saved"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {t(`scenarios.editor.saveStatus.${saveStatuses[scenario.id]}`)}
                    </span>
                  </>
                )}
              </div>
            </button>
          )
        })
      )}
    </aside>
  )
}