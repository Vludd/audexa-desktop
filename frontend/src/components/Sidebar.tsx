import {
  Calendar,
  DoorOpen,
  Home,
  List,
  Music,
  ScrollText,
  Settings,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { t, type TranslationKey } from "@/i18n"
import type { Page } from "../types"

interface Props {
  current: Page
  onChange: (page: Page) => void
}

const NAV: { page: Page; labelKey: TranslationKey; Icon: typeof Home }[] = [
  { page: "dashboard", labelKey: "nav.dashboard", Icon: Home },
  { page: "rooms", labelKey: "nav.rooms", Icon: DoorOpen },
  { page: "scenarios", labelKey: "nav.scenarios", Icon: List },
  { page: "schedule", labelKey: "nav.schedule", Icon: Calendar },
  { page: "audiofiles", labelKey: "nav.audioFiles", Icon: Music },
]

const UTILITY_NAV: { page: Page; labelKey: TranslationKey; Icon: typeof Home }[] = [
  { page: "settings", labelKey: "nav.settings", Icon: Settings },
  { page: "logs", labelKey: "nav.logs", Icon: ScrollText },
]

export default function Sidebar({ current, onChange }: Props) {
  return (
    <aside className="flex w-16 shrink-0 flex-col border-r bg-card lg:w-[228px]">
      <div className="border-b px-2 pb-3.5 pt-4 lg:px-4">
        <div className="flex items-center justify-center gap-2.5 lg:justify-start">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#17345f] to-[#2563eb] shadow-sm">
            <svg width="21" height="21" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M3 11 C3 6.5 6.5 3 11 3 C15.5 3 19 6.5 19 11" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="11" cy="11" r="3" fill="white" />
              <path d="M7 15 L5 18 M15 15 L17 18 M11 14 L11 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className="hidden min-w-0 lg:block">
            <div className="text-[13px] font-bold leading-4 text-foreground">AUDEXA</div>
            <div className="text-[10px] font-bold tracking-[0.04em] leading-3 text-primary">AUDIO CONTROL</div>
          </div>
        </div>

        <p className="mt-2 hidden text-[10px] leading-3.5 text-muted-foreground lg:block">
          {t("nav.description")}
        </p>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col p-2">
        <div className="flex flex-col gap-0.5">
          {NAV.map(({ page, labelKey, Icon }) => {
          const active = current === page
          return (
            <button
              key={page}
              type="button"
              onClick={() => onChange(page)}
              aria-label={t(labelKey)}
              title={t(labelKey)}
              className={cn(
                "flex h-8 w-full items-center justify-center gap-2 rounded-md px-0 text-left text-[13px] transition-colors lg:justify-start lg:px-2.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="hidden lg:inline">{t(labelKey)}</span>
            </button>
          )
          })}
        </div>

        <div className="mt-auto border-t pt-2">
          <div className="flex flex-col gap-0.5">
            {UTILITY_NAV.map(({ page, labelKey, Icon }) => {
              const active = current === page
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => onChange(page)}
                  aria-label={t(labelKey)}
                  title={t(labelKey)}
                  className={cn(
                    "flex h-8 w-full items-center justify-center gap-2 rounded-md px-0 text-left text-[13px] transition-colors lg:justify-start lg:px-2.5",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden lg:inline">{t(labelKey)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </aside>
  )
}
