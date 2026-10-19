import type { Scenario } from "@/types"

export function getScenarioDuration(scenario: Scenario): number {
  return scenario.steps.reduce(
    (duration, step) =>
      duration + Math.max(step.duration, step.translationDuration) + step.delay,
    0,
  )
}
