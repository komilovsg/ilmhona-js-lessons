// Records the real student flow of the platform (desktop + mobile, ru + tj) with Playwright.
// Needs a running production build: `pnpm build && pnpm start -p 3430` in the repo root.
// Output: raw/<locale>-<device>.webm and raw/<locale>-marks.json (chapter start times, ms).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:3430';
const OUT = join(HERE, 'raw');
const STEP_MS = 8500; // every chapter lasts at least this long in the recording
const LOCALES = { ru: { url: 'ru', dir: 'ru' }, tg: { url: 'tj', dir: 'tg' } };
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, size: { width: 1440, height: 900 }, scale: 1, touch: false },
  mobile: { viewport: { width: 390, height: 844 }, size: { width: 390, height: 844 }, scale: 2, touch: true },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Visible pointer: ring that follows the mouse (desktop) and ripples on every click / touch.
const OVERLAY = `
(() => {
  const mk = () => {
    if (document.getElementById('__ptr')) return;
    const st = document.createElement('style');
    st.textContent = '#__ptr{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid #0e7a55;background:rgba(14,122,85,.22);box-shadow:0 0 0 3px rgba(255,255,255,.55);z-index:2147483647;pointer-events:none;opacity:0;display:' + ('ontouchstart' in window ? 'none' : 'block') + ';transition:opacity .2s, transform .12s}' +
      '#__ptr.down{transform:scale(.7);background:rgba(14,122,85,.5)}' +
      '.__rip{position:fixed;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:3px solid #0e7a55;z-index:2147483647;pointer-events:none;animation:__rip .6s ease-out forwards}' +
      '@keyframes __rip{to{transform:scale(3.2);opacity:0}}';
    document.head.appendChild(st);
    const d = document.createElement('div'); d.id = '__ptr'; document.documentElement.appendChild(d);
    const pos = (x, y) => { d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.opacity = '1'; };
    const rip = (x, y) => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = x + 'px'; r.style.top = y + 'px'; document.documentElement.appendChild(r); setTimeout(() => r.remove(), 700); };
    addEventListener('mousemove', (e) => pos(e.clientX, e.clientY), true);
    addEventListener('mousedown', (e) => { pos(e.clientX, e.clientY); d.classList.add('down'); rip(e.clientX, e.clientY); }, true);
    addEventListener('mouseup', () => d.classList.remove('down'), true);
    addEventListener('touchstart', (e) => { const t = e.touches[0]; rip(t.clientX, t.clientY); }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
})();
`;

/** Reads the 1-based `data-answer` of the n-th quiz from the lesson source (lesson of the `locale`). */
function quizAnswer(dir, file, n) {
  const html = readFileSync(join(ROOT, 'content', file.replace('{l}', dir)), 'utf8');
  const all = [...html.matchAll(/class="quiz" data-answer="([\d,]+)"/g)];
  return all[n][1].split(',').map(Number);
}

async function recordOne(browser, locKey, devKey) {
  const loc = LOCALES[locKey];
  const dev = DEVICES[devKey];
  const mobile = devKey === 'mobile';
  const tmp = join(OUT, `tmp-${locKey}-${devKey}`);
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: dev.viewport,
    deviceScaleFactor: dev.scale,
    isMobile: mobile,
    hasTouch: dev.touch,
    colorScheme: 'light',
    locale: locKey === 'tg' ? 'tg-TJ' : 'ru-RU',
    recordVideo: { dir: tmp, size: dev.size },
  });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const marks = {};
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const settle = async () => {
    await page.waitForLoadState('load');
    await sleep(700);
  };
  const scrollOnce = async (sel, block, ms, extra) => {
    await page.locator(sel).evaluate(
      (el, [b, d, x]) =>
        new Promise((res) => {
          const r = el.getBoundingClientRect();
          const target = Math.max(0, scrollY + (b === 'center' ? r.top + r.height / 2 - innerHeight / 2 : r.top - 90) + x);
          const from = scrollY;
          const t = performance.now();
          const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
          const f = (now) => {
            const p = Math.min(1, (now - t) / d);
            scrollTo({ top: from + (target - from) * ease(p), behavior: 'instant' });
            p < 1 ? requestAnimationFrame(f) : res();
          };
          requestAnimationFrame(f);
        }),
      [block, ms, extra],
    );
    await sleep(250);
  };
  // second pass corrects for lazy content that shifted the layout during the first scroll
  const scrollTo = async (sel, block = 'center', ms = 1300, extra = 0) => {
    await scrollOnce(sel, block, ms, extra);
    await scrollOnce(sel, block, 500, extra);
  };
  const point = async (loc_) => {
    const b = await loc_.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const move = async (loc_) => {
    if (mobile) return;
    const { x, y } = await point(loc_);
    await page.mouse.move(x, y, { steps: 28 });
    await sleep(250);
  };
  const click = async (loc_) => {
    const { x, y } = await point(loc_);
    if (mobile) await page.touchscreen.tap(x, y);
    else {
      await page.mouse.move(x, y, { steps: 28 });
      await sleep(200);
      await page.mouse.click(x, y);
    }
  };
  const step = async (name, fn) => {
    const start = Date.now() - t0;
    marks[name] = start;
    await fn();
    const left = STEP_MS - (Date.now() - t0 - start);
    if (left > 0) await sleep(left);
    marks[name + 'End'] = Date.now() - t0;
  };

  const lessonPath = `/${loc.url}/vibe-coding/lessons/product-spec`;

  // 1. choose a course on the home board
  await step('choose', async () => {
    await page.goto(`${BASE}/${loc.url}`);
    await settle();
    await sleep(1500);
    await scrollTo('#courses', 'start', 1500);
    await sleep(500);
    await move(page.locator('#course-frontend .hm-btn'));
    await move(page.locator('#course-vibe-coding .hm-btn'));
    await sleep(500);
    await click(page.locator('#course-vibe-coding .hm-btn'));
  });
  // 2. course roadmap
  await step('roadmap', async () => {
    await page.waitForURL('**/vibe-coding');
    await settle();
    await sleep(900);
    await scrollTo('.rm-track', 'start', 1800);
    await scrollTo('.rm-card >> nth=11', 'center', 2200);
    await sleep(400);
    const link = page.locator(`a.rm-link[href$="/lessons/product-spec"]`);
    await scrollTo(`a.rm-link[href$="/lessons/product-spec"]`, 'center', 1600);
    await sleep(500);
    await click(link);
  });
  // 3. theory, diagram, video thumbnail
  await step('theory', async () => {
    await page.waitForURL('**/lessons/product-spec');
    await settle();
    await sleep(1200);
    await scrollTo('figure.diagram >> nth=0', 'center', 2200);
    await sleep(1400);
    await scrollTo('.yt >> nth=0', 'center', 2000);
    await move(page.locator('.yt-play >> nth=0'));
  });
  // 4. quiz with auto-check (answer read from the lesson source)
  await step('quiz', async () => {
    const quiz = page.locator('.quiz >> nth=2');
    await scrollTo('.quiz >> nth=2', 'center', 1600, 40);
    await sleep(800);
    const [ans] = quizAnswer(loc.dir, 'vibe-coding/lessons/{l}/16-product-spec.html', 2);
    const opt = quiz.locator('.options li').nth(ans - 1).locator('label');
    await move(opt);
    await sleep(500);
    await click(opt);
    await sleep(900);
    await click(quiz.locator('button.done-toggle'));
    await sleep(1500);
  });
  // 5. code task in the editor with auto-check
  await step('task', async () => {
    await page.goto(`${BASE}/${loc.url}/lessons/functions`);
    await settle();
    await sleep(700);
    await scrollTo('#t1-1', 'start', 1800, 120);
    await sleep(900);
    const expected = (await page.locator('#t1-1 .expected pre').innerText()).split('\n')[0].trim();
    const editor = page.locator('#t1-1 pre.code');
    await click(editor);
    await page.locator('#t1-1 .cm-content').waitFor({ timeout: 8000 });
    await sleep(500);
    if (!(await page.evaluate(() => document.activeElement?.classList.contains('cm-content')))) await click(page.locator('#t1-1 .cm-content'));
    await sleep(300);
    await page.keyboard.press('Meta+A');
    const code = `function sayHello() { console.log(${JSON.stringify(expected)}); } sayHello(); sayHello(); sayHello();`;
    await page.keyboard.type(code, { delay: 38 });
    await sleep(700);
    await click(page.locator('#t1-1 button.run'));
    await page.locator('#t1-1 .check-fb.ok').waitFor({ timeout: 10000 }).catch(async (e) => { await page.screenshot({ path: '/private/tmp/claude-501/fail.png' }); throw e; });
  });
  // 6. XP, achievement toast, progress on the roadmap
  await step('xp', async () => {
    await sleep(2600);
    await page.goto(`${BASE}/${loc.url}/frontend-ai`);
    await settle();
    await sleep(900);
    await scrollTo('.rm-track', 'start', 1800);
  });
  await sleep(600);

  await ctx.close();
  const vid = readdirSync(tmp).find((f) => f.endsWith('.webm'));
  renameSync(join(tmp, vid), join(OUT, `${locKey}-${devKey}.webm`));
  rmSync(tmp, { recursive: true, force: true });
  if (errors.length) console.warn(locKey, devKey, 'page errors:', errors);
  return marks;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const locKey of Object.keys(LOCALES)) {
  const marks = {};
  for (const devKey of Object.keys(DEVICES)) {
    console.log('recording', locKey, devKey);
    marks[devKey] = await recordOne(browser, locKey, devKey);
  }
  writeFileSync(join(OUT, `${locKey}-marks.json`), JSON.stringify(marks, null, 2));
}
await browser.close();
console.log('done');
