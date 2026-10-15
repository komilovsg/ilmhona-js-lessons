'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALE_COOKIE, locales, type Locale } from '@/lib/i18n';
import { useT } from './I18nProvider';

const YEAR = 60 * 60 * 24 * 365;

function setCookie(l: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${YEAR}; samesite=lax`;
}

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const { t, locale } = useT();
  const rest = pathname.replace(/^\/[^/]+/, '');

  return (
    <div className="lang-switch" role="group" aria-label={t.lang.label}>
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest}`}
          hrefLang={l}
          lang={l}
          aria-current={l === locale ? 'true' : undefined}
          title={l === 'ru' ? t.lang.ruName : t.lang.tgName}
          onClick={() => setCookie(l)}
        >
          {t.lang[l]}
        </Link>
      ))}
    </div>
  );
}
