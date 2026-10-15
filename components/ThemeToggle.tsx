'use client';

import { useEffect, useState } from 'react';
import { fmt } from '@/lib/i18n';
import { isTheme, readTheme, resolveTheme, THEME_KEY, themes, type Theme } from '@/lib/theme';
import { useT } from './I18nProvider';

const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = resolveTheme(theme);
};

const icons: Record<Theme, React.ReactNode> = {
  // sun
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  // moon
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  // auto: half-filled circle
  system: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" />
    </>
  ),
};

export default function ThemeToggle() {
  const { t } = useT();
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    // Stored value is only readable on the client; sync after mount to keep hydration identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) {
        const next = isTheme(e.newValue) ? e.newValue : 'system';
        setTheme(next);
        apply(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const cycle = () => {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(next);
    apply(next);
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={fmt(t.theme.label, { current: t.theme[theme] })}
      title={t.theme[theme]}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icons[theme]}
      </svg>
    </button>
  );
}
