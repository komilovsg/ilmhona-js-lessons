# ARCH-SPEC — third course "React Pro + Next.js" (Level 3)

Status: approved by lead 2026-10-27. Builds on `docs/course/vibe-coding/ARCH-SPEC.md` (already implemented: `lib/courses.ts`, per-course progress by key prefix, YouTube/quiz/checklist/submit-link blocks). Read that spec and the current code first. Same "Must NOT change" rules apply to the frontend course and now also to the vibe-coding course (its URLs, progress keys `vc-*`, texts).

Owner decisions: separate roadmap (own map, own progress), it is Level 3 — the continuation of «Frontend + ИИ» (Level 2), whose finish card «Уровень 3 — React Pro + Next.js» must now lead to it. YouTube videos with preview in lessons. ru + tg. Brand MakeFirstStep only.

## Decisions

| Topic | Decision |
|---|---|
| Course id / URL / key prefix | `react-next`, `/{ru,tj}/react-next`, `/{ru,tj}/react-next/lessons/<slug>`, progress keys `rn-<slug>` |
| Registry | `content/react-next/course.ts` (same shape and `texts` as `content/vibe-coding/course.ts`), data from `docs/course/react-next/plan.csv` |
| Fragments | `content/react-next/lessons/{ru,tg}/NN-slug.html`; images `public/lessons/react-next/<NN-slug>/` |
| Field mapping | `title` ← «Тема урока»; `topics` ← «React/Next.js: что разбираем»; `ai` ← «AI-блок урока» (label stays the default «ИИ» as in the frontend course); `classwork` ← «Практика на уроке»; `homework` ← «Домашнее задание»; `result` ← «Результат / артефакт». Module titles from «Модуль» without the «М1 · » prefix. `kind`: 14, 23 → `'project'`; 24 → `'final'`; rest `'lesson'`. |
| Slugs | `01 start, 02 typescript, 03 components, 04 state, 05 effects, 06 custom-hooks, 07 forms-styles, 08 context, 09 redux-toolkit, 10 rtk-query, 11 react-router, 12 advanced-react, 13 testing, 14 project-1, 15 next-routing, 16 server-components, 17 data-fetching, 18 server-functions, 19 auth, 20 client-data, 21 metadata-seo, 22 optimization, 23 final-project, 24 defense` |
| destination | ru «Уровень 4 — дальше сами: open source и первая работа» (tg equivalent) |
| Texts | name «React Pro + Next.js», brandSub «React Pro + Next.js», kicker «Уровень 3 · React Pro + Next.js», lead about building a React SPA and a Next.js store in 8 weeks; tg equivalents |

## Steps

1. **Registry** `content/react-next/course.ts` — 24 entries ru + tg (literary Tajik, Cyrillic, terminology as in `content/course.ts` / `messages/tg.ts`), header `// tg: review by a native speaker pending`.
2. **Generator** `scripts/gen-lesson-meta.mjs`: third source → append `RN_AVAILABLE`, `RN_LESSON_META` (keys `rn-<slug>`). Existing exports unchanged and byte-identical.
3. **`lib/courses.ts`**: add `'react-next'` to `CourseId`, `COURSES`, `ALL_META`; `base`/`keyPrefix` types widen to include `'/react-next'`/`'rn-'`; `PREFIXES = ['vc-', 'rn-']`; `courseFromPath` matches segment 2 against every course `base`. Replace `otherCourse(c)` with `otherCourses(c): Course[]` (all except c, in COURSES order) and update callers.
4. **Roadmap** `RoadmapView`: render one `.rm-alt` link per other course (same markup/style as now; wrap OK). Frontend course **finish card** (the destination block «Уровень 3 — React Pro + Next.js») becomes a link to `/{locale}/react-next` — same visuals, add hover/focus affordance consistent with existing card styles; only for courses whose next level exists (frontend → react-next). Implement as an optional `next?: CourseId` on `Course` (frontend: `'react-next'`), not a hard-coded check.
5. **Routes** `app/[locale]/react-next/page.tsx`, `lessons/[slug]/page.tsx`, OG + twitter images — mirror the vibe-coding routes exactly (generalise shared code only if it removes duplication cleanly; otherwise copy). `homeOg`/`lessonOg` support `'react-next'` (heading ru `['React Pro', '+ Next.js']`, tg same; CodeCard e.g. `export default async function Page() {` / `const data = await getData();` / `return <Store data={data} />;` / `// → XP +100`).
6. **Sitemap**: append react-next home + lesson URLs per locale after existing entries.
7. **Mentor** `systemFor('react-next')`: intro «You are the mentor of the course «React Pro + Next.js» (platform MakeFirstStep, Level 3): professional React and Next.js for students who already know JavaScript and React basics.»; topics: TypeScript for React, components and rendering, hooks, forms (React Hook Form, Zod), styling, Context, Redux Toolkit, RTK Query/TanStack Query, React Router, performance and patterns, testing (Vitest, Testing Library, Playwright), Next.js App Router, Server/Client Components, data fetching/streaming/caching, Server Functions, auth and roles, SWR/optimistic UI, metadata/SEO, optimization and deploy, AI SDK, working with AI agents, current lesson/task; formula `context -> task -> constraints -> answer format -> verification`. Frontend and vibe-coding prompts stay byte-identical (assert).
8. **Runner (TSX in playgrounds)**: check `lib/runner.ts` / `components/Playground.tsx`: if the react mode uses sucrase transforms, add `'typescript'` so TSX snippets (type annotations, interfaces) run in `data-mode="react"` playgrounds; same for console code blocks only if it's a one-line change and does not affect existing lessons (verify a few old React lessons 22–24 still run). If not cheap, skip and report.
9. **Checks**: `lib/check.test.mjs` — rn registry (24 entries, unique slugs), rn meta matches fragments, ≤ 30 tasks per rn lesson, global total ≤ 2000, rn fragment media checks (same as vc); `scripts/check-translation.mjs --course react-next`; `lib/mentor.check.mjs` includes rn fragments dirs if present.
10. **Fixture** `content/react-next/lessons/ru/01-start.html` — minimal fixture with one `.yt` (real id verified via oembed 200), one quiz task, one react playground task with `.expected` (the lesson author will overwrite it later).
11. **i18n / legal**: nothing new expected; add strings only if needed.

## Acceptance
- `node scripts/gen-lesson-meta.mjs` → `AVAILABLE`, `LESSON_META`, `VC_*` unchanged.
- `node lib/check.test.mjs`, `check-translation tg` (+ `--course vibe-coding`, `--course react-next`), `pnpm check:sync && pnpm check:mentor && pnpm check:redact && pnpm check:safe-next`, `pnpm lint`, `npx tsc --noEmit`, `pnpm build` — all pass.
- Built old-course pages (`ru/lessons/*`, `tj/lessons/*`) and vibe-coding pages identical to a pre-change snapshot except the expected roadmap links/finish-card link.
- Browser: `/ru/react-next` shows 8 modules / 24 nodes, XP 0, header sub-label «React Pro + Next.js», switcher lists only rn lessons; `/ru` finish card navigates to `/ru/react-next`; each roadmap shows links to the two other courses; solving a task in rn writes `rn-start:*` and doesn't change frontend/vibe XP; no toast on switches; video preview → play works without CSP errors; react TSX playground runs (if step 8 done); 375px + dark mode OK.
