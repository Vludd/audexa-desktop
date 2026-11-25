import {
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { t } from "@/i18n"
import { cn } from "cn"

interface Props {
  query: string
  viewGrid: boolean
  onQueryChange: (value: string) => void
  onViewChange: (grid: boolean) => void
  onAddRoom: () => void
  disabled?: boolean
}

export default function RoomToolbar({
  query,
  viewGrid,
  onQueryChange,
  onViewChange,
  onAddRoom,
  disabled = false,
}: Props) {
  return (
    <div className="mb-4 flex items-center gap-3">
      

      <Button type="button" disabled={disabled} onClick={onAddRoom}>
        <Plus className="size-3.5" />
        {t("rooms.toolbar.add")}
      </Button>

      <div className="flex-1" />
      
      <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onViewChange(true)}
          aria-label={t("audio.toolbar.showList")}
          title={t("audio.toolbar.showList")}
          className={cn(
            "size-7 h-6 rounded px-1.5 text-[10px] font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            viewGrid
              ? "bg-secondary text-secondary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-4" />
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onViewChange(false)}
          aria-label={t("audio.toolbar.showList")}
          title={t("audio.toolbar.showList")}
          className={cn(
            "size-7 h-6 rounded px-1.5 text-[10px] font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !viewGrid
              ? "bg-secondary text-secondary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <List className="size-4" />
        </button>
      </div>


      <div className="relative w-full max-w-[280px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={query}
          disabled={disabled}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("rooms.toolbar.search")}
          className="pl-9"
        />
      </div>
    </div>
  )
}
