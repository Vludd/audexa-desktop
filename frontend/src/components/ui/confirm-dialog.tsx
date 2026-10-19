import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { t } from "@/i18n"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  loading?: boolean
  onConfirm: () => void | Promise<void>
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = t("common.confirm"),
  cancelLabel = t("common.cancel"),
  variant = "default",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (loading) return

    await onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="w-full"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>

            {description && (
              <AlertDialogDescription>
                {description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-4 flex-row justify-end gap-2">
            <AlertDialogCancel disabled={loading}>
              {cancelLabel}
            </AlertDialogCancel>

            <Button
              type="submit"
              autoFocus
              variant={variant === "destructive" ? "destructive" : "default"}
              disabled={loading}
            >
              {loading ? t("common.executing") : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}