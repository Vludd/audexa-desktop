import {
  Copy,
  Edit2,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { t } from "@/i18n"

interface Props {
  query: string
  onQueryChange: (value: string) => void

  hasSelection: boolean

  onCreate: () => void
  onDuplicate: () => void
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
}

export default function ScenarioToolbar({
  query,
  onQueryChange,
  hasSelection,
  onCreate,
  onDuplicate,
  onEdit,
  onDelete,
  disabled = false,
}: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={onCreate}
      >
        <Plus className="size-3.5" />
        {t("scenarios.toolbar.create")}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !hasSelection}
        onClick={onDuplicate}
      >
        <Copy className="size-3.5" />
        {t("scenarios.toolbar.duplicate")}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !hasSelection}
        onClick={onEdit}
      >
        <Edit2 className="size-3.5" />
        {t("scenarios.toolbar.edit")}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !hasSelection}
        className="text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
        {t("scenarios.toolbar.delete")}
      </Button>

      <div className="ml-auto flex-1" />

      <div className="relative w-[240px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={query}
          disabled={disabled}
          onChange={(event) =>
            onQueryChange(event.target.value)
          }
          placeholder={t("scenarios.toolbar.search")}
          className="h-8 pl-9 text-xs"
        />
      </div>
    </div>
  )
}