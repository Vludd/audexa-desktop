import { useCallback, useState } from "react"

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void | Promise<void>
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [loading, setLoading] = useState(false)

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    setOptions(nextOptions)
  }, [])

  const close = useCallback(() => {
    if (!loading) {
      setOptions(null)
    }
  }, [loading])

  const handleConfirm = useCallback(async () => {
    if (!options) {
      return
    }

    try {
      setLoading(true)
      await options.onConfirm()
      setOptions(null)
    } finally {
      setLoading(false)
    }
  }, [options])

  return {
    confirm,
    close,
    handleConfirm,
    loading,
    options,
    open: options !== null,
  }
}