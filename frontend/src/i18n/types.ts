export const SUPPORTED_LOCALES = ["ru", "en", "kz"] as const

export type Locale = typeof SUPPORTED_LOCALES[number]

export type TranslationPath<T,> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${TranslationPath<T[Key]>}`
      : never
}[keyof T & string]

export type TranslationTree = {
  [key: string]: string | TranslationTree
}
