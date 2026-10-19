import { logger } from "@/lib/logger"
import { t } from "@/i18n"

let installed = false

export function installRuntimeLogging() {
  if (installed || typeof window === "undefined") {
    return () => undefined
  }

  installed = true

  const handleError = (event: ErrorEvent) => {
    logger.error("APP", "runtime.error", event.message || t("logs.messages.unknownRuntimeError"), {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    })
  }

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    logger.error("APP", "runtime.unhandled_rejection", t("logs.messages.unhandledPromise"), {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  }

  const handleOnline = () => {
    logger.info("NETWORK", "browser.online", t("logs.messages.connectionRestored"))
  }

  const handleOffline = () => {
    logger.warn("NETWORK", "browser.offline", t("logs.messages.noNetwork"))
  }

  window.addEventListener("error", handleError)
  window.addEventListener("unhandledrejection", handleUnhandledRejection)
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)

  logger.info("APP", "app.started", t("logs.messages.appStarted"), {
    apiBaseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:5081",
    userAgent: navigator.userAgent,
  })

  return () => {
    window.removeEventListener("error", handleError)
    window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
    installed = false
  }
}
