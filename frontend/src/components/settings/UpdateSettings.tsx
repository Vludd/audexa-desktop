
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Download, RefreshCw } from "lucide-react"

import { updatesApi, type UpdateCheckResponse } from "@/api/updates"
import { t } from "@/i18n"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { isDesktopApp } from "@/lib/desktop"

interface WebViewBridge {
  postMessage: (message: { type: "install-update" }) => void
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<{ type?: string; message?: string }>) => void,
  ) => void
  removeEventListener: (
    type: "message",
    listener: (event: MessageEvent<{ type?: string; message?: string }>) => void,
  ) => void
}

type VersionComparison = -1 | 0 | 1

function compareVersions(
  left: string,
  right: string,
): VersionComparison | null {
  const normalize = (version: string) => {
    const value = version.trim().replace(/^v/i, "").split("+", 1)[0]
    const prereleaseSeparator = value.indexOf("-")
    const release =
      prereleaseSeparator === -1
        ? value
        : value.slice(0, prereleaseSeparator)
    const prerelease =
      prereleaseSeparator === -1
        ? null
        : value.slice(prereleaseSeparator + 1)
    const parts = release.split(".")

    if (
      parts.length === 0 ||
      parts.some((part) => !/^\d+$/.test(part))
    ) {
      return null
    }

    return {
      parts: parts.map(Number),
      prerelease: prerelease?.split(".") ?? null,
    }
  }

  const a = normalize(left)
  const b = normalize(right)

  if (!a || !b) return null

  const length = Math.max(a.parts.length, b.parts.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = a.parts[index] ?? 0
    const rightPart = b.parts[index] ?? 0

    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1
    }
  }

  if (a.prerelease === null && b.prerelease === null) return 0
  if (a.prerelease === null) return 1
  if (b.prerelease === null) return -1

  const prereleaseLength = Math.max(
    a.prerelease.length,
    b.prerelease.length,
  )

  for (let index = 0; index < prereleaseLength; index += 1) {
    const leftPart = a.prerelease[index]
    const rightPart = b.prerelease[index]

    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue

    const leftNumeric = /^\d+$/.test(leftPart)
    const rightNumeric = /^\d+$/.test(rightPart)

    if (leftNumeric && rightNumeric) {
      return Number(leftPart) > Number(rightPart) ? 1 : -1
    }

    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    return leftPart > rightPart ? 1 : -1
  }

  return 0
}

function getWebViewBridge(): WebViewBridge | null {
  const windowWithBridge = window as Window & {
    chrome?: { webview?: WebViewBridge }
  }

  return windowWithBridge.chrome?.webview ?? null
}

export default function UpdateSettings() {
  const isDesktop = isDesktopApp()

  const [update, setUpdate] = useState<UpdateCheckResponse | null>(
    () => updatesApi.getCached(),
  )

  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [installRequested, setInstallRequested] = useState(false)

  const [hasLoaded, setHasLoaded] = useState(
    () => Boolean(updatesApi.getCached()),
  )

  const isLoading = isChecking || (isDesktop && !hasLoaded)
  const versionComparison = update
    ? compareVersions(update.currentVersion, update.latestVersion)
    : null

  const checkForUpdates = useCallback(
    async (force = false) => {
      if (!isDesktop) return

      setIsChecking(true)
      setError(null)

      try {
        const result = await updatesApi.check(force)
        setUpdate(result)
        setLastCheckedAt(new Date())
        setHasLoaded(true)
      } catch (checkError) {
        setError(
          checkError instanceof Error
            ? checkError.message
            : t("settings.updates.checkFailed"),
        )
        setHasLoaded(true)
      } finally {
        setIsChecking(false)
      }
    },
    [isDesktop],
  )

  useEffect(() => {
    const bridge = getWebViewBridge()
    if (!bridge) return

    const handleBridgeMessage = (
      event: MessageEvent<{ type?: string; message?: string }>,
    ) => {
      if (event.data?.type !== "install-update-failed") return

      setInstallRequested(false)
      setError(event.data.message || t("settings.updates.installFailed"))
    }

    bridge.addEventListener("message", handleBridgeMessage)

    return () => {
      bridge.removeEventListener("message", handleBridgeMessage)
    }
  }, [])

  useEffect(() => {
    if (!isDesktop || updatesApi.getCached()) {
      return
    }

    let cancelled = false

    updatesApi.check().then(
      (result) => {
        if (cancelled) return

        setUpdate(result)
        setLastCheckedAt(new Date())
        setHasLoaded(true)
      },
      (checkError: unknown) => {
        if (cancelled) return

        setError(
          checkError instanceof Error
            ? checkError.message
            : t("settings.updates.checkFailed"),
        )
        setHasLoaded(true)
      },
    )

    return () => {
      cancelled = true
    }
  }, [isDesktop])

  const installUpdate = () => {
    if (!isDesktop) return

    const bridge = getWebViewBridge()

    if (!bridge) {
      setError(t("settings.updates.desktopOnly"))
      return
    }

    setError(null)
    setInstallRequested(true)
    bridge.postMessage({ type: "install-update" })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Download className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle>{t("settings.updates.title")}</CardTitle>
            <CardDescription className="mt-1">
              {t("settings.updates.description")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isDesktop ? (
          <p
            className="flex items-start gap-2 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{t("settings.updates.desktopOnly")}</span>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t("settings.updates.currentVersion")}
                </p>
                <p className="font-mono text-sm font-medium">
                  {update?.currentVersion ?? "—"}
                </p>
              </div>

              {update && (
                <div className="space-y-1 sm:text-right">
                  <p className="text-xs text-muted-foreground">
                    {t("settings.updates.latestVersion")}
                  </p>
                  <p className="font-mono text-sm font-medium">
                    {update.latestVersion}
                  </p>
                </div>
              )}
            </div>

            {isLoading && (
              <p
                className="flex items-center gap-2 text-sm text-muted-foreground"
                role="status"
              >
                <RefreshCw className="size-4 animate-spin" />
                {t("settings.updates.checking")}
              </p>
            )}

            {!isLoading && update && !update.updateAvailable && (
              <p
                className={`flex items-center gap-2 text-sm ${
                  versionComparison === 1
                    ? "text-sky-600 dark:text-sky-400"
                    : versionComparison === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                }`}
                role="status"
              >
                {versionComparison === 0 ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <AlertCircle className="size-4" />
                )}
                {versionComparison === 1
                  ? t("settings.updates.newerThanLatest")
                  : versionComparison === 0
                    ? t("settings.updates.upToDate")
                    : t("settings.updates.versionComparisonUnavailable")}
              </p>
            )}

            {!isLoading && update?.updateAvailable && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Download className="size-4" />
                  {t("settings.updates.available", {
                    version: update.latestVersion,
                  })}
                </p>

                {update.releaseNotes && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {update.releaseNotes}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p
                className="flex items-start gap-2 text-sm text-destructive"
                role="alert"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            {installRequested && (
              <p className="text-sm text-muted-foreground" role="status">
                {t("settings.updates.startingInstall")}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {lastCheckedAt
                  ? t("settings.updates.lastChecked", {
                      time: lastCheckedAt.toLocaleTimeString(),
                    })
                  : t("settings.updates.notChecked")}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void checkForUpdates(true)}
                  disabled={isLoading || installRequested}
                >
                  <RefreshCw
                    className={isLoading ? "animate-spin" : ""}
                  />
                  {t("settings.updates.checkButton")}
                </Button>

                {update?.updateAvailable && (
                  <Button
                    type="button"
                    onClick={installUpdate}
                    disabled={isLoading || installRequested}
                  >
                    <Download />
                    {t("settings.updates.installButton")}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
