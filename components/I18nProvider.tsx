'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '@/lib/i18n';
import type { Messages } from '@/messages/ru';

type Ctx = { locale: Locale; t: Messages };

const I18nContext = createContext<Ctx | null>(null);

export default function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, t: messages }}>{children}</I18nContext.Provider>;
}

/** `const { t, locale } = useT(); t.toc.title` */
export function useT(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return ctx;
}
