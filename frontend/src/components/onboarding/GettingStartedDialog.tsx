import { useState } from "react"
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Headphones,
  Home,
  Image as ImageIcon,
  ListOrdered,
  Music2,
  Workflow,
} from "lucide-react"

import { t } from "@/i18n"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const steps = [
  { key: "welcome", icon: Headphones, imagePath: "/images/onboarding/welcome.jpg" },
  { key: "rooms", icon: DoorOpen, imagePath: "/images/onboarding/rooms.jpg" },
  { key: "audio", icon: Music2, imagePath: "/images/onboarding/audio.jpg" },
  { key: "scenarios", icon: Workflow, imagePath: "/images/onboarding/scenarios.jpg" },
  { key: "scenarioSteps", icon: ListOrdered, imagePath: "/images/onboarding/scenario-steps.jpg" },
  { key: "schedule", icon: CalendarClock, imagePath: "/images/onboarding/schedule.jpg" },
  { key: "dashboard", icon: Home, imagePath: "/images/onboarding/dashboard.jpg" },
] as const

export default function GettingStartedDialog({ open, onOpenChange }: Props) {
  const [index, setIndex] = useState(0)
  const current = steps[index]
  const Icon = current.icon
  const close = () => {
    setIndex(0)
    onOpenChange(false)
  }

  const next = () => {
    if (index === steps.length - 1) {
      close()
      return
    }
    setIndex((value) => Math.min(steps.length - 1, value + 1))
  }

  return (
    <Dialog open={open} onOpenChange={(value) => value ? onOpenChange(true) : close()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[600px] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0"
      >
        <div className="shrink-0 space-y-5 p-6 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              AUDEXA · QUICK START
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("onboarding.stepOf", { current: index + 1, total: steps.length })}
            </span>
          </div>

          <div className="flex gap-1.5" aria-label={t("onboarding.title")}>
            {steps.map((step, stepIndex) => (
              <div
                key={step.key}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  stepIndex <= index ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-5">
          <div className="flex h-[250px] shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/20">
            {current.imagePath ? (
              <img
                src={current.imagePath}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="size-7" />
                <span className="text-xs">Illustration placeholder</span>
              </div>
            )}
          </div>

          <DialogHeader className="mt-5 min-h-0 flex-1 space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <DialogTitle className="text-xl">
                {t(`onboarding.steps.${current.key}.title`)}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              {t(`onboarding.steps.${current.key}.description`)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <DialogFooter className="mt-auto shrink-0 flex-row items-center justify-between border-t bg-muted/20 px-8 pb-8 sm:justify-between">
          <Button variant="ghost" onClick={close}>
            {t("onboarding.skip")}
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={index === 0}
            >
              <ChevronLeft className="mr-1 size-4" />
              {t("onboarding.previous")}
            </Button>
            <Button onClick={next}>
              {index === steps.length - 1 ? t("onboarding.finish") : t("onboarding.next")}
              {index === steps.length - 1 ? (
                <Check className="ml-1 size-4" />
              ) : (
                <ChevronRight className="ml-1 size-4" />
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
