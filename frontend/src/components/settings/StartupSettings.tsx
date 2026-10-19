import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { t } from "@/i18n"

const OPTIONS = [
  "settings.startup.autoStart",
  "settings.startup.recovery",
  "settings.startup.restoreProfile",
  "settings.startup.errorNotifications",
] as const

/**
 * These are planned settings for the future standalone desktop package.
 * They remain visible for planning, but are intentionally disabled until
 * the desktop shell and startup/recovery behavior are implemented.
 */
export default function StartupSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {t("settings.startup.title")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t("settings.startup.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {OPTIONS.map((key) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4"
          >
            <Label className="cursor-not-allowed font-normal text-muted-foreground">
              {t(key)}
            </Label>

            <Switch checked={false} disabled aria-label={t(key)} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
