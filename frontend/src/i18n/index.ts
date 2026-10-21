import { useSyncExternalStore } from "react"

import { en } from "./locales/en"
import { kz } from "./locales/kz"
import { ru } from "./locales/ru"
import type { Locale, TranslationPath, TranslationTree } from "./types"

export type TranslationKey = TranslationPath<typeof ru>

const dictionaries: Record<Locale, TranslationTree> = { ru, en, kz }

export const DEFAULT_LOCALE: Locale = "ru"
export const SUPPORTED_UI_LOCALES: Locale[] = ["ru", "en"]

const STORAGE_KEY = "audexa.locale"

let currentLocale: Locale = DEFAULT_LOCALE
const listeners = new Set<() => void>()

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "en" || stored === "ru" ? stored : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

if (typeof window !== "undefined") {
  currentLocale = getStoredLocale()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return currentLocale
}

export function setLocale(locale: Locale) {
  if (!SUPPORTED_UI_LOCALES.includes(locale) || locale === currentLocale) {
    return
  }

  currentLocale = locale

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // The selected locale remains active for the current session.
    }
  }

  listeners.forEach((listener) => listener())
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LOCALE)

  return {
    locale,
    setLocale,
  }
}

function resolveKey(
  dictionary: TranslationTree,
  key: string,
): string | undefined {
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[part]
  }, dictionary)

  return typeof value === "string" ? value : undefined
}

export function t(
  key: TranslationKey,
  variables?: Record<string, string | number>,
): string {
  const value = resolveKey(dictionaries[currentLocale], key)

  if (!value) {
    return key
  }

  if (!variables) {
    return value
  }

  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(variables[name] ?? `{${name}}`),
  )
}

export function formatDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const locale =
    currentLocale === "kz"
      ? "kk-KZ"
      : currentLocale === "en"
        ? "en-US"
        : "ru-RU"

  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(date)
}

export function formatTime(date: Date): string {
  const locale =
    currentLocale === "kz"
      ? "kk-KZ"
      : currentLocale === "en"
        ? "en-US"
        : "ru-RU"

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

export { dictionaries }
export type { Locale }
