import { logger } from "@/lib/logger"
import { t } from "@/i18n"

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:5081"

export { API_BASE_URL }

/**
 * An HTTP response proves that the backend is reachable, even when the
 * requested operation failed with a 4xx/5xx status.
 */
export class ApiHttpError extends Error {
  readonly status: number
  readonly method: string
  readonly path: string

  constructor(status: number, message: string, method: string, path: string) {
    super(message)
    this.name = "ApiHttpError"
    this.status = status
    this.method = method
    this.path = path
  }
}

export type BackendConnectionState = "online" | "reconnecting" | "offline"

let connectionState: BackendConnectionState = "online"
let consecutiveNetworkFailures = 0
const backendListeners = new Set<(online: boolean) => void>()
const connectionStateListeners = new Set<
  (state: BackendConnectionState) => void
>()

function setConnectionState(nextState: BackendConnectionState): boolean {
  if (connectionState === nextState) {
    return false
  }

  const previousState = connectionState
  connectionState = nextState

  if (nextState === "online" && previousState !== "online") {
    logger.info(
      "NETWORK",
      "backend.reconnected",
      t("logs.messages.backendReconnected"),
    )
  } else if (nextState === "reconnecting" && previousState === "online") {
    logger.warn(
      "NETWORK",
      "backend.connection_lost",
      t("logs.messages.backendConnectionLost"),
    )
  } else if (nextState === "offline") {
    logger.error(
      "NETWORK",
      "backend.offline",
      t("logs.messages.backendOffline"),
    )
  }

  if ((previousState === "online") !== (nextState === "online")) {
    backendListeners.forEach((listener) => listener(nextState === "online"))
  }
  connectionStateListeners.forEach((listener) => listener(nextState))
  return true
}

export function isBackendOnline() {
  return connectionState === "online"
}

export function getBackendConnectionState(): BackendConnectionState {
  return connectionState
}

export function subscribeBackendConnectionState(
  listener: (state: BackendConnectionState) => void,
) {
  connectionStateListeners.add(listener)
  return () => {
    connectionStateListeners.delete(listener)
  }
}

export function subscribeBackendStatus(
  listener: (online: boolean) => void,
) {
  backendListeners.add(listener)

  return () => {
    backendListeners.delete(listener)
  }
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const method = options?.method ?? "GET"
  const url = apiUrl(path)
  const startedAt = performance.now()
  const headers = new Headers(options?.headers)

  if (!(options?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  logger.debug("API", "request.started", `${method} ${path}`, {
    method,
    path,
  })

  let response: Response

  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: options?.signal ?? AbortSignal.timeout(15_000),
    })
  } catch (error) {
    const errorName = error instanceof DOMException ? error.name : ""
    const isCallerAbort = errorName === "AbortError"
    const isTimeout = errorName === "TimeoutError"

    // A caller-initiated cancellation says nothing about backend availability.
    if (isCallerAbort) {
      throw error
    }

    consecutiveNetworkFailures += 1
    const nextState: BackendConnectionState =
      consecutiveNetworkFailures >= 2 ? "offline" : "reconnecting"
    const stateChanged = setConnectionState(nextState)

    if (stateChanged) {
      logger.error(
        "NETWORK",
        isTimeout ? "backend.timeout" : "backend.connection_failed",
        isTimeout
          ? t("logs.messages.requestTimedOut", { method, path })
          : t("logs.messages.connectionFailed"),
        {
          method,
          path,
          url,
          timeoutMs: isTimeout ? 15_000 : undefined,
          consecutiveFailures: consecutiveNetworkFailures,
          error: error instanceof Error ? error.message : String(error),
        },
      )
    }

    throw error
  }

  const durationMs = Math.round(performance.now() - startedAt)

  // Any HTTP response confirms transport-level connectivity. An API error
  // must not be confused with a lost connection.
  consecutiveNetworkFailures = 0
  setConnectionState("online")

  if (!response.ok) {
    let message = `HTTP ${response.status}`

    try {
      const body = await response.json()

      if (typeof body?.message === "string") {
        message = body.message
      } else if (typeof body?.title === "string") {
        message = body.title
      }
    } catch {
      // Response does not contain JSON.
    }

    logger[response.status >= 500 ? "error" : "warn"](
      "API",
      "request.failed",
      t("logs.messages.requestFailed", {
        method,
        path,
        status: response.status,
        message,
      }),
      {
        method,
        path,
        status: response.status,
        durationMs,
      },
    )

    throw new ApiHttpError(response.status, message, method, path)
  }

  logger.debug("API", "request.completed", `${method} ${path} → ${response.status}`, {
    method,
    path,
    status: response.status,
    durationMs,
  })

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
