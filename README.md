<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.svg">
    <img src="docs/readme/hero-light.svg" alt="MakeFirstStep · Frontend + ИИ — интерактивный курс JavaScript: живой код в уроке, автопроверка задач, XP" width="100%">
  </picture>
</p>

<p align="center"><i>Курси интерактивии JavaScript барои донишҷӯёни Тоҷикистон.</i></p>

<p align="center"><b><a href="https://ksg-courses.online">ksg-courses.online</a></b> · <a href="https://ksg-courses.online/ru">Русский</a> · <a href="https://ksg-courses.online/tj">Тоҷикӣ</a></p>

## Что это

**MakeFirstStep · Frontend + ИИ** — интерактивный курс для студентов Таджикистана на русском (`/ru`) и таджикском (`/tj`). 24 урока в 5 модулях: от основ JavaScript до React. Все уроки переведены на таджикский (`content/lessons/tg`), перевод защищает `scripts/check-translation.mjs`.

- **Живой код в уроке.** Редактор на CodeMirror 6: код можно менять и запускать прямо на странице.
- **Песочница-раннер.** Консоль, DOM-превью, `async`/`fetch`, React/JSX, формы. Код студента выполняется в изолированном iframe.
- **Задачи с автопроверкой.** Вывод консоли сравнивается с ожидаемым, при ошибке показывается построчный diff. У каждой задачи есть подсказки.
- **Геймификация.** XP, 10 уровней, серии дней (streak), достижения.
- **Дорожная карта на главной.** Модули, прогресс и следующий шаг в одном месте.
- **Бот-наставник в уроке.** Даёт только подсказки, не готовые решения; держится темы урока, маскирует личные данные; провайдер модели от студентов скрыт.
- **Вход через Google** (Supabase): синхронизация прогресса между устройствами и необязательный лидерборд под псевдонимом.
- **Светлая и тёмная тема**, переключатель языка `ru` / `tj`.
- **Превью ссылок и SEO.** OG-картинки, sitemap, JSON-LD.
- **Безопасность.** Строгий CSP, изолированный раннер, RLS-политики; есть страницы политики конфиденциальности и условий.

## Дорожная карта

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/roadmap-dark.svg">
    <img src="docs/readme/roadmap-light.svg" alt="Пять модулей на 24 урока, все доступны: JS-фундамент 1–6, DOM и интерфейс 7–12, Async и API 13–18, Инструменты и финал 19–21, React Lite (бонус) 22–24; проекты в уроках 12, 18 и 21. Затем Уровень 3 — React Pro + Next.js." width="100%">
  </picture>
</p>

| Модуль | Уроки | Статус |
| --- | --- | --- |
| 1. JS-фундамент | 1–6 | уроки 1–6 доступны (контрольная №1 в уроке 6) |
| 2. DOM и интерфейс | 7–12 | уроки 7–12 доступны (проект №1 — урок 12) |
| 3. Async и API | 13–18 | уроки 13–18 доступны (проект №2 — урок 18) |
| 4. Инструменты и финал | 19–21 | уроки 19–21 доступны (финальный проект — урок 21) |
| 5. React Lite (бонус) | 22–24 | уроки 22–24 доступны |

Итого: 24 урока и 655 задач, из них 641 с автопроверкой (есть блок `.expected`).

## Стек

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/stack-dark.svg">
    <img src="docs/readme/stack-light.svg" alt="Next.js 16, React 19, TypeScript, CodeMirror 6, GSAP, Supabase, Vercel" width="100%">
  </picture>
</p>

- **Next.js 16** (App Router) и **React 19**, **TypeScript**.
- **CodeMirror 6** — редактор; **sucrase** — компиляция JSX в браузере; **GSAP** — анимации.
- **Supabase** — Auth, Postgres с RLS, `pg_cron` (очистка журнала наставника).
- **Gemini API** — бот-наставник, вызывается только на сервере.
- **Vercel** — деплой.

## Как это устроено

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/architecture-dark.svg">
    <img src="docs/readme/architecture-light.svg" alt="Браузер получает статические страницы Next.js; код студента выполняется в изолированном iframe-раннере. Прогресс хранится в localStorage и синхронизируется с Supabase." width="100%">
  </picture>
</p>

- Уроки хранятся как HTML-фрагменты в `content/lessons/`. При рендере `lib/contentReplace.tsx` превращает разметку в React-компоненты (редактор, песочница, задача).
- Раннер (`lib/runner.ts`) запускает код в `<iframe sandbox="allow-scripts">`: без доступа к странице-родителю, результат приходит через `postMessage`. Запуск ограничен 8 секундами.
- Прогресс всегда пишется в `localStorage`, поэтому курс работает без входа и без сети. После входа через Google прогресс сливается между устройствами (`lib/sync.ts`), данные защищены RLS-политиками «только свои строки».
- Наставник: `app/api/mentor` (Gemini, только сервер). Цепочка бесплатных моделей с общей квотой в Supabase, журнал запросов за 7 дней (без ответов модели и сырых IP), страница статуса `/ru/admin/mentor` только для владельца. Подробности: [`docs/mentor.md`](docs/mentor.md).

## Быстрый старт

```bash
pnpm install
cp .env.example .env.local   # необязательно: без Supabase и ключей курс работает локально
pnpm dev                     # http://localhost:3000
```

Переменные окружения (шаблон: [`.env.example`](.env.example)):

| Переменная | Назначение |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | публичный адрес сайта (`https://ksg-courses.online`); для ссылок, OG и sitemap |
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase (публичный) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable-ключ `sb_publishable_...` (публичный, данные защищает RLS) |
| `SUPABASE_SECRET_KEY` | **только сервер**: общая квота и журнал наставника |
| `GEMINI_API_KEY` | **только сервер**: ключ Gemini API для наставника |
| `MENTOR_ADMIN_TOKEN` | **только сервер**: токен страницы `/ru/admin/mentor` (от 24 символов) |
| `NEXT_PUBLIC_AUTH_EMAIL` | необязательно: `1` включает вход по ссылке из письма |

Без Supabase нет кнопки «Войти», синхронизации и сетевых вызовов; без `GEMINI_API_KEY` наставник показывает «не подключён». Остальные переменные наставника описаны в [`docs/mentor.md`](docs/mentor.md).

Supabase: примените миграции `supabase/migrations/0001_init.sql` (прогресс, лидерборд) и `0002_mentor.sql` (квота и журнал наставника). Настройка проекта и Google: [`supabase/README.md`](supabase/README.md).

### Скрипты

| Команда | Что делает |
| --- | --- |
| `pnpm dev` | dev-сервер (перед запуском генерирует `lib/lesson-meta.generated.ts`) |
| `pnpm build` | продакшен-сборка (тоже с генерацией меты) |
| `pnpm start` | запуск собранного приложения |
| `pnpm lint` | ESLint |
| `node lib/check.test.mjs` | самопроверка автопроверки и игровых правил (нужен Node ≥ 22.6) |
| `pnpm check:sync` | слияние прогресса при синхронизации |
| `pnpm check:redact` | маскирование личных данных в вопросах наставнику |
| `pnpm check:mentor` | защитные проверки ответов наставника |
| `pnpm check:safe-next` | безопасность параметра возврата `next` после входа |
| `node scripts/check-translation.mjs tg` | перевод урока не ломает код и автопроверку |

## Как добавить урок

Урок добавляется **одним файлом**: `content/lessons/ru/NN-slug.html`. `NN` — двузначный номер урока из `content/course.ts` (например, `08`), `slug` — его slug (`dom`), итог — `content/lessons/ru/08-dom.html`. Это только содержимое страницы, без `<html>` и `<body>`.

Больше ничего править не нужно: урок появляется на дорожной карте, в переключателе уроков и в XP-списке, получает страницу `/ru/lessons/dom` и пейджер. Названия, темы и номера берутся из `content/course.ts`, уровни задач собирает `scripts/gen-lesson-meta.mjs` при `pnpm dev` и `pnpm build` (`lib/lesson-meta.generated.ts` руками не правится). После добавления файла в запущенном `pnpm dev` перезапустите его.

Урок пишется через агента [`.claude/agents/lesson-author.md`](.claude/agents/lesson-author.md): он знает формат и правила курса.

Таджикская версия по желанию: `content/lessons/tg/NN-slug.html`; если файла нет, показывается русская. Проверка: `node scripts/check-translation.mjs tg NN-slug.html`; код, `data-*` и блоки `.expected` должны совпадать с русским оригиналом.

### Формат фрагмента

Полное описание лежит в шапке [`lib/contentReplace.tsx`](lib/contentReplace.tsx).

**Блок кода.** Статичный без `data-run`, живой редактор с консолью — с ним.

```html
<pre class="code" data-run data-title="Заголовок (необязательно)" data-lang="js">
console.log("Ассалому алейкум!");
</pre>
```

`data-lang`: `js` (по умолчанию), `jsx`, `html`, `css` — это только подсветка. Консоль понимает `setTimeout`, `Promise`, `fetch`, `async/await` и ждёт завершения всего (жёсткий лимит 8 с). Символ `<` внутри `<pre>` пишите как `&lt;`.

**Задача с автопроверкой.**

```html
<article class="task" id="t1-1">
  <header>
    <span class="task-num">ЗАДАЧА 1.1</span>
    <h4>Приветствие академии</h4>
    <span class="level easy">лёгкая</span>   <!-- easy | mid | hard -->
  </header>
  <p>Условие задачи.</p>
  <pre class="code" data-run>
// решение студента
  </pre>
  <div class="expected"><b>Ожидаемый результат</b><pre>Ассалому алейкум, MakeFirstStep!</pre></div>
  <details class="hint"><summary>Подсказка 1</summary><p>Текст подсказки.</p></details>
  <details class="hint"><summary>Подсказка 2</summary><p>Ещё одна.</p></details>
</article>
```

`id` задачи уникален в рамках урока. Вывод консоли сравнивается с блоком `.expected` по строкам: пробелы по краям и пустые строки по краям игнорируются.

**Playground** — редактор с вкладками файлов, превью в песочнице и консолью.

```html
<div class="playground" data-mode="dom" data-title="Карточки товаров">
  <pre class="code" data-lang="html">…</pre>  <!-- index.html: только содержимое body -->
  <pre class="code" data-lang="css">…</pre>   <!-- style.css (необязательно) -->
  <pre class="code" data-lang="js">…</pre>    <!-- script.js, ES-модуль -->
</div>

<div class="playground" data-mode="react" data-title="Счётчик">
  <pre class="code" data-lang="jsx">…</pre>   <!-- App.jsx: export default function App -->
  <pre class="code" data-lang="css">…</pre>   <!-- style.css (необязательно) -->
</div>
```

Порядок `<pre>` внутри не важен: они сопоставляются по `data-lang`. В режиме `react` JSX компилируется в браузере, а React 19 подтягивается с esm.sh, поэтому нужен интернет. Превью — `sandbox="allow-scripts"` без доступа к `localStorage` и cookie хоста.

## Геймификация

Правила описаны в [`lib/game.ts`](lib/game.ts).

| Сложность | Базовый XP |
| --- | --- |
| лёгкая (`easy`) | 10 |
| средняя (`mid`) | 20 |
| сложная (`hard`) | 40 |

- Каждая открытая подсказка снимает 25 % XP, но не больше 75 %: минимум 25 % от базы.
- Отметка «решено» вручную (без автопроверки) стоит 50 % базы.
- Серия (streak) считается по подряд идущим дням с решёнными задачами. Достижения: первая задача, урок пройден, 5 задач без подсказок, 3 сложные задачи, серии 3 и 7 дней, «сова», «спринт».

| Уровень | Порог XP | Звание |
| --- | --- | --- |
| 1 | 0 | Стажёр |
| 2 | 50 | Джуниор |
| 3 | 150 | Уверенный джуниор |
| 4 | 300 | Мидл |
| 5 | 500 | Крепкий мидл |
| 6 | 800 | Сеньор |
| 7 | 1200 | Тимлид |
| 8 | 1700 | Архитектор |
| 9 | 2300 | Гуру JS |
| 10 | 3000 | Легенда MakeFirstStep |

## Структура проекта

```text
app/[locale]/        страницы: главная (дорожная карта), уроки, лидерборд, privacy, terms, admin/mentor
app/api/mentor       бот-наставник и статус
app/auth/callback    возврат после входа через Supabase
components/          редактор, песочница, задача, шапка, роадмап
content/             course.ts (модули и план), lessons.ts, lessons/{ru,tg}/*.html
lib/                 runner, check, game, sync, i18n, contentReplace, mentor-*, redact, site, supabase/
messages/            строки интерфейса ru.ts и tg.ts
scripts/             gen-lesson-meta.mjs, check-translation.mjs
supabase/            README с настройкой и migrations/ (0001, 0002)
docs/                mentor.md, readme/ (графика для этого README)
```

## Лицензия

Все права защищены © MakeFirstStep.
