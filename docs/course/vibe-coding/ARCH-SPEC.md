# ARCH-SPEC — second course "Vibe Coding"

Status: approved by lead 2026-10-27. Owner decisions: own URLs `/{ru,tj}/vibe-coding`, own roadmap, progress must not overlap with the old course, lessons = full theory + practice with images and YouTube preview, ru + tg, brand MakeFirstStep only (no external org names).

## 0. Decisions

| Topic | Decision |
|---|---|
| Course ids | `frontend` (existing), `vibe-coding` (new) |
| URLs | old: `/{ru,tj}`, `/{ru,tj}/lessons/<slug>` (unchanged). New: `/{ru,tj}/vibe-coding`, `/{ru,tj}/vibe-coding/lessons/<slug>` |
| Registry | `content/course.ts` byte-identical. New `content/vibe-coding/course.ts` (same `CourseEntry` shape). New thin `lib/courses.ts` binds both. |
| Fragments | old `content/lessons/{ru,tg}/` unchanged; new `content/vibe-coding/lessons/{ru,tg}/NN-slug.html` |
| Progress key ("lessonKey") | old: `<slug>`; new: `vc-<slug>`. Used for task keys `lessonKey:taskId`, meta keys, mentor `lessonSlug`, mentor sessionStorage, Supabase `lesson_slug`. |
| Progress store | single existing store `ilmhona:v2`, NOT modified. Per-course views = filter keys by prefix. |
| New local-only state | prefix `mfs:` (checklists, homework links). |
| Leaderboard | shared, total XP across both courses. Only `leaderboard.lead` copy changes. |
| Course switch | one secondary link in each roadmap hero; header markup unchanged, its links follow the course in the URL. |
| Images | `public/lessons/vibe-coding/<NN-slug>/<name>.{webp,png,svg}`; diagrams inline `<figure class="diagram"><svg>` (existing pattern) |
| Video | `<div class="yt" data-id="…">` → click-to-load `youtube-nocookie.com` |

## 1. Must NOT change

- `content/course.ts`, `content/lessons/**`, `lib/progress.ts`, `lib/sync.ts`, `lib/supabase/merge.ts`, `lib/game.ts`, `supabase/migrations/0001_*.sql`, `0002_*.sql`, `proxy.ts`, `app/[locale]/lessons/[slug]/*`, `app/[locale]/page.tsx`.
- localStorage keys `ilmhona:v2`, `ilmhona:v2:migrated`, `ilmhona:v2:corrupt`, `ilmhona:sync:owner` and value format.
- `lib/lesson-meta.generated.ts`: `AVAILABLE` and `LESSON_META` identical content/order (new exports appended only).
- Old course URLs, metadata, JSON-LD, OG images, mentor system prompt (byte-identical for `frontend`), visual design of header/roadmap/lesson pages (only addition: hero "other course" link).
- Old call sites: new params optional with frontend defaults.

## 2. Steps

### Step 0 — snapshot
`SNAP=<your scratchpad>/mfs-snap; mkdir -p $SNAP && cp lib/lesson-meta.generated.ts $SNAP/ && pnpm build && cp -r .next/server/app $SNAP/app-before`

### Step 1 — `content/vibe-coding/course.ts` (create)
```ts
// tg: review by a native speaker pending
// Course plan source of truth: docs/course/vibe-coding/plan.csv.
// Availability: a lesson is available iff content/vibe-coding/lessons/ru/NN-slug.html exists.
import type { CourseEntry, CourseModule, L10n } from '@/content/course';
import type { Locale } from '@/lib/i18n';
import type { Messages } from '@/messages/ru';
const l = (ru: string, tg: string): L10n => ({ ru, tg });
const moduleTitles: { id: number; title: L10n }[] = [ /* 8 modules from plan.csv, ids 1..8 */ ];
export const destination = { title: l('Свой продукт в продакшене', '…tg…') };
export const course: CourseEntry[] = [ /* 24 entries, same literal layout as content/course.ts */ ];
export const modules: CourseModule[] = /* same derivation as content/course.ts */;
export const texts: Record<Locale, {
  name: string; brandSub: string; homeTitle: string; description: string; tagline: string;
  lessonDesc: string; // template with {num}
  roadmap: Partial<Messages['roadmap']>; // overrides: kicker, lead, finalText, ai ('Инструменты'), title
}> = { ru: {…}, tg: {…} };
```
Mapping from plan.csv: `title` ← «Тема урока»; `topics` ← «Теория»; `ai` ← «Инструменты» (roadmap label overridden to «Инструменты» / tg «Абзорҳо»); `classwork` ← «Практика» + " · " + «Фишка урока»; `homework` ← «Домашнее задание»; `result` ← «Результат урока». `kind`: 17, 18 → `'project'`; 24 → `'final'`; rest `'lesson'`. Module titles: drop the «Модуль N.» prefix. Tajik: write proper literary Tajik (Cyrillic), same terminology style as `content/course.ts`.

Slugs: `01 intro, 02 prompting, 03 html-css, 04 setup-git, 05 first-project, 06 cursor-agent, 07 react-basics, 08 react-state, 09 nextjs-routing, 10 web-api, 11 supabase-db, 12 auth, 13 llm-api, 14 ai-features, 15 rag, 16 product-spec, 17 sprint-1, 18 sprint-2, 19 security, 20 testing, 21 telegram-bot, 22 polish, 23 portfolio, 24 demo-day`.

### Step 2 — `scripts/gen-lesson-meta.mjs`
Loop two sources; old output byte-identical at the top, then append:
```ts
/** Vibe Coding: slugs with content/vibe-coding/lessons/ru/NN-slug.html (plain slugs, course order). */
export const VC_AVAILABLE = [...] as const;   // empty → `[] as readonly string[]`
/** Vibe Coding task levels, keyed by progress key `vc-<slug>`. */
export const VC_LESSON_META: LessonMeta = { 'vc-intro': { 'q1-1': 'e', … } };
```
Task regex unchanged (tasks = `<article class="task" id>` with usual header).

### Step 3 — `lib/courses.ts` (create; client+server safe, no fs)
```ts
import * as fe from '@/content/course';
import * as vc from '@/content/vibe-coding/course';
import type { CourseEntry, CourseModule, L10n } from '@/content/course';
import { AVAILABLE, LESSON_META, VC_AVAILABLE, VC_LESSON_META, type LessonMeta } from './lesson-meta.generated';
import { toUrlLocale, type Locale } from './i18n';
export type CourseId = 'frontend' | 'vibe-coding';
export type Course = {
  id: CourseId; base: '' | '/vibe-coding'; keyPrefix: '' | 'vc-'; dir: string;
  entries: CourseEntry[]; modules: CourseModule[]; destination: { title: L10n };
  available: readonly string[]; meta: LessonMeta; texts?: typeof vc.texts;
};
export const COURSES: Record<CourseId, Course> = {
  frontend: { id: 'frontend', base: '', keyPrefix: '', dir: 'content/lessons', entries: fe.course, modules: fe.modules,
              destination: fe.destination, available: AVAILABLE, meta: LESSON_META },
  'vibe-coding': { id: 'vibe-coding', base: '/vibe-coding', keyPrefix: 'vc-', dir: 'content/vibe-coding/lessons',
              entries: vc.course, modules: vc.modules, destination: vc.destination, available: VC_AVAILABLE,
              meta: VC_LESSON_META, texts: vc.texts },
};
export const ALL_META: LessonMeta = { ...LESSON_META, ...VC_LESSON_META };
export const courseFromPath = (pathname: string): Course =>
  pathname.split('/')[2] === 'vibe-coding' ? COURSES['vibe-coding'] : COURSES.frontend;
export const lessonKey = (c: Course, slug: string) => c.keyPrefix + slug;
export const courseHome = (c: Course, locale: Locale) => `/${toUrlLocale(locale)}${c.base}`;
export const lessonHref = (c: Course, locale: Locale, slug: string) => `${courseHome(c, locale)}/lessons/${slug}`;
export const availableEntries = (c: Course) => c.entries.filter((e) => c.available.includes(e.slug));
const PREFIXES = ['vc-'];
export const ownsKey = (c: Course, key: string) =>
  c.keyPrefix ? key.startsWith(c.keyPrefix) : !PREFIXES.some((p) => key.startsWith(p));
export const otherCourse = (c: Course) => (c.id === 'frontend' ? COURSES['vibe-coding'] : COURSES.frontend);
```

### Step 4 — `lib/course-status.ts`
- `lessonCounts(key, solved)`: `ALL_META[key]` instead of `LESSON_META`.
- `courseItems(solved, c: Course = COURSES.frontend)`: `avail = c.available.includes(e.slug)`; counts via `lessonCounts(lessonKey(c, e.slug), …)`. `CourseItem.slug` stays plain.
- Add:
```ts
export function courseProgress(s: ProgressState, c: Course): ProgressState {
  const pick = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => ownsKey(c, k)));
  return { ...s, solved: pick(s.solved), hintsOpened: pick(s.hintsOpened) };
}
export function useCourseProgress(c: Course): ProgressState {
  const s = useProgress();
  return useMemo(() => courseProgress(s, c), [s, c]);
}
```

### Step 5 — `lib/lessons.server.ts` (optional trailing `c: Course = COURSES.frontend`)
`availableLessons(c)`, `getLesson(slug, c)`, `neighbours(slug, c)`, `readFragment(lesson, locale, c)` with `dir = path.join(process.cwd(), c.dir, locale)`. Add:
```ts
export function lessonByKey(key: string): { course: Course; lesson: CourseEntry } | undefined {
  const course = Object.values(COURSES).find((c) => c.keyPrefix && key.startsWith(c.keyPrefix)) ?? COURSES.frontend;
  const lesson = getLesson(key.slice(course.keyPrefix.length), course);
  return lesson ? { course, lesson } : undefined;
}
```

### Step 6 — components
- `LessonBody.tsx`: prop `courseId?: CourseId = 'frontend'`; `key = lessonKey(c, lesson.slug)`; `readFragment(lesson, locale, c)`, `makeReplaceOptions(key)`, `<Toc lessonSlug={key}>`, `<Pager {...neighbours(slug, c)} courseId>`, `<MentorChat key={key} lessonSlug={key}>`.
- `Pager.tsx`: prop `courseId = 'frontend'`; hrefs via `lessonHref`.
- `LessonSwitcher.tsx`: prop `courseId`; `c.entries`, `c.modules`, `courseItems(progress.solved, c)`, `lessonHref`.
- `XpBadge.tsx`: prop `courseId`; `useCourseProgress(c)`; `achievements(progress, c.meta, t.game)`; lesson list via `availableEntries(c)` + `c.meta[lessonKey(c, slug)]`, solved key `${lessonKey(c, slug)}:${id}`.
- `Header.tsx`: `c = courseFromPath(pathname)`, `home = courseHome(c, locale)`; current lesson via `lessonHref`; counts via `lessonCounts(lessonKey(...))`; brand + map-link `href={home}` (`aria-current` when `pathname === home`); `<small>{c.texts?.[locale].brandSub ?? t.header.brandSub}</small>`; `<LessonSwitcher courseId={c.id}>`; `<XpBadge key={c.id} courseId={c.id}/>` (key REQUIRED — prevents false level-up/achievement toasts on course switch).
- `roadmap/RoadmapView.tsx`: prop `courseId = 'frontend'`; `r = { ...t.roadmap, ...(c.texts?.[locale].roadmap ?? {}) }`; `useCourseProgress(c)`; `courseItems(…, c)`; `c.modules`, `c.destination`, hrefs via `lessonHref`. In `.rm-cta-row` add `<Link className="rm-alt" href={courseHome(otherCourse(c), locale)}>{fmt(t.roadmap.otherCourse, { name })} <span aria-hidden="true">→</span></Link>`, name = `other.texts?.[locale].name ?? courseName[locale]`.
- `TaskContext.ts`: add `done: boolean; solve: (auto: boolean, anchor: Element | null) => void`.
- `Task.tsx`: `solve = useCallback((auto, anchor) => { if (!getSnapshot().solved[key]) award(auto, anchor); }, [award, key])`; add `done`, `solve` to ctx memo + deps. Nothing else.

### Step 7 — new fragment elements (components + `lib/contentReplace.tsx`; document as items in its top comment)

| Markup | Component | Behaviour |
|---|---|---|
| `<div class="yt" data-id="XXXXXXXXXXX" data-title="…" data-start="90"></div>` | `components/YouTube.tsx` | id must match `/^[A-Za-z0-9_-]{11}$/` (else render nothing). Before click: `<button class="yt-play">` with `<img src="https://i.ytimg.com/vi/ID/hqdefault.jpg" alt="" width=480 height=360 loading="lazy">` + SVG play icon, aria-label `t.practice.ytPlay`. On click: `<iframe src="https://www.youtube-nocookie.com/embed/ID?autoplay=1&rel=0[&start=N]" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin">`. `<figcaption>`: title · link "Открыть на YouTube" (`target=_blank rel="noopener noreferrer"`). |
| `<ul class="checklist" id="cl-x"><li>…</li></ul>` | `components/Checklist.tsx` | checkbox per li, counter n/m; state `localStorage['mfs:checklist:<lessonKey>:<id>']` (number[], loaded in useEffect, try/catch). Inside a task: all checked && !ctx.done → `ctx.solve(false, el)` (half XP). Unchecking doesn't unmark. |
| `<div class="quiz" data-answer="2">` / `data-answer="1,3"` (multi) with `<p>` question, `<ol class="options"><li>…</li></ol>`, optional `<div class="explain">` | `components/Quiz.tsx` | 1-based; radios or checkboxes (`useId` name); button `t.practice.check`; exact set match → `data-ok` + explain + `correct`, else `wrong` (unlimited tries). In a task: when every `.quiz` in the article is ok → `ctx.solve(true, btn)`. If `ctx.done` on mount render solved. |
| `<div class="submit-link" data-hosts="vercel.app github.com" data-placeholder="…"></div>` (inside `article.task`) | `components/SubmitLink.tsx` | `input type=url` + Save; valid iff https and host equals / ends with `.`+one of hosts (empty = any https). Store `localStorage['mfs:link:<lessonKey>:<taskId>']`; save → `ctx.solve(false, btn)`. Saved view: link (`rel="noopener noreferrer nofollow"` new tab) + Copy + Edit. |
| Copyable prompt | existing `div.prompt` | reuse |
| Screenshot | `<figure class="shot"><img src="/lessons/vibe-coding/NN-slug/x.webp" alt width height loading="lazy" decoding="async"><figcaption>` | no replace needed |
| Diagram / mock UI | existing `<figure class="diagram"><svg>` inline, CSS vars | reuse |

Every graded block sits in `<article class="task" id>` with the usual header so XP/TOC/manual toggle/mentor/sync work unchanged.

### Step 8 — CSS (append to `app/globals.css`, use existing vars; check names exist)
```css
/* ---------- видео / скриншоты / практика ---------- */
.yt { margin: 22px 0; }
.yt-frame { position: relative; aspect-ratio: 16/9; border-radius: var(--radius); overflow: hidden; background: #000; border: 1px solid var(--line); }
.yt-frame iframe, .yt-play, .yt-play img { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.yt-play { padding: 0; cursor: pointer; background: #000; }
.yt-play img { object-fit: cover; opacity: .92; transition: opacity .2s; }
.yt-play:hover img { opacity: 1; }
.yt-btn { position: absolute; left: 50%; top: 50%; width: 72px; height: 50px; transform: translate(-50%,-50%); border-radius: 14px; background: var(--red); display: grid; place-items: center; color: #fff; }
.yt-play:focus-visible { outline: 3px solid var(--accent); outline-offset: -3px; }
.yt figcaption, .shot figcaption { margin-top: 8px; font-size: 14px; color: var(--ink-3); text-align: center; }
.shot { margin: 22px 0; }
.shot img { display: block; max-width: 100%; height: auto; margin: 0 auto; border-radius: var(--radius); border: 1px solid var(--line); }
.checklist { list-style: none; padding: 0; margin: 14px 0; }
.checklist li { margin: 0 0 8px; }
.checklist label { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
.checklist input { margin-top: 4px; width: 18px; height: 18px; accent-color: var(--accent); flex: none; }
.checklist .cl-count { font: 700 13px var(--mono); color: var(--ink-3); }
.quiz { margin: 14px 0; padding: 16px 18px; border-radius: var(--radius); background: var(--paper); border: 1px solid var(--line); }
.quiz .options { list-style: none; padding: 0; margin: 10px 0; }
.quiz .options label { display: flex; gap: 10px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); margin-bottom: 6px; cursor: pointer; }
.quiz .options label:has(input:checked) { border-color: var(--accent); }
.quiz[data-ok] { border-color: var(--accent); background: var(--accent-soft); }
.quiz .explain { margin-top: 10px; }
.submit-link { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.submit-link input { flex: 1 1 260px; min-width: 0; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: 15px var(--mono); }
.rm-cta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; }
.rm-alt { font-weight: 700; color: inherit; opacity: .85; text-decoration: underline; text-underline-offset: 3px; }
.rm-alt:hover { opacity: 1; }
```
Reuse `.done-toggle` / `.check-fb` for buttons/feedback. `.rm-cta-row` is the only old-course style touch — verify old hero looks identical.

### Step 9 — i18n `messages/ru.ts` + `messages/tg.ts`
- `roadmap.otherCourse`: `'Другой курс: {name}'` / `'Курси дигар: {name}'`
- `practice: { check, correct, wrong, pickOne, pickMany, done: '{n} из {m}', linkLabel, save, edit, linkInvalid: 'Нужна ссылка вида https://…', linkHost: 'Ссылка должна вести на {hosts}', linkSaved, ytPlay: 'Смотреть видео: {title}', ytOpen: 'Открыть на YouTube' }` (+ tg)
- `leaderboard.lead`: append «XP считается по всем курсам.» (+ tg)

### Step 10 — routes (create)
- `app/[locale]/vibe-coding/page.tsx`: `generateMetadata` → `buildMeta({ locale, sub: '/vibe-coding', title: T.homeTitle, description: T.description })`; JSON-LD `Course` like old home (`@id …/vibe-coding#course`, `hasPart` via `lessonHref`); `<RoadmapView courseId="vibe-coding" />`.
- `app/[locale]/vibe-coding/lessons/[slug]/page.tsx`: copy old lesson page with `c = COURSES['vibe-coding']`, `dynamicParams = false`, `generateStaticParams` over `availableLessons(c)`, description `clip(fmt(T.lessonDesc,{num}) + ': ' + topics, 200)` (export `clip` from `lib/site.ts`), `<LessonBody … courseId="vibe-coding" />`.
- OG + twitter images for both new routes (copy existing pattern; `homeOg(locale, 'vibe-coding')`, `lessonOg(locale, lesson, 'vibe-coding')`).
- `proxy.ts` unchanged.

### Step 11 — `lib/og.tsx`
`Frame` optional `chip`, `tagline` (defaults = current). `homeOg(locale, courseId = 'frontend')`: vibe heading ru `['Вайб-кодинг','с нуля']`, tg `['Вайб-кодинг','аз сифр']`; CodeCard `const idea = '…'; await ai.build(idea); deploy(); // → XP +100`. `lessonOg(locale, c, courseId = 'frontend')` uses `COURSES[courseId].modules`.

### Step 12 — `app/sitemap.ts`
Append per locale `/<l>/vibe-coding` + `VC_AVAILABLE` lesson URLs after existing entries.

### Step 13 — CSP `next.config.ts`
Add `"frame-src 'self' https://www.youtube-nocookie.com",` after `worker-src`.

### Step 14 — mentor `app/api/mentor/route.ts` only
- `parse()`: `lessonByKey(b.lessonSlug)` instead of `getLesson`.
- `taskStatement`: `readFragment(r.lesson, 'ru', r.course)`.
- `SYSTEM` → `systemFor(id)` with per-course `intro`, `topics`, `formula`:
  - frontend: assembled string MUST equal today's `SYSTEM` byte-for-byte (assert once while implementing).
  - vibe-coding: intro «You are the mentor of the course «Vibe Coding» (platform MakeFirstStep): building real web products with AI tools, for beginners.»; topics: AI-assisted development and prompting, AI coding tools/editors, HTML/CSS/JS basics, React, Next.js, Tailwind, Git/GitHub, deploy/hosting, web/API/JSON, Supabase (db, auth, storage, vectors), LLM APIs, RAG, product specs, security of AI-generated code, testing/debugging, Telegram bots and no-code automations, UX/performance/SEO, portfolio and freelancing, current lesson/task; formula `context -> goal -> constraints -> examples -> verification`; plus «When you mention a tool or AI service, never use first person in the same sentence.»
- `buildRequest`: `systemFor(course.id)`. Logging/`signReply` unchanged.

### Step 15 — `supabase/migrations/0003_course_vibe_coding.sql`
Repeat `task_progress_guard()` from 0001 with cap 1000 → 2000 (+ same revoke lines). Header comment explains why. Owner applies it manually.

### Step 16 — `lib/legal.ts` (ru + tg)
Add processor: «**YouTube** (режим без cookies) — видео в уроках; превью загружается с серверов YouTube, сам плеер — только после нажатия.»

### Step 17 — checks
- `lib/check.test.mjs` add: VC meta matches fragments; VC registry 24 entries, nums 1..24, unique slugs `/^[a-z0-9-]{1,37}$/`; no frontend slug starts with `vc-`; ≤15 tasks per VC lesson and total tasks ≤ 2000; for each ru+tg VC fragment: every `src="/lessons/…"` exists under `public/` and its img has non-empty alt/width/height; `.yt` ids valid; `.quiz` answers within options count; `ul.checklist` has unique id; `.submit-link` inside `article.task`.
- `scripts/check-translation.mjs`: `--course vibe-coding` flag (default unchanged); compare imgs, yt ids, quiz answers, checklist ids + li counts, data-hosts.
- `lib/mentor.check.mjs`: include VC fragments dirs if present.
- `package.json`: `"check:lessons": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON lib/check.test.mjs"`.

### Step 18 — test fixture lesson
`content/vibe-coding/lessons/ru/01-intro.html` — minimal FIXTURE (the real lesson is written later by the lesson author and will overwrite it). Must contain one of each: `.yt` with a REAL existing video id (verify via `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=ID&format=json` → 200), `figure.shot` with a real small webp in `public/lessons/vibe-coding/01-intro/`, inline-SVG `figure.diagram`, `div.prompt.good-prompt`, a task with 2 quizzes, a task with a checklist, a task with submit-link.

Images rules for authors: WebP/SVG, ≤1600px wide, ≤250 KB, no personal data; same files for ru/tg (only alt/figcaption translated).

## 3. Acceptance

```
node scripts/gen-lesson-meta.mjs   # AVAILABLE/LESSON_META identical to snapshot
node lib/check.test.mjs
node scripts/check-translation.mjs tg
node scripts/check-translation.mjs tg --course vibe-coding
pnpm check:sync && pnpm check:mentor && pnpm check:redact && pnpm check:safe-next
pnpm lint && npx tsc --noEmit && pnpm build   # routes /[locale]/vibe-coding + lessons/[slug]
diff -r $SNAP/app-before/ru/lessons .next/server/app/ru/lessons   # only hashes/buildId/header noise
curl -sI localhost:<port>/ru | grep -i content-security-policy     # has frame-src youtube-nocookie
curl -s localhost:<port>/sitemap.xml | grep -c vibe-coding
curl -sI localhost:<port>/ru/vibe-coding/opengraph-image | head -1 # 200
```
Browser (Playwright):
1. Old course unchanged: XP/level/streak/roadmap counts identical before/after; `/ru` same apart from the "Другой курс" link.
2. `/ru/vibe-coding`: 8 modules, 24 nodes (lesson 1 available, rest «Скоро»), XP 0; header sub-label «Vibe Coding»; logo/map link → `/ru/vibe-coding`; switcher lists only new lessons.
3. Separate progress: solve quiz task → `vc-intro:q1-1` in `ilmhona:v2`; `/ru` XP unchanged, no toast on switch.
4. Video: before click only `i.ytimg.com` requested; after click plays, no CSP errors; keyboard Enter works.
5. Checklist persists after reload; all ticked → half XP.
6. Submit link: `http://x.com` invalid, `https://evil.com` wrong host, `https://me.vercel.app` saved + solved + survives reload.
7. Mentor: payload `lessonSlug: "vc-intro"`; on-topic Supabase question answered, off-topic refused; old course mentor unchanged.
8. `/tj/vibe-coding/lessons/intro` without tg file → ru + fallback notice; language switch keeps path.
9. Mobile 375px: hero CTA row wraps, video 16:9 no overflow, header unchanged. Light + dark.
