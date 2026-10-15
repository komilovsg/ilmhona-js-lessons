'use client';

import { createContext, useContext } from 'react';
import { getMessages, type Locale } from '@/lib/i18n';
import type { Messages } from '@/messages/ru';

type Ctx = { locale: Locale; t: Messages };

const I18nContext = createContext<Ctx | null>(null);

// Takes only the locale: dictionaries contain functions, which cannot cross the server -> client boundary as props.
export default function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, t: getMessages(locale) }}>{children}</I18nContext.Provider>;
}

/** `const { t, locale } = useT(); t.toc.title` */
export function useT(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return ctx;
}
