"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n";

interface LocaleProviderProps {
  children: React.ReactNode;
  locale: Locale;
  messages: any;
}

export function LocaleProvider({
  children,
  locale: initialLocale,
  messages: initialMessages,
}: LocaleProviderProps) {
  const { data: session } = useSession();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState(initialMessages);

  useEffect(() => {
    async function loadUserLocale() {
      const user = session?.user as any;
      if (user?.language) {
        const userLocale = user.language as Locale;
        if (userLocale !== locale) {
          setLocale(userLocale);
          const newMessages = await import(`../../../messages/${userLocale}.json`);
          setMessages(newMessages.default);

          // Set cookie for future requests
          document.cookie = `locale=${userLocale}; path=/; max-age=31536000`;
        }
      }
    }

    loadUserLocale();
  }, [session, locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
