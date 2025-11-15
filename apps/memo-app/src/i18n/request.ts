import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export const locales = ["en", "fr", "nl"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  // Get locale from cookie or header
  const headersList = await headers();
  const cookieLocale = headersList.get("x-locale");

  let locale: Locale = "en";

  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    locale = cookieLocale as Locale;
  } else {
    // Fallback to accept-language header
    const acceptLanguage = headersList.get("accept-language");
    if (acceptLanguage) {
      const browserLang = acceptLanguage.split(",")[0].split("-")[0];
      if (locales.includes(browserLang as Locale)) {
        locale = browserLang as Locale;
      }
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
