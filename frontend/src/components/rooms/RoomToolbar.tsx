import {
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { t } from "@/i18n"

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
        <Plus className="size-4" />
        {t("rooms.toolbar.add")}
      </Button>

      <div className="flex-1" />
      
      <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
        <Button
          type="button"
          size="icon"
          variant={viewGrid ? "secondary" : "ghost"}
          className="size-8"
          disabled={disabled}
          onClick={() => onViewChange(true)}
          aria-label={t("rooms.toolbar.showGrid")}
        >
          <LayoutGrid className="size-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={!viewGrid ? "secondary" : "ghost"}
          className="size-8"
          disabled={disabled}
          onClick={() => onViewChange(false)}
          aria-label={t("rooms.toolbar.showList")}
        >
          <List className="size-4" />
        </Button>
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
