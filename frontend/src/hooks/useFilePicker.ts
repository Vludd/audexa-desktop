import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

interface UseFilePickerOptions {
  /** File extensions such as ".mp3". Avoid MIME types; see the input configuration below. */
  accept: string[]
  multiple?: boolean
  onPick: (files: File[]) => void
}

/** Resolves after the browser has had a chance to paint the current state. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

export function useFilePicker({
  accept,
  multiple = false,
  onPick,
}: UseFilePickerOptions) {
  const inputRef = useRef<HTMLInputElement>(null)

  // State updates are asynchronous, so use a synchronous flag to block double clicks.
  const busyRef = useRef(false)

  const [isOpening, setIsOpening] = useState(false)

  const onPickRef = useRef(onPick)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  const finish = useCallback(() => {
    busyRef.current = false
    setIsOpening(false)
  }, [])

  useEffect(() => {
    const input = inputRef.current

    if (!input) {
      return
    }

    const handleChange = () => {
      const files = Array.from(input.files ?? [])

      // Clear the input so selecting the same file again triggers a change event.
      input.value = ""

      finish()

      if (files.length > 0) {
        onPickRef.current(files)
      }
    }

    // Chromium 113+ (including current WebView2) fires cancel when the dialog closes without a selection.
    const handleCancel = () => finish()

    input.addEventListener("change", handleChange)
    input.addEventListener("cancel", handleCancel)

    return () => {
      input.removeEventListener("change", handleChange)
      input.removeEventListener("cancel", handleCancel)

      busyRef.current = false
    }
  }, [finish])

  const open = useCallback(async () => {
    if (busyRef.current) {
      return
    }

    busyRef.current = true
    setIsOpening(true)

    // Let React commit the spinner and give the browser a chance to paint it before opening the native dialog.
    await nextPaint()

    // The component may have unmounted while waiting for the next paint.
    if (!busyRef.current) {
      return
    }

    try {
      inputRef.current?.click()
    } catch (error) {
      console.error("Failed to open file picker:", error)
      finish()
    }
  }, [finish])

  const inputProps = {
    ref: inputRef,
    type: "file" as const,
    multiple,
    // Use extensions only: Chromium on Windows resolves MIME types through the registry, which can delay opening the dialog.
    accept: accept.join(","),
    className: "hidden",
  }

  return {
    open,
    isOpening,
    inputProps,
  }
}