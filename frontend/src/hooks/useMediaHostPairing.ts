import { useState } from "react"

import { mediaHostsApi, type MediaHostPairingCreated } from "@/api/mediaHosts"
import { t } from "@/i18n"

export function useMediaHostPairing() {
  const [showPairingForm, setShowPairingForm] = useState(false)
  const [pairingName, setPairingName] = useState("")
  const [pairingDescription, setPairingDescription] = useState("")
  const [pairing, setPairing] = useState<MediaHostPairingCreated | null>(null)
  const [pairingError, setPairingError] = useState("")
  const [pairingBusy, setPairingBusy] = useState(false)

  async function createPairing() {
    setPairingBusy(true)
    setPairingError("")

    try {
      const createdPairing = await mediaHostsApi.createPairing({
        hostName: pairingName.trim(),
        description: pairingDescription.trim() || undefined,
      })
      setPairing(createdPairing)
      setPairingName("")
      setPairingDescription("")
      setShowPairingForm(false)
    } catch (error) {
      setPairingError(
        error instanceof Error
          ? error.message
          : t("mediaHosts.pairing.createError"),
      )
    } finally {
      setPairingBusy(false)
    }
  }

  function togglePairingForm() {
    setShowPairingForm((current) => !current)
    setPairingError("")
  }

  function closePairing() {
    setPairing(null)
  }

  return {
    showPairingForm,
    pairingName,
    setPairingName,
    pairingDescription,
    setPairingDescription,
    pairing,
    pairingError,
    pairingBusy,
    createPairing,
    togglePairingForm,
    closePairing,
  }
}
