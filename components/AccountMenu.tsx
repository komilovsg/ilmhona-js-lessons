'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALE_COOKIE, locales, toUrlLocale, type Locale } from '@/lib/i18n';
import { isTheme, readTheme, resolveTheme, THEME_KEY, type Theme } from '@/lib/theme';
import { useT } from './I18nProvider';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { footerLabels } from '@/lib/legal';
import { isSafeAvatar } from '@/lib/avatar';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { SyncStatus } from '@/lib/sync';


type Profile = { display_name: string; avatar_url: string | null; show_on_leaderboard: boolean };
type Libs = { sb: SupabaseClient; sync: typeof import('@/lib/sync') };

// Control chars + invisible/bidi/filler chars (same set as the profiles CHECK in 0001_init.sql).
const cleanName = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u115f\u1160\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2069\u3164\ufeff\uffa0]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
// The CHECK also requires at least one letter or digit.
const validName = (s: string) => s.length >= 2 && s.length <= 32 && /[\p{L}\p{N}]/u.test(s);

function currentPath() {
  const url = new URL(window.location.href);
  url.searchParams.delete('auth_error');
  return url.pathname + url.search;
}
const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath())}`;

/** Always rendered: language + theme (+ leaderboard) for everyone; auth items only when Supabase env vars are set. */
export default function AccountMenu() {
  if (!isSupabaseConfigured) return <MenuView />;
  return <AuthAccount />;
}

const YEAR = 60 * 60 * 24 * 365;
const setLocaleCookie = (l: Locale) => {
  document.cookie = `${LOCALE_COOKIE}=${toUrlLocale(l)}; path=/; max-age=${YEAR}; samesite=lax`;
};

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = resolveTheme(theme);
};

function useThemeSetting(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    // Stored value is only readable on the client; sync after mount to keep hydration identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) {
        const next = isTheme(e.newValue) ? e.newValue : 'system';
        setTheme(next);
        applyTheme(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
  const set = useCallback((next: Theme) => {
    setTheme(next);
    applyTheme(next);
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {}
  }, []);
  return [theme, set];
}

function AuthAccount() {
  const T = useT().t.auth;
  const [libs, setLibs] = useState<Libs | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const [profile, setProfile] = useState<Profile | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openOnReady = useRef(false);

  // Load the SDK lazily and follow the auth state.
  useEffect(() => {
    let alive = true;
    let unsubAuth: (() => void) | undefined;
    let unsubSync: (() => void) | undefined;
    (async () => {
      const [{ getBrowserSupabase }, sync] = await Promise.all([import('@/lib/supabase/client'), import('@/lib/sync')]);
      const sb = getBrowserSupabase();
      if (!alive || !sb) return;
      // Coming back from a failed /auth/callback: show the reason in the dialog.
      const url = new URL(window.location.href);
      if (url.searchParams.has('auth_error')) {
        url.searchParams.delete('auth_error');
        window.history.replaceState(window.history.state, '', url);
        setDialogError(T.errCallback);
        openOnReady.current = true;
      }
      setLibs({ sb, sync });
      unsubSync = sync.onSyncStatus(setSyncStatus);
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        // Don't await Supabase calls inside this callback (auth lock); defer instead.
        setTimeout(() => {
          if (!alive) return;
          const u = session?.user ?? null;
          setUser(u);
          if (u) {
            sync.startSync(sb, u.id);
            void sb
              .from('profiles')
              .select('display_name, avatar_url, show_on_leaderboard')
              .eq('id', u.id)
              .maybeSingle()
              .then(({ data: p }) => alive && setProfile((p as Profile | null) ?? null));
          } else {
            sync.stopSync();
            setProfile(null);
          }
        }, 0);
      });
      unsubAuth = () => data.subscription.unsubscribe();
    })();
    return () => {
      alive = false;
      unsubAuth?.();
      unsubSync?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once; the message is read only at mount
  }, []);

  // The dialog only exists once the auth state is known (signed out).
  useEffect(() => {
    if (openOnReady.current && user === null && dialogRef.current && !dialogRef.current.open) {
      openOnReady.current = false;
      dialogRef.current.showModal();
    }
  }, [user, libs]);

  const openEmail = () => {
    setDialogError(null);
    dialogRef.current?.showModal();
  };

  return (
    <>
      <MenuView
        auth={{
          libs,
          user: user ?? null,
          loading: user === undefined,
          profile,
          setProfile,
          syncStatus,
          onEmail: openEmail,
          onGoogle: libs
            ? async () => {
                const { error } = await libs.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } });
                if (error) {
                  setDialogError(T.errGeneric);
                  dialogRef.current?.showModal();
                }
              }
            : undefined,
        }}
      />
      {user === null && <SignInDialog dialogRef={dialogRef} sb={libs?.sb ?? null} initialError={dialogError} />}
    </>
  );
}

function SignInDialog({
  dialogRef,
  sb,
  initialError,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  sb: SupabaseClient | null;
  initialError: string | null;
}) {
  const T = useT().t.auth;
  const titleId = useId();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const shown = msg ?? (initialError ? { kind: 'err' as const, text: initialError } : null);

  async function google() {
    if (!sb) return;
    setBusy(true);
    setMsg(null);
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } });
    if (error) {
      setBusy(false);
      setMsg({ kind: 'err', text: T.errGeneric });
    }
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    if (!sb || busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setMsg({ kind: 'err', text: error.status === 429 ? T.errRate : T.errGeneric });
    else setMsg({ kind: 'ok', text: T.linkSent });
  }

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close(); // backdrop click
      }}
      onClose={() => setMsg(null)}
    >
      <div className="auth-dialog-body">
        <button type="button" className="auth-close" aria-label={T.close} onClick={() => dialogRef.current?.close()}>
          ×
        </button>
        <h2 id={titleId}>{T.dialogTitle}</h2>
        <p className="auth-lead">{T.dialogLead}</p>
        <button type="button" className="auth-google" onClick={google} disabled={!sb || busy}>
          <GoogleIcon />
          {T.google}
        </button>
        <div className="auth-or">
          <span>{T.or}</span>
        </div>
        <form onSubmit={sendLink} className="auth-form">
          <label>
            <span>{T.emailLabel}</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder={T.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button type="submit" className="auth-primary" disabled={!sb || busy}>
            {busy ? T.sending : T.sendLink}
          </button>
        </form>
        <p className={`auth-status${shown ? ` ${shown.kind}` : ''}`} role="status" aria-live="polite">
          {shown?.text}
        </p>
      </div>
    </dialog>
  );
}

type AuthProps = {
  libs: Libs | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  syncStatus: SyncStatus;
  onEmail: () => void;
  onGoogle?: () => void;
};

function MenuView({ auth }: { auth?: AuthProps }) {
  const { locale, t } = useT();
  const T = t.auth;
  const legal = footerLabels(locale);
  const pathname = usePathname();
  const rest = pathname.replace(/^\/[^/]+/, '');
  const [theme, setTheme] = useThemeSetting();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const user = auth?.user ?? null;
  const libs = auth?.libs ?? null;
  const profile = auth?.profile ?? null;
  const signedIn = !!user && !!libs;
  const name = signedIn ? (profile?.display_name ?? '') : '';
  const avatar = isSafeAvatar(profile?.avatar_url) ? profile.avatar_url : null;
  const initial = (name || '?').charAt(0).toUpperCase();

  const close = useCallback(() => {
    setOpen(false);
    setEditing(false);
    setErr(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!signedIn) return;
    const next = cleanName(draft);
    if (!validName(next)) {
      setErr(T.nameInvalid);
      return;
    }
    setBusy(true);
    const { error } = await libs.sb.from('profiles').update({ display_name: next }).eq('id', user.id);
    setBusy(false);
    if (error) {
      setErr(T.errGeneric);
      return;
    }
    if (profile) auth?.setProfile({ ...profile, display_name: next });
    setEditing(false);
    setErr(null);
  }

  async function toggleBoard(next: boolean) {
    if (!signedIn || !profile) return;
    setBusy(true);
    const { error } = await libs.sb.from('profiles').update({ show_on_leaderboard: next }).eq('id', user.id);
    setBusy(false);
    if (error) {
      setErr(T.errGeneric);
      return;
    }
    auth?.setProfile({ ...profile, show_on_leaderboard: next });
    setErr(null);
  }

  async function signOut() {
    if (!libs) return;
    setBusy(true);
    await libs.sync.flushSync(); // best effort; local progress is kept either way
    libs.sync.stopSync();
    await libs.sb.auth.signOut({ scope: 'local' });
    setBusy(false);
    close();
  }

  const themeOptions: { id: Theme; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: t.nav.themeLight, icon: <SunIcon /> },
    { id: 'dark', label: t.nav.themeDark, icon: <MoonIcon /> },
    { id: 'system', label: t.nav.themeAuto, icon: <AutoIcon /> },
  ];

  const hasAuthBlock = !!auth && !auth.loading;

  return (
    <div
      className="auth"
      ref={wrapRef}
      onBlur={(e) => {
        if (open && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget as Node)) close();
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className="auth-chip"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={signedIn ? `${t.nav.account}: ${name}` : t.nav.account}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {signedIn && avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatar, tiny
          <img src={avatar} alt="" width={28} height={28} referrerPolicy="no-referrer" />
        ) : signedIn ? (
          <span className="auth-initial" aria-hidden="true">
            {initial}
          </span>
        ) : (
          <span className="auth-initial auth-anon" aria-hidden="true">
            <UserIcon />
          </span>
        )}
        <svg className="auth-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="auth-menu" id={panelId} ref={panelRef} role="dialog" aria-label={t.nav.account} tabIndex={-1}>
          {signedIn &&
            (editing ? (
              <form className="auth-rename" onSubmit={saveName}>
                <label>
                  <span>{T.nameLabel}</span>
                  <input
                    autoFocus
                    value={draft}
                    maxLength={32}
                    minLength={2}
                    required
                    onChange={(e) => setDraft(e.target.value)}
                    aria-invalid={!!err}
                  />
                </label>
                <div className="auth-row">
                  <button type="submit" className="auth-primary" disabled={busy}>
                    {T.save}
                  </button>
                  <button type="button" className="auth-ghost" onClick={() => (setEditing(false), setErr(null))}>
                    {T.cancel}
                  </button>
                </div>
              </form>
            ) : (
              <div className="auth-who">
                <b>{name}</b>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    setDraft(name);
                    setEditing(true);
                  }}
                >
                  {T.rename}
                </button>
                {user.email && <small>{user.email}</small>}
              </div>
            ))}
          {signedIn && profile && (
            <label className="auth-toggle">
              <input
                type="checkbox"
                checked={profile.show_on_leaderboard}
                disabled={busy}
                onChange={(e) => void toggleBoard(e.target.checked)}
                aria-describedby={`${panelId}-board-hint`}
              />
              <span>{T.showOnBoard}</span>
              <small id={`${panelId}-board-hint`}>{T.showOnBoardHint}</small>
            </label>
          )}
          {signedIn && (
            <p className="auth-status err" role="status" aria-live="polite">
              {err}
            </p>
          )}
          {signedIn && T.sync[auth!.syncStatus] && <p className={`auth-sync ${auth!.syncStatus}`}>{T.sync[auth!.syncStatus]}</p>}
          {hasAuthBlock && !signedIn && (
            <div className="auth-sec">
              <button type="button" className="auth-item" onClick={() => (close(), auth.onGoogle?.())} disabled={!auth.onGoogle}>
                <GoogleIcon />
                {T.google}
              </button>
              {/* email magic links need custom SMTP (Supabase's built-in mailer only reaches org members) */}
              {process.env.NEXT_PUBLIC_AUTH_EMAIL === '1' && (
                <button type="button" className="auth-item" onClick={() => (close(), auth.onEmail())}>
                  <MailIcon />
                  {t.nav.signInEmail}
                </button>
              )}
            </div>
          )}
          <div className={hasAuthBlock || signedIn ? 'auth-sec' : undefined}>
            <Link className="auth-item" href={`/${toUrlLocale(locale)}/leaderboard`} onClick={close}>
              <span aria-hidden="true">🏆</span>
              {T.leaderboard}
            </Link>
          </div>
          <div className="auth-sec auth-legal">
            <Link className="auth-item" href={`/${toUrlLocale(locale)}/privacy`} onClick={close}>
              {legal.privacy}
            </Link>
            <Link className="auth-item" href={`/${toUrlLocale(locale)}/terms`} onClick={close}>
              {legal.terms}
            </Link>
          </div>
          <div className="auth-sec">
            <p className="auth-h" id={`${panelId}-lang`}>
              {t.lang.label}
            </p>
            <div className="seg" role="group" aria-labelledby={`${panelId}-lang`}>
              {locales.map((l) => (
                <Link
                  key={l}
                  href={`/${toUrlLocale(l)}${rest}`}
                  hrefLang={l}
                  lang={l}
                  aria-current={l === locale ? 'true' : undefined}
                  title={l === 'ru' ? t.lang.ruName : t.lang.tgName}
                  onClick={() => setLocaleCookie(l)}
                >
                  {t.lang[l]}
                </Link>
              ))}
            </div>
            <p className="auth-h" id={`${panelId}-theme`}>
              {t.nav.theme}
            </p>
            <div className="seg seg-3" role="group" aria-labelledby={`${panelId}-theme`}>
              {themeOptions.map((o) => (
                <button key={o.id} type="button" aria-pressed={theme === o.id} onClick={() => setTheme(o.id)}>
                  {o.icon}
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {signedIn && (
            <div className="auth-sec">
              <button type="button" className="auth-item" onClick={signOut} disabled={busy}>
                <SignOutIcon />
                {T.signOut}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ico = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
const SunIcon = () => (
  <svg {...ico}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = () => (
  <svg {...ico}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
const AutoIcon = () => (
  <svg {...ico}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" />
  </svg>
);
const MailIcon = () => (
  <svg {...ico}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </svg>
);
const SignOutIcon = () => (
  <svg {...ico}>
    <path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3M16 8l4 4-4 4M20 12H9" />
  </svg>
);

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
