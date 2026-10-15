export type Theme = 'light' | 'dark' | 'system';
// Legacy 'ilmhona:' prefix kept on purpose (renaming would reset saved themes).
export const THEME_KEY = 'ilmhona:theme';
export const themes: Theme[] = ['system', 'light', 'dark'];

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system';

export const resolveTheme = (t: Theme): 'light' | 'dark' =>
  t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Blocking inline script for <head>: sets data-theme before first paint. Keep in sync with resolveTheme. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;
