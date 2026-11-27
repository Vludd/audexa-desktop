import {
  Calendar,
  DoorOpen,
  Home,
  List,
  Music,
  Monitor,
  ScrollText,
  Settings,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { t, type TranslationKey } from "@/i18n"
import type { Page } from "../types"
import audexaIcon from "../../../assets/branding/audexa-icon.svg"

interface Props {
  current: Page
  onChange: (page: Page) => void
}

const NAV: { page: Page; labelKey: TranslationKey; Icon: typeof Home }[] = [
  { page: "dashboard", labelKey: "nav.dashboard", Icon: Home },
  { page: "rooms", labelKey: "nav.rooms", Icon: DoorOpen },
  { page: "scenarios", labelKey: "nav.scenarios", Icon: List },
  { page: "schedule", labelKey: "nav.schedule", Icon: Calendar },
  { page: "medialibrary", labelKey: "nav.mediaLibrary", Icon: Music },
  { page: "mediahosts", labelKey: "nav.mediaHosts", Icon: Monitor },
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
          <div className="size-9 shrink-0 overflow-hidden rounded-lg shadow-sm">
            <img src={audexaIcon} alt="" className="size-full" />
          </div>

          <div className="hidden min-w-0 lg:block">
            <div className="text-[13px] font-bold leading-4 text-foreground">AUDEXA</div>
            <div className="text-[10px] font-bold tracking-[0.04em] leading-3 text-primary">MEDIA CONTROL</div>
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
