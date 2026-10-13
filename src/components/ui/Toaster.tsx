import { useSyncExternalStore } from "react"
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react"

import {
  getToasts,
  subscribeToasts,
  toast,
  type ToastItem,
} from "@/lib/toast"
import { cn } from "@/lib/utils"
import { t } from "@/i18n"

const variantStyles = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    progressClass: "bg-emerald-500",
  },
  info: {
    icon: Info,
    iconClass: "text-blue-600 dark:text-blue-400",
    progressClass: "bg-blue-500",
  },
  warning: {
    icon: TriangleAlert,
    iconClass: "text-amber-600 dark:text-amber-400",
    progressClass: "bg-amber-500",
  },
  error: {
    icon: XCircle,
    iconClass: "text-destructive",
    progressClass: "bg-destructive",
  },
} as const

function ToastCard({ item }: { item: ToastItem }) {
  const variant = variantStyles[item.variant]
  const Icon = variant.icon

  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      className="group relative w-[360px] overflow-hidden rounded-xl border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3 pr-6">
        <Icon className={cn("mt-0.5 size-5 shrink-0", variant.iconClass)} />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{item.title}</p>
          {item.description ? (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        aria-label={t("common.closeNotification")}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100"
        onClick={() => toast.dismiss(item.id)}
      >
        <X className="size-4" />
      </button>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 origin-left",
          variant.progressClass,
        )}
        style={{ animation: `toast-progress ${item.duration}ms linear forwards` }}
      />
    </div>
  )
}

export default function Toaster() {
  const items = useSyncExternalStore(
    subscribeToasts,
    getToasts,
    getToasts,
  )

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard item={item} />
        </div>
      ))}
    </div>
  )
}
