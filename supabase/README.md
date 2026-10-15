# Supabase: accounts, progress sync, leaderboard

The backend is optional. Without the env vars below the site works fully local (progress in
`localStorage`, no "Войти" button, no network calls). With them, students can sign in (Google or an
email link), their progress syncs across devices, and `/leaderboard` shows the top 50.

Everything fits the Supabase **free** plan.

## 1. Create the project

1. Sign in at <https://supabase.com/dashboard> → **New project**.
2. Pick a name, a strong database password (store it; the app does not need it) and the region
   closest to the students (e.g. Frankfurt `eu-central-1`).
3. Wait until the project is ready (~2 min).

## 2. Create the tables (run the migration)

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the whole of [`migrations/0001_init.sql`](migrations/0001_init.sql) and press **Run**.
   It is safe to run again later.
3. Check: **Table Editor** shows `profiles` and `task_progress`, both marked **RLS enabled**.

(With the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push`.)

## 3. URLs

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: your production URL, e.g. `https://ilmhona.vercel.app`
- **Redirect URLs** — add all of:
  - `http://localhost:3000/**`
  - `https://ilmhona.vercel.app/**` (your real Vercel domain)
  - optional, for Vercel preview deployments: `https://*-<your-team>.vercel.app/**`

The `/**` matters: the app returns to `/auth/callback?next=<page you were on>`.

## 4. Google sign-in

1. Google Cloud Console → <https://console.cloud.google.com/apis/credentials> (create a project if needed).
2. **OAuth consent screen**: External, app name "Ilmhona", your support email. Scopes: the default
   `email`, `profile`, `openid` are enough. Publish the app (otherwise only test users can sign in).
3. **Credentials → Create credentials → OAuth client ID** → type **Web application**.
   - **Authorized JavaScript origins**: `http://localhost:3000`, `https://ilmhona.vercel.app`
   - **Authorized redirect URIs**: the callback shown in Supabase at
     **Authentication → Sign In / Providers → Google** — it looks like
     `https://<project-ref>.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret** into Supabase → **Authentication → Sign In / Providers → Google**,
   enable it, save.

## 5. Email magic link

Email sign-in is on by default (**Authentication → Sign In / Providers → Email**). Two things to know:

- **The built-in mailer is for testing only.** It sends very few emails per hour and, on current
  plans, only to members of your Supabase organization. For a real class, set up custom SMTP:
  **Authentication → Emails → SMTP Settings** (e.g. Resend, Brevo or Mailgun free tiers; you need a
  domain you control). Until then use Google sign-in.
- **Same browser by default.** The default email template uses a PKCE link, which only works in the
  browser where the student requested it. To make links work on any device (e.g. requested on a
  school PC, opened on a phone), change **both** the **Magic Link** and the **Confirm signup**
  templates (**Authentication → Emails → Templates**; a student's very first link uses
  "Confirm signup") to:

  ```html
  <h2>Вход в Ilmhona</h2>
  <p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/">Войти</a></p>
  ```

  Keep `type=email` — it works for both new and returning students.

  The `/auth/callback` route accepts both kinds of link. (A link opened on another device
  signs in *that* device.)

## 6. Environment variables

Dashboard → **Project Settings → API Keys** (and **Data API** for the URL):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the **publishable** key, `sb_publishable_...` |

Older projects that only show the legacy JWT keys: put the **anon** key into
`NEXT_PUBLIC_SUPABASE_ANON_KEY` instead (used only when the publishable key is empty).
Never put the `service_role` / `sb_secret_...` key into the frontend.

- **Local**: copy `.env.example` to `.env.local`, fill in, restart `pnpm dev`.
- **Vercel**: Project → **Settings → Environment Variables** → add both for Production (and Preview
  if you want), then **redeploy** — `NEXT_PUBLIC_*` values are baked in at build time.

Both values are public by design; the data is protected by Row Level Security in the migration.

## 7. Check it works

1. Open the site → **Войти** → sign in with Google.
2. Solve a task; in Supabase **Table Editor → task_progress** a row appears within ~1 s.
3. Open the site on another device/browser, sign in with the same account → progress is there.
4. `/leaderboard` shows you highlighted. Rename yourself from the avatar menu.

## Free plan caveat: the project pauses

Free projects are **paused after ~7 days without activity** (no API requests). While paused, the
site still works locally, sign-in and sync just fail quietly ("Нет связи — сохраним позже"); local
progress is not lost and syncs after the project is back.

To unpause: Dashboard → the project → **Restore project** (takes a few minutes). Data is kept.
Paused projects that stay paused for a long time (90 days) can no longer be restored from the
dashboard, so unpause before a new course starts. Any regular use during the course (students
opening the site while signed in) keeps it awake.

Other free-plan limits (500 MB database, 50k monthly active users) are far above what a class needs.

## How it works / limits

- Tables: `profiles` (display name, avatar), `task_progress` (one row per solved task: lesson,
  task, solved time, auto-checked flag, opened hints, XP 0–40). Each user can read and change
  only their own rows. Other users' data is never readable; the leaderboard is a database function
  that returns only rank, name, avatar, XP total and solved count.
- Sync: on sign-in, local and cloud progress are merged (union; earliest solve time, max XP,
  union of hints). Afterwards every change is sent within ~1 s, retried when offline. Signing out
  keeps local progress. If a *different* account signs in on the same browser, it gets its own
  cloud progress and the previous student's progress is not copied into it.
- Deleting a solved mark ("unmark") deletes it in the cloud, but another device that still has the
  task marked will add it back on its next sign-in/page load (merge is a union).
- XP is reported by the browser, so a determined student could fake rows through the API
  (max 40 XP per row, max 1000 rows). Fine for a classroom leaderboard; a server-side task list or
  an Edge Function that checks solutions would close this.
