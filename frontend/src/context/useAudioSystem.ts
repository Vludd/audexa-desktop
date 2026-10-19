import { useContext } from "react"

import {
  AudioSystemContext,
  type AudioSystemContextValue,
} from "./audioSystemContextValue"

export function useAudioSystem(): AudioSystemContextValue {
  const context = useContext(AudioSystemContext)

  if (!context) {
    throw new Error("useAudioSystem must be used inside AudioSystemProvider")
  }

  return context
}
