declare global {
  interface Window {
    audexa?: {
      desktop?: boolean
    }
  }
}

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" &&
    window.audexa?.desktop === true
}