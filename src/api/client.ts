import { logger } from "@/lib/logger"

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:5081"

export { API_BASE_URL }

let backendOnline = true
const backendListeners = new Set<(online: boolean) => void>()

function setBackendOnline(online: boolean) {
  if (backendOnline === online) {
    return
  }

  const wasOnline = backendOnline
  backendOnline = online

  if (online && !wasOnline) {
    logger.info(
      "NETWORK",
      "backend.reconnected",
      "Соединение с backend восстановлено",
    )
  }

  backendListeners.forEach((listener) => listener(online))
}

export function isBackendOnline() {
  return backendOnline
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
    const isAbort =
      error instanceof DOMException && error.name === "AbortError"

    if (isAbort) {
      logger.error("NETWORK", "backend.timeout", `Таймаут запроса ${method} ${path}`, {
        method,
        path,
        timeoutMs: 15_000,
      })
    } else {
      logger.error(
        "NETWORK",
        "backend.connection_failed",
        "Не удалось установить соединение с backend",
        {
          method,
          path,
          url,
          error: error instanceof Error ? error.message : String(error),
        },
      )
    }

    setBackendOnline(false)
    throw error
  }

  const durationMs = Math.round(performance.now() - startedAt)

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

    const level = response.status >= 500 ? "ERROR" : "WARNING"

    logger[level === "ERROR" ? "error" : "warn"](
      "API",
      "request.failed",
      `${method} ${path} → ${response.status}: ${message}`,
      {
        method,
        path,
        status: response.status,
        durationMs,
      },
    )

    setBackendOnline(true)
    throw new Error(message)
  }

  setBackendOnline(true)

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
