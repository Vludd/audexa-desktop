export function isDesktopApp(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  const windowWithBridge = window as Window & {
    chrome?: {
      webview?: {
        postMessage?: (message: unknown) => void
      }
    }
  }

  return typeof windowWithBridge.chrome?.webview?.postMessage === "function"
}