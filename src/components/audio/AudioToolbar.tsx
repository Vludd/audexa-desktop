import {
  Loader2,
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
  fileCount: number
  storageBytes: number
  onAdd: () => void
  isAddPending?: boolean

  selectedCount: number
  onDeleteSelected: () => void
  disabled?: boolean
}

export default function AudioToolbar({
  query,
  onQueryChange,
  fileCount,
  storageBytes,
  onAdd,
  isAddPending = false,
  selectedCount,
  onDeleteSelected,
  disabled = false,
}: Props) {
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
      <Button
        size="sm"
        onClick={onAdd}
        disabled={disabled || isAddPending}
        aria-busy={isAddPending}
      >
        {isAddPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}

        {isAddPending
          ? t("audio.toolbar.opening")
          : t("audio.toolbar.add")}
      </Button>

      {selectedCount > 0 && (
        <>
          <div className="h-5 w-px bg-border" />

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDeleteSelected}
            disabled={disabled}
          >
            <Trash2 className="size-4" />
            {t("audio.toolbar.deleteSelected")}

            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
              {selectedCount}
            </span>
          </Button>
        </>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{t("audio.toolbar.fileCount", { count: fileCount })}</span>
        <span>
          {t("audio.toolbar.storageUsed", {
            size: (storageBytes / 1024 / 1024).toFixed(1),
            unit: t("units.megabyte"),
          })}
        </span>
      </div>

      <div className="relative w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={query}
          onChange={(event) =>
            onQueryChange(event.target.value)
          }
          placeholder={t("audio.toolbar.search")}
          className="h-8 pl-8 text-xs"
          disabled={disabled}
        />
      </div>
    </div>
  )
}