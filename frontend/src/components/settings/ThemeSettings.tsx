import { Monitor, Moon, Paintbrush, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTheme, type Theme } from "@/components/ThemeContext"
import { t } from "@/i18n"

const THEMES: { value: Theme; Icon: typeof Sun }[] = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
]

export default function ThemeSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Paintbrush className="size-4" />
        </div>
        <div className="min-w-0 text-left">
          <div className="text-sm font-medium text-foreground">
            {t("theme.title")}
          </div>
          <div className="text-left text-xs text-muted-foreground">
            {t("theme.description")}
          </div>
        </div>
      </div>

      <div
        className="ml-auto flex shrink-0 items-center gap-1 rounded-md border bg-background p-1"
        role="group"
        aria-label={t("theme.title")}
      >
        {THEMES.map(({ value, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={theme === value}
            aria-label={t(`theme.${value}`)}
            title={t(`theme.${value}`)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              theme === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span>{t(`theme.${value}`)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
