import { useEffect, useMemo, useState } from "react"
import { ThemeContext, type Theme } from "@/components/ThemeContext"

type ResolvedTheme = "light" | "dark"

const STORAGE_KEY = "audexa-theme"

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getInitialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark" || stored === "system") return stored
  } catch {
    // Use the system preference when browser storage is unavailable.
  }

  return "system"
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => setSystemTheme(mediaQuery.matches ? "dark" : "light")

    handleChange()
    mediaQuery.addEventListener("change", handleChange)

    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme

  useEffect(() => {
    applyTheme(resolvedTheme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Theme selection still applies for the current session.
    }
  }, [theme, resolvedTheme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: setThemeState,
      toggleTheme: () =>
        setThemeState((current) => {
          if (current === "system") return resolvedTheme === "dark" ? "light" : "dark"
          return current === "dark" ? "light" : "dark"
        }),
    }),
    [theme, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
