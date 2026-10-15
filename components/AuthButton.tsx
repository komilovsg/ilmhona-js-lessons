'use client';

import Link from 'next/link';
import { useT } from './I18nProvider';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { SyncStatus } from '@/lib/sync';

const T = {
  signIn: 'Войти',
  dialogTitle: 'Вход в Ilmhona',
  dialogLead: 'Войдите, чтобы прогресс сохранялся на всех устройствах и попадал в рейтинг.',
  google: 'Войти через Google',
  or: 'или',
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  sendLink: 'Отправить ссылку',
  sending: 'Отправляем…',
  linkSent: 'Ссылка отправлена. Откройте письмо в этом же браузере.',
  close: 'Закрыть',
  account: 'Аккаунт',
  rename: 'Изменить имя',
  save: 'Сохранить',
  cancel: 'Отмена',
  nameLabel: 'Имя в рейтинге',
  nameInvalid: 'Имя: от 2 до 32 символов.',
  leaderboard: 'Рейтинг',
  signOut: 'Выйти',
  errGeneric: 'Не получилось. Попробуйте ещё раз.',
  errCallback: 'Не удалось войти: ссылка устарела или уже использована.',
  errRate: 'Слишком много попыток. Подождите минуту.',
  sync: {
    idle: '',
    syncing: 'Синхронизация…',
    synced: 'Прогресс сохранён в облаке',
    offline: 'Нет связи — сохраним позже',
  } satisfies Record<SyncStatus, string>,
};

type Profile = { display_name: string; avatar_url: string | null };
type Libs = { sb: SupabaseClient; sync: typeof import('@/lib/sync') };

const cleanName = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
const validName = (s: string) => s.length >= 2 && s.length <= 32;

function currentPath() {
  const url = new URL(window.location.href);
  url.searchParams.delete('auth_error');
  return url.pathname + url.search;
}
const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath())}`;

/** Self-contained: renders nothing (and loads nothing) unless Supabase env vars are set. */
export default function AuthButton() {
  if (!isSupabaseConfigured) return null;
  return <AuthButtonInner />;
}

function AuthButtonInner() {
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
              .select('display_name, avatar_url')
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
  }, []);

  // The dialog only exists once the auth state is known (signed out).
  useEffect(() => {
    if (openOnReady.current && user === null && dialogRef.current && !dialogRef.current.open) {
      openOnReady.current = false;
      dialogRef.current.showModal();
    }
  }, [user, libs]);

  if (user === undefined) return <span className="auth-placeholder" aria-hidden="true" />;

  if (!user || !libs) {
    return (
      <>
        <button
          type="button"
          className="auth-btn"
          aria-label={T.signIn}
          onClick={() => {
            setDialogError(null);
            dialogRef.current?.showModal();
          }}
        >
          <UserIcon />
          <span className="auth-btn-text">{T.signIn}</span>
        </button>
        <SignInDialog dialogRef={dialogRef} sb={libs?.sb ?? null} initialError={dialogError} />
      </>
    );
  }

  return <UserMenu libs={libs} user={user} profile={profile} setProfile={setProfile} syncStatus={syncStatus} />;
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

function UserMenu({
  libs,
  user,
  profile,
  setProfile,
  syncStatus,
}: {
  libs: Libs;
  user: User;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  syncStatus: SyncStatus;
}) {
  const { locale } = useT();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const meta = user.user_metadata ?? {};
  const name = profile?.display_name ?? cleanName(String(meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? ''));
  const avatar = profile?.avatar_url ?? null;
  const initial = (name || '?').charAt(0).toUpperCase();

  const close = useCallback(() => {
    setOpen(false);
    setEditing(false);
    setErr(null);
  }, []);

  useEffect(() => {
    if (!open) return;
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
    setProfile({ display_name: next, avatar_url: avatar });
    setEditing(false);
    setErr(null);
  }

  async function signOut() {
    setBusy(true);
    await libs.sync.flushSync(); // best effort; local progress is kept either way
    libs.sync.stopSync();
    await libs.sb.auth.signOut({ scope: 'local' });
    setBusy(false);
    close();
  }

  return (
    <div className="auth" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="auth-chip"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${T.account}: ${name}`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatar, tiny
          <img src={avatar} alt="" width={28} height={28} referrerPolicy="no-referrer" />
        ) : (
          <span className="auth-initial" aria-hidden="true">
            {initial}
          </span>
        )}
      </button>
      {open && (
        <div className="auth-menu" id={panelId}>
          {editing ? (
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
          )}
          <p className="auth-status err" role="status" aria-live="polite">
            {err}
          </p>
          {T.sync[syncStatus] && <p className={`auth-sync ${syncStatus}`}>{T.sync[syncStatus]}</p>}
          <Link className="auth-item" href={`/${locale}/leaderboard`} onClick={close}>
            <span aria-hidden="true">🏆</span>
            {T.leaderboard}
          </Link>
          <button type="button" className="auth-item" onClick={signOut} disabled={busy}>
            {T.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

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
