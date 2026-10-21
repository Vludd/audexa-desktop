export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00"
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`
}

export function getProgress(
  position: number,
  duration: number,
): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0
  }

  return Math.min(
    100,
    Math.max(0, (position / duration) * 100),
  )
}