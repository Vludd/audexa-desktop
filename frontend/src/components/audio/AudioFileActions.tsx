import { Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { t } from "@/i18n"

interface Props {
  onRename?: () => void
  onDelete?: () => void
  alwaysVisible?: boolean
}

export default function AudioFileActions({
  onRename,
  onDelete,
  alwaysVisible = false,
}: Props) {
  return (
    <div
      className={[
        "flex items-center justify-end gap-0.5 transition-opacity",
        !alwaysVisible &&
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        title={t("audio.actions.rename")}
        className="text-muted-foreground hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation()
          onRename?.()
        }}
      >
        <Pencil className="size-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon-xs"
        title={t("audio.actions.delete")}
        className="text-muted-foreground hover:text-destructive"
        onClick={(event) => {
          event.stopPropagation()
          onDelete?.()
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
