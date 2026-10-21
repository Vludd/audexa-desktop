import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { t, type TranslationKey } from "@/i18n"

export type RoomFilter = "all" | "playing" | "waiting" | "stopped" | "error"

interface Props {
  value: RoomFilter
  counts: Record<RoomFilter, number>
  onChange: (value: RoomFilter) => void
}

const filters: {
  value: RoomFilter
  labelKey: TranslationKey
  dotClass: string
}[] = [
  {
    value: "all",
    labelKey: "rooms.filters.all",
    dotClass: "bg-primary",
  },
  {
    value: "playing",
    labelKey: "rooms.filters.playing",
    dotClass: "bg-emerald-500",
  },
  {
    value: "waiting",
    labelKey: "rooms.filters.waiting",
    dotClass: "bg-amber-500",
  },
  {
    value: "stopped",
    labelKey: "rooms.filters.stopped",
    dotClass: "bg-muted-foreground",
  },
  {
    value: "error",
    labelKey: "rooms.filters.error",
    dotClass: "bg-destructive",
  },
]

export default function RoomFilters({
  value,
  counts,
  onChange,
}: Props) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {filters.map((filter) => {
        const active = value === filter.value

        return (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange(filter.value)}
            className={cn(
              "rounded-full border transition-colors",
              active &&
                filter.value === "all" &&
                "border-blue-300 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/70",
              active &&
                filter.value === "playing" &&
                "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950/70",
              active &&
                filter.value === "waiting" &&
                "border-amber-300 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/70",
              active &&
                filter.value === "stopped" &&
                "border-slate-300 bg-slate-100 text-slate-800 shadow-sm hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
              active &&
                filter.value === "error" &&
                "border-red-300 bg-red-50 text-red-700 shadow-sm hover:bg-red-100 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/70",
            )}
          >
            {filter.value !== "all" && (
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  active ? "bg-current" : filter.dotClass,
                )}
              />
            )}

            {t(filter.labelKey)} ({counts[filter.value]})
          </Button>
        )
      })}
    </div>
  )
}