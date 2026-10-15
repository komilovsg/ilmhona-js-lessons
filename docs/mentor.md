# AI mentor (`/api/mentor`)

Route: `app/api/mentor/route.ts`. Helpers: `lib/mentor-guard.ts` (output guard), `lib/mentor-server.ts` (rate-limit key, reply signatures, request checks), `lib/redact.ts` (personal data). Self-checks: `pnpm check:mentor`, `pnpm check:redact`.

## Env

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Google AI Studio key (free tier). Without it the mentor shows "not connected". |
| `MENTOR_SIGNING_SECRET` | Optional. HMAC key for reply signatures. If unset, derived from `GEMINI_API_KEY` (SHA-256, domain-separated). Rotating either one invalidates stored chat history (old replies are dropped, nothing breaks). |
| `MENTOR_FAKE=1` | Local testing without Google: canned replies through the same guards. Ignored when `VERCEL_ENV=production`. Test hooks in the message: `#leak`, `#off`, `#busy`. |

## Limits (per server instance, in memory)

- 12 requests / 10 min per client (IPv4 address or IPv6 /64; on Vercel taken from `x-real-ip`).
- 10 upstream requests / min for everyone (`UPSTREAM_RPM`, a bit under the free-tier RPM; check AI Studio > Rate limit for the project's real number). Over it, or when Google answers 429, the API returns `503 {error:'busy'}` with `Retry-After` and the chat shows a countdown.
- 1500 requests / day for everyone (`DAILY_CAP`).
- Body ≤ 64 KB, JSON only, same-origin only.

Serverless instances do not share memory, so real ceilings are "limit × warm instances". Move to Vercel KV / Supabase when accounts exist.

## Known limits

- **Data goes to Google.** Student messages, the current task text, code and console output are sent to the Gemini API. Personal data (names, ages, phones, emails, Telegram handles, addresses, passport numbers) is redacted on the client and again on the server before sending; redaction is pattern-based and can miss unusual spellings.
- **Free tier:** Google may use prompts and responses on the free tier to improve its products (paid tier: no). That is why we redact before sending and ask students not to share personal data. The course is for adults (18+).
- **Identity filter is best effort.** Replies where the model names itself as a vendor model ("я — Gemini", "меня создал Google", homoglyphs, spaced letters, full-width) are replaced with the mentor identity line. Mentions of ChatGPT / Claude / Gemini as tools are allowed, because the course teaches them. Encoded leaks (char codes, base64, reversed text, letters spread across sentences) cannot be filtered. Rare false positive: a first-person sentence that also names a vendor ("мне кажется, ChatGPT…") is cut.
- **History integrity:** model turns from the client are accepted only with a server signature (HMAC over lesson + reply text), so a forged "mentor" turn is dropped. A student can still replay a genuine earlier reply of the same lesson; that is harmless.
- **Prompt injection** is reduced (student text and code are wrapped in delimiter tags, the system prompt treats them as data) but not impossible.
