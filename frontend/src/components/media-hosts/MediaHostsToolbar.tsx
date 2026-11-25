import { RefreshCw, Search } from "lucide-react"

import { t } from "@/i18n"
import { Input } from "../ui/input"
import { Button } from "../ui/button"

interface Props {
  search: string
  onSearchChange: (value: string) => void
  isFetching: boolean
  onRefresh: () => void
}

export default function MediaHostsToolbar({
  search,
  onSearchChange,
  isFetching,
  onRefresh,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("mediaHosts.searchPlaceholder")}
          className="h-8 pr-3 pl-9"
        />
      </div>
      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={isFetching}
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
      >
        <RefreshCw
          className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
        />
        {t("common.retry")}
      </Button>
    </div>
  )
}
