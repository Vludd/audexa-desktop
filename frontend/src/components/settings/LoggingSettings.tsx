import { useSyncExternalStore } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Label } from "@/components/ui/label"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { t } from "@/i18n"

import type { LogLevel } from "@/types"

import {
  getLogStorageInfo,
  getLoggingSettings,
  setLoggingLevel,
  subscribeLoggingSettings,
} from "@/lib/logger"

export default function LoggingSettings() {
  const settings = useSyncExternalStore(
    subscribeLoggingSettings,
    getLoggingSettings,
  )

  const storage = getLogStorageInfo()

  const handleLevelChange = (
    value: string | null,
  ) => {
    if (
      value === "DEBUG" ||
      value === "INFO" ||
      value === "WARNING" ||
      value === "ERROR"
    ) {
      setLoggingLevel(
        value as LogLevel,
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {t(
            "settings.logging.title",
          )}
        </CardTitle>

        <CardDescription className="text-xs">
          {t(
            "settings.logging.description",
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>
            {t(
              "settings.logging.level",
            )}
          </Label>

          <Select
            value={settings.level}
            onValueChange={
              handleLevelChange
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="DEBUG">
                DEBUG
              </SelectItem>

              <SelectItem value="INFO">
                INFO
              </SelectItem>

              <SelectItem value="WARNING">
                WARNING
              </SelectItem>

              <SelectItem value="ERROR">
                ERROR
              </SelectItem>
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground">
            {t(
              "settings.logging.levelDescription",
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label>
            {t(
              "settings.logging.storage.title",
            )}
          </Label>

          <div className="rounded-md border bg-muted/30 px-3 py-2.5">
            <div className="text-sm font-medium">
              {storage.label}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              {storage.description}
            </div>

            {storage.type === "file" && (
              <div className="mt-2 break-all rounded bg-background px-2 py-1.5 font-mono text-xs">
                {storage.path}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            {t(
              "settings.logging.retention.title",
            )}
          </Label>

          <div className="rounded-md border bg-muted/30 px-3 py-2.5">
            <div className="text-sm font-medium">
              {t(
                "settings.logging.retention.value",
              )}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              {t(
                "settings.logging.retention.description",
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}