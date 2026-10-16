# AI mentor (`/api/mentor`)

Route: `app/api/mentor/route.ts`. Model chain: `lib/mentor-models.ts`. Shared quota + log: `lib/mentor-store.ts` (Supabase, migration `supabase/migrations/0002_mentor.sql`). Owner status: `/ru/admin/mentor` + `app/api/mentor/status/route.ts`. Helpers: `lib/mentor-guard.ts` (output guard), `lib/mentor-server.ts` (rate-limit key, reply signatures, request checks), `lib/redact.ts` (personal data). Self-checks: `pnpm check:mentor`, `pnpm check:redact`.

## Env

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Google AI Studio key (free tier). Without it the mentor shows "not connected". |
| `MENTOR_SIGNING_SECRET` | Optional. HMAC key for reply signatures. If unset, derived from `GEMINI_API_KEY` (SHA-256, domain-separated). Rotating either one invalidates stored chat history (old replies are dropped, nothing breaks). |
| `SUPABASE_SECRET_KEY` | Optional, **server only**. Supabase secret key (`sb_secret_...`). Legacy projects: `SUPABASE_SERVICE_ROLE_KEY` (service_role JWT) instead. Together with `NEXT_PUBLIC_SUPABASE_URL` it turns on the shared quota and the request log. Never prefix it with `NEXT_PUBLIC_`. |
| `MENTOR_ADMIN_TOKEN` | Optional, server only. Token for `/ru/admin/mentor` (min 24 chars, e.g. `openssl rand -base64 32`). Unset = status API answers 404. |
| `MENTOR_IP_SALT` | Optional, server only. Base secret for `ip_hash`; defaults to the Supabase secret key. |
| `MENTOR_FAKE=1` | Local testing without Google: canned replies through the same guards. Ignored when `VERCEL_ENV=production`. Test hooks in the message: `#leak`, `#off`, `#busy`. |

## Limits

- Per server instance, in memory: 12 requests / 10 min per client (IPv4 address or IPv6 /64; on Vercel taken from `x-real-ip`).
- Model chain (`CHAIN` in `app/api/mentor/route.ts`): gemini-3.5-flash-lite (14 RPM / 500 RPD), gemini-2.5-flash-lite, gemini-3.8-flash, gemini-3-flash-preview, gemini-3.6-flash, gemini-2.5-flash (free tier, AI Studio, 2026-10-16). Each model has its own per-minute gate (a bit under its RPM); a model at its limit, or one whose 429 says exhausted (per-minute: retryDelay; per-day: until midnight Pacific), is skipped and the same request goes to the next model before anything is streamed. A 400 on a model's thinking config retries once without it.
- All models busy per-minute: `503 {error:'busy'}` with `Retry-After` <= 60 s and the chat shows a countdown. All models out of daily quota: `503 {error:'daily_limit'}`, no retry until tomorrow.
- `DAILY_CAP` = sum of the chain's RPD minus 5% (570), per instance.
- **Per-model RPM/RPD are shared across serverless instances when Supabase is configured**: before each upstream call the route calls `mentor_try_acquire(model_key, rpm, rpd)` (atomic, row lock; minute window = 60 s from its first request, day window = Pacific date), and an upstream 429 calls `mentor_mark_exhausted` so every instance skips that model until its reset. Without Supabase (or when it does not answer within 1.5 s; then it is skipped for 30 s) the same limits run per instance in memory, exactly as before.
- Quotas are per Google Cloud project, not per API key. Do NOT create extra projects or keys to multiply quota: it is against Google's terms.
- Body ≤ 64 KB, JSON only, same-origin only.

The per-client bucket and `DAILY_CAP` are still per instance ("limit × warm instances").

## Request log (Supabase, 7 days)

Only when Supabase is configured; otherwise the last 50 rows are kept in the memory of the instance (status page only).
One row per request that passed the per-client limiter (`public.mentor_log`):

- time, lesson slug, task id, locale, opaque model key (`m1`..`m6`, mapped to the vendor id only in server code), outcome (`ok`, `off_topic`, `identity`, `busy`, `daily_limit`, `error`, `rejected`), latency in ms;
- `ip_hash`: HMAC of the client key (IPv4 / IPv6 /64) with a salt derived from a server secret and the UTC date: links requests within one day, rotates daily, not reversible from the database;
- `redacted_question`: the last student message **after** personal-data redaction, cut to 500 characters, plus `pii_redacted` (whether something was replaced).

Never stored: model answers, raw IPs, unredacted text, code or console output.
Retention: rows older than 7 days are deleted by `mentor_purge_logs()` daily at 03:17 UTC (pg_cron, scheduled by the migration) and, as a fallback, by the API at most once an hour per instance.
Logging is fire-and-forget after the response (`after()`), with a 2 s timeout; a storage failure never breaks or slows a reply.

## Status page (owner only)

`/ru/admin/mentor` (or `/tj/...`): not linked, `noindex`, disallowed in `robots.txt`. Enter `MENTOR_ADMIN_TOKEN`; it is kept in `sessionStorage` of the tab and sent as `Authorization: Bearer`. Wrong token: 401; 5 failed attempts per client in 15 min: 429. Shows per model (real names) available / minute limit / exhausted until (local time), this minute vs RPM, today vs RPD; today's totals by outcome (Pacific day); the last 50 log rows. Without Supabase it says «хранилище не подключено» and shows the memory of the instance that answered.

## Known limits

- **Data goes to Google.** Student messages, the current task text, code and console output are sent to the Gemini API. Personal data (names, ages, phones, emails, Telegram handles, addresses, passport numbers) is redacted on the client and again on the server before sending; redaction is pattern-based and can miss unusual spellings.
- **Free tier:** Google may use prompts and responses on the free tier to improve its products (paid tier: no). That is why we redact before sending and ask students not to share personal data. The course is for adults (18+).
- **Identity filter is best effort.** Replies where the model names itself as a vendor model ("я — Gemini", "меня создал Google", homoglyphs, spaced letters, full-width) are replaced with the mentor identity line. Mentions of ChatGPT / Claude / Gemini as tools are allowed, because the course teaches them. Encoded leaks (char codes, base64, reversed text, letters spread across sentences) cannot be filtered. Rare false positive: a first-person sentence that also names a vendor ("мне кажется, ChatGPT…") is cut.
- **History integrity:** model turns from the client are accepted only with a server signature (HMAC over lesson + reply text), so a forged "mentor" turn is dropped. A student can still replay a genuine earlier reply of the same lesson; that is harmless.
- **Prompt injection** is reduced (student text and code are wrapped in delimiter tags, the system prompt treats them as data) but not impossible.
