export const locales = ["en", "fr", "nl"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  nl: "Nederlands",
};

export function getLocaleFromBrowser(): Locale {
  if (typeof window === "undefined") return "en";

  const browserLang = navigator.language.split("-")[0];
  return locales.includes(browserLang as Locale)
    ? (browserLang as Locale)
    : "en";
}
