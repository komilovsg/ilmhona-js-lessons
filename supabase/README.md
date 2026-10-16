# Supabase: accounts, progress sync, leaderboard

The backend is optional. Without the env vars below the site works fully local (progress in
`localStorage`, no "Войти" button, no network calls). With them, students can sign in (Google or an
email link opened in the same browser), their progress syncs across devices, and `/leaderboard`
shows the top 50 of the students who opted in (signed-in visitors only).

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

## 2b. Mentor quota + request log (`0002_mentor.sql`)

Optional, independent of sign-in. Run [`migrations/0002_mentor.sql`](migrations/0002_mentor.sql) in the SQL Editor
after 0001 (safe to re-run). It creates `mentor_model_usage` (shared per-model RPM/RPD counters) and `mentor_log`
(one row per mentor request, redacted, kept 7 days), the service-role-only functions `mentor_try_acquire`,
`mentor_mark_exhausted`, `mentor_outcome_totals`, `mentor_purge_logs`, and schedules the daily purge with pg_cron
(**Database → Cron** shows the job `mentor-purge`; if pg_cron is unavailable the migration prints a notice and the API
purges hourly instead). Both tables have RLS on and no policies: the publishable/anon key cannot read or write them.

Then set the server-only variables (section 6): `SUPABASE_SECRET_KEY` and, for the status page, `MENTOR_ADMIN_TOKEN`.
What is logged and the status page: [`docs/mentor.md`](../docs/mentor.md).

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
2. **OAuth consent screen**: External, app name "MakeFirstStep", your support email. Scopes: the default
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
- **Google is the primary sign-in.** The email link is a fallback.
- **Same browser only.** Magic links use PKCE: the link works only in the browser where the
  student requested it (requested on a school PC → open the email on that PC). Keep the default
  **Magic Link** / **Confirm signup** templates. Do **not** switch them to a `token_hash` link:
  `/auth/callback` accepts only the PKCE `code` on purpose, because a `token_hash` link signs in
  whoever opens it, so an attacker could send a student a link that logs them into the
  attacker's account (login CSRF).

## 6. Environment variables

Dashboard → **Project Settings → API Keys** (and **Data API** for the URL):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the **publishable** key, `sb_publishable_...` |

| `SUPABASE_SECRET_KEY` | mentor only, **server-only**: a **secret** key, `sb_secret_...` (legacy projects: the `service_role` key in `SUPABASE_SERVICE_ROLE_KEY`) |
| `MENTOR_ADMIN_TOKEN` | mentor status page, server-only: a long random string (`openssl rand -base64 32`) |

Older projects that only show the legacy JWT keys: put the **anon** key into
`NEXT_PUBLIC_SUPABASE_ANON_KEY` instead (used only when the publishable key is empty).
Never put the `service_role` / `sb_secret_...` key into the frontend: no `NEXT_PUBLIC_` prefix, never in client code.
It bypasses RLS; only `lib/mentor-store.ts` (server) reads it. In Vercel mark it **Sensitive**. Without it the mentor
works as before (per-instance memory limits, no log).

- **Local**: copy `.env.example` to `.env.local`, fill in, restart `pnpm dev`.
- **Vercel**: Project → **Settings → Environment Variables** → add both for Production (and Preview
  if you want), then **redeploy** — `NEXT_PUBLIC_*` values are baked in at build time.

The two `NEXT_PUBLIC_*` values are public by design; the data is protected by Row Level Security in the migration.
`SUPABASE_SECRET_KEY` and `MENTOR_ADMIN_TOKEN` are secrets and take effect without a rebuild (redeploy is enough).

## 7. Check it works

1. Open the site → **Войти** → sign in with Google.
2. Solve a task; in Supabase **Table Editor → task_progress** a row appears within ~1 s.
3. Open the site on another device/browser, sign in with the same account → progress is there.
4. Avatar menu → enable **«Показывать меня в рейтинге»** → `/leaderboard` shows you highlighted.
   New accounts start as a pseudonym («Ученик 3f9a»); rename yourself from the same menu.
5. Signed out, `/leaderboard` asks you to sign in (the function is not callable by `anon`).

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
- Leaderboard privacy: **opt-in and sign-in only.** `profiles.show_on_leaderboard` defaults to
  `false`; only students who switch it on in the account menu are listed (name + avatar become
  visible to every signed-in student). Anonymous visitors can't call `leaderboard()` at all.
  New accounts get a random pseudonym («Ученик 3f9a»): the name is never taken from the email or
  the Google profile, so nothing personal is shown until the student chooses to.
- Names: 2–32 chars, at least one letter or digit, no control / invisible / bidi / filler
  characters (checked by the database and by the client).
- Sync: on sign-in, local and cloud progress are merged (union; earliest solve time, max XP,
  union of hints). Afterwards every change is sent within ~1 s, retried when offline. Signing out
  keeps local progress. If a *different* account signs in on the same browser, it gets its own
  cloud progress and the previous student's progress is not copied into it.
- Deleting a solved mark ("unmark") deletes it in the cloud, but another device that still has the
  task marked will add it back on its next sign-in/page load (merge is a union).
- XP is reported by the browser, so a determined student could fake rows through the API
  (max 40 XP per row, max 1000 rows; the cap is race-safe via a per-user advisory lock). Fine for a classroom leaderboard; a server-side task list or
  an Edge Function that checks solutions would close this.

## Известные ограничения

Known ceilings, accepted for a classroom deployment:

- **XP is client-reported** (see above). Upgrade path: server-side task catalog or an Edge
  Function that validates solutions before awarding XP.
- **Leaderboard has no cache.** Every visit to `/leaderboard` calls `public.leaderboard()` directly.
  Fine at classroom scale. Upgrade path: a cached Next.js route handler (`revalidate = 60`) in front
  of the RPC.
- **esm.sh without SRI.** The React playground imports React from `https://esm.sh` without
  Subresource Integrity. Impact is limited because student code runs in a sandboxed `srcdoc`
  iframe with an opaque origin (no access to the site's cookies or storage). Upgrade path:
  self-host the vendor ESM bundles under `/vendor/`.
- **Avatars are Google-only.** The migration keeps `avatar_url` only for Google sign-ups and only
  for `https://lhN.googleusercontent.com/` URLs; email sign-ups always show the initial. Avatars
  appear on the leaderboard only for students who opted in.
- **CSP is enforced** (`next.config.ts`). It stays loose enough for student code (srcdoc runner
  frames inherit it); a separate runner origin would allow a strict policy on the main pages.
