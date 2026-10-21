import type { ReactNode } from "react"

import { logger } from "@/lib/logger"

export type ToastVariant = "success" | "info" | "warning" | "error"

export interface ToastOptions {
  description?: ReactNode
  duration?: number
  /** Collapse identical notifications while one is still visible. */
  dedupeKey?: string
  /** Disable automatic UI-log recording when the originating subsystem already logs the event. */
  logError?: boolean
}

export interface ToastItem {
  id: number
  variant: ToastVariant
  title: string
  description?: ReactNode
  duration: number
}

type Listener = () => void

let nextId = 1
let items: ToastItem[] = []
const listeners = new Set<Listener>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const activeDedupeKeys = new Map<string, number>()
const MAX_VISIBLE_TOASTS = 5

function emit() {
  listeners.forEach((listener) => listener())
}

function remove(id: number) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }

  items = items.filter((item) => item.id !== id)
  for (const [key, activeId] of activeDedupeKeys) {
    if (activeId === id) activeDedupeKeys.delete(key)
  }
  emit()
}

function show(
  variant: ToastVariant,
  title: string,
  options: ToastOptions = {},
) {
  const dedupeKey = options.dedupeKey ?? `${variant}:${title}`
  const existingId = activeDedupeKeys.get(dedupeKey)
  if (existingId !== undefined && items.some((item) => item.id === existingId)) {
    return existingId
  }

  const id = nextId++
  const duration = options.duration ?? (variant === "error" ? 7000 : 4000)
  const item: ToastItem = {
    id,
    variant,
    title,
    description: options.description,
    duration,
  }

  items = [...items, item]
  activeDedupeKeys.set(dedupeKey, id)

  while (items.length > MAX_VISIBLE_TOASTS) {
    const evicted = items.shift()
    if (evicted) {
      const timer = timers.get(evicted.id)
      if (timer) clearTimeout(timer)
      timers.delete(evicted.id)
      for (const [key, activeId] of activeDedupeKeys) {
        if (activeId === evicted.id) activeDedupeKeys.delete(key)
      }
    }
  }

  if (variant === "error" && options.logError !== false) {
    logger.error("UI", "notification.error", title, {
      dedupeKey,
      description: typeof options.description === "string" ? options.description : undefined,
    })
  }

  emit()
  timers.set(id, setTimeout(() => remove(id), duration))
  return id
}

export const toast = {
  success(title: string, options?: ToastOptions) {
    return show("success", title, options)
  },
  info(title: string, options?: ToastOptions) {
    return show("info", title, options)
  },
  warning(title: string, options?: ToastOptions) {
    return show("warning", title, options)
  },
  error(title: string, options?: ToastOptions) {
    return show("error", title, options)
  },
  dismiss(id: number) {
    remove(id)
  },
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToasts() {
  return items
}
