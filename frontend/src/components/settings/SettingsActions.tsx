import { Button } from "@/components/ui/button"
import { t } from "@/i18n"

interface Props {
  onSave?: () => void
  onReset?: () => void
}

export default function SettingsActions({
  onSave,
  onReset,
}: Props) {
  return (
    <div className="flex gap-2">
      <Button variant="success" onClick={onSave} disabled>
        {t("settings.actions.save")}
      </Button>

      <Button variant="outline" onClick={onReset} disabled>
        {t("settings.actions.reset")}
      </Button>
    </div>
  )
}