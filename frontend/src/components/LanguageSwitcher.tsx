import { Check, Globe2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { t, useLocale, type Locale } from "@/i18n"

const LANGUAGES: { value: Locale; label: string; short: string }[] = [
  { value: "ru", label: "Русский", short: "RU" },
  { value: "en", label: "English", short: "EN" },
  { value: "kz", label: "Қазақша", short: "KZ" },
]

interface Props {
  compact?: boolean
}

export default function LanguageSwitcher({ compact = false }: Props) {
  const unavailableLanguages = ["kz"]
  const { locale, setLocale } = useLocale()

  if (compact) {
    return (
      <div
        className="flex items-center rounded-md border bg-background p-0.5"
        aria-label={t("language.label")}
      >
        {LANGUAGES.map((language) => {
          const active = locale === language.value

          return (
            <button
              key={language.value}
              type="button"
              onClick={() => setLocale(language.value)}
              aria-pressed={active}
              hidden={unavailableLanguages.includes(language.value)}
              className={cn(
                "h-6 min-w-8 rounded px-1.5 text-[10px] font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {language.short}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Globe2 className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {t("language.title")}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("language.description")}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-md border bg-background p-1">
        {LANGUAGES.map((language) => {
          const active = locale === language.value

          return (
            <button
              key={language.value}
              type="button"
              onClick={() => setLocale(language.value)}
              hidden={unavailableLanguages.includes(language.value)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {active && <Check className="size-3.5" />}
              {language.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
