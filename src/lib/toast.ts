import type { ReactNode } from "react"

export type ToastVariant = "success" | "info" | "warning" | "error"

export interface ToastOptions {
  description?: ReactNode
  duration?: number
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
  emit()
}

function show(
  variant: ToastVariant,
  title: string,
  options: ToastOptions = {},
) {
  const id = nextId++
  const duration = options.duration ?? (variant === "error" ? 7000 : 4000)

  items = [
    ...items,
    {
      id,
      variant,
      title,
      description: options.description,
      duration,
    },
  ]

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
