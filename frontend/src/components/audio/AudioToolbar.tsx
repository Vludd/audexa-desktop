import { LayoutGrid, List, Loader2, Plus, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { t } from "@/i18n"

export const ALL_FILE_TYPES = "__all_file_types__"

interface Props {
  query: string
  onQueryChange: (value: string) => void
  fileTypes: string[]
  fileTypeFilter: string
  onFileTypeFilterChange: (value: string) => void
  fileCount: number
  storageBytes: number
  viewGrid: boolean
  onAdd: () => void
  onViewChange: (grid: boolean) => void
  isAddPending?: boolean

  selectedCount: number
  onDeleteSelected: () => void
  disabled?: boolean
}

export default function AudioToolbar({
  query,
  onQueryChange,
  fileTypes,
  fileTypeFilter,
  onFileTypeFilterChange,
  fileCount,
  storageBytes,
  viewGrid,
  onAdd,
  onViewChange,
  isAddPending = false,
  selectedCount,
  onDeleteSelected,
  disabled = false,
}: Props) {
  return (
    <div className="flex min-h-[49px] flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
      <Button
        size="sm"
        onClick={onAdd}
        disabled={disabled || isAddPending}
        aria-busy={isAddPending}
      >
        {isAddPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Plus className="size-3.5" />
        )}

        {isAddPending ? t("audio.toolbar.opening") : t("audio.toolbar.add")}
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

      <Select
        value={fileTypeFilter}
        onValueChange={(value) => {
          if (value !== null) onFileTypeFilterChange(value)
        }}
      >
        <SelectTrigger
          aria-label={t("audio.toolbar.fileType")}
          className="h-8 w-36 text-xs"
        >
          <SelectValue>
            {fileTypeFilter === ALL_FILE_TYPES
              ? t("audio.toolbar.allFileTypes")
              : fileTypeFilter}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILE_TYPES}>
            {t("audio.toolbar.allFileTypes")}
          </SelectItem>
          {fileTypes.map((fileType) => (
            <SelectItem key={fileType} value={fileType}>
              {fileType}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
        <Button
          type="button"
          size="icon"
          variant={viewGrid ? "secondary" : "ghost"}
          className="size-7"
          disabled={disabled}
          onClick={() => onViewChange(true)}
          aria-label={t("audio.toolbar.showGrid")}
          title={t("audio.toolbar.showGrid")}
        >
          <LayoutGrid className="size-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={!viewGrid ? "secondary" : "ghost"}
          className="size-7"
          disabled={disabled}
          onClick={() => onViewChange(false)}
          aria-label={t("audio.toolbar.showList")}
          title={t("audio.toolbar.showList")}
        >
          <List className="size-4" />
        </Button>
      </div>

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
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("audio.toolbar.search")}
          className="h-7 pl-8 text-xs"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
