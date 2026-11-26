import { Loader2, Plus, Search } from "lucide-react"

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

export const ALL_VIDEO_FILE_TYPES = "__all_file_types__"

interface Props {
  query: string
  onQueryChange: (value: string) => void
  fileTypes: string[]
  fileTypeFilter: string
  onFileTypeFilterChange: (value: string) => void
  fileCount: number
  storageBytes: number
  isUploading: boolean
  isAddPending: boolean
  onAdd: () => void

  disabled?: boolean
}

export default function VideoToolbar({
  query,
  onQueryChange,
  fileTypes,
  fileTypeFilter,
  onFileTypeFilterChange,
  fileCount,
  storageBytes,
  isUploading,
  isAddPending,
  onAdd,
  disabled = false,
}: Props) {
  const isAddBusy = isAddPending || isUploading

  return (
    <div className="flex min-h-[49px] flex-wrap items-center px-4 pt-4 gap-2">
      <Button size="sm" onClick={onAdd} disabled={isAddBusy || disabled} aria-busy={isAddBusy}>
        {isAddBusy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Plus className="size-3.5" />
        )}
        {isAddPending
          ? t("mediaLibrary.videoToolbar.opening")
          : isUploading
          ? t("mediaLibrary.videoToolbar.uploading")
          : t("mediaLibrary.videoToolbar.add")}
      </Button>

      <div className="flex-1" />

      <Select
        value={fileTypeFilter}
        onValueChange={(value) => {
          if (value !== null) onFileTypeFilterChange(value)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={t("mediaLibrary.videoToolbar.fileType")}
          className="h-8 w-36 text-xs"
        >
          <SelectValue>
            {fileTypeFilter === ALL_VIDEO_FILE_TYPES
              ? t("mediaLibrary.videoToolbar.allFileTypes")
              : fileTypeFilter}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VIDEO_FILE_TYPES}>
            {t("mediaLibrary.videoToolbar.allFileTypes")}
          </SelectItem>
          {fileTypes.map((fileType) => (
            <SelectItem key={fileType} value={fileType}>
              {fileType}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{t("mediaLibrary.videoToolbar.fileCount", { count: fileCount })}</span>
        <span>
          {t("mediaLibrary.videoToolbar.storageUsed", {
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
          placeholder={t("mediaLibrary.videoToolbar.search")}
          className="h-8 pl-8 text-xs"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
