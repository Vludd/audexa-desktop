import { Monitor, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/ThemeContext"
import { t } from "@/i18n"

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  return (
    <div
      className="flex shrink-0 items-center rounded-md border bg-background p-0.5"
      aria-label={t("theme.title")}
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label={t("theme.light")}
        title={t("theme.light")}
        aria-pressed={theme === "light"}
        className={cn(
          "flex h-6 min-w-8 items-center justify-center rounded px-1.5 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          theme === "light"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Sun className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label={t("theme.dark")}
        title={t("theme.dark")}
        aria-pressed={theme === "dark"}
        className={cn(
          "flex h-6 min-w-8 items-center justify-center rounded px-1.5 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          theme === "dark"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Moon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        aria-label={t("theme.system")}
        title={t("theme.system")}
        aria-pressed={theme === "system"}
        className={cn(
          "flex h-6 min-w-8 items-center justify-center rounded px-1.5 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          theme === "system"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Monitor className="size-3.5" />
      </button>
    </div>
  )
}
