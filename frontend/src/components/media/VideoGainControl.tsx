import { useEffect, useRef, useState } from "react"

import type { VideoFile } from "@/api/video"
import { Slider } from "@/components/ui/slider"
import { t } from "@/i18n"

interface Props {
  item: VideoFile
  disabled: boolean
  onSave: (gainDb: number) => Promise<boolean>
}

export default function VideoGainControl({ item, disabled, onSave }: Props) {
  const [gainDb, setGainDb] = useState(item.gainDb)
  const gainDbRef = useRef(gainDb)
  const committedGainDbRef = useRef(gainDb)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (draggingRef.current) return
    setGainDb(item.gainDb)
    gainDbRef.current = item.gainDb
    committedGainDbRef.current = item.gainDb
  }, [item.gainDb])

  const commit = async () => {
    const nextGainDb = gainDbRef.current
    draggingRef.current = false
    if (nextGainDb === committedGainDbRef.current) return
    if (await onSave(nextGainDb)) {
      committedGainDbRef.current = nextGainDb
      return
    }

    gainDbRef.current = committedGainDbRef.current
    setGainDb(committedGainDbRef.current)
  }

  return (
    <div className="mt-2 flex max-w-sm items-center gap-3">
      <span className="shrink-0 text-[11px] text-muted-foreground" aria-live="polite">
        {t("mediaHosts.playback.videoGain", { gain: `${gainDb > 0 ? "+" : ""}${gainDb}` })}
      </span>
      <Slider
        aria-label={t("mediaHosts.playback.videoGainControl", { name: item.name })}
        value={[gainDb]}
        min={-24}
        max={24}
        step={1}
        disabled={disabled}
        onValueChange={(value) => {
          const nextGainDb = typeof value === "number" ? value : value[0]
          if (nextGainDb !== undefined) {
            gainDbRef.current = nextGainDb
            setGainDb(nextGainDb)
          }
        }}
        onPointerDown={() => { draggingRef.current = true }}
        onPointerUp={() => { void commit() }}
        onKeyDown={() => { draggingRef.current = true }}
        onKeyUp={() => { void commit() }}
      />
    </div>
  )
}
