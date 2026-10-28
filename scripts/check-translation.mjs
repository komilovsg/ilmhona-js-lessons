// Guards a lesson translation: everything that affects running code or auto-check must be identical.
// Usage: node scripts/check-translation.mjs [tg] [--course vibe-coding|react-next] [NN-slug.html ...]
// Default: all files present in content/lessons/<locale> (or content/<course>/lessons/<locale> with --course vibe-coding|react-next).
import fs from 'node:fs';

const args = process.argv.slice(2);
const ci = args.indexOf('--course');
const course = ci >= 0 ? args.splice(ci, 2)[1] : 'frontend';
const base = course === 'frontend' ? 'content/lessons' : `content/${course}/lessons`;
const locale = args[0] && !args[0].endsWith('.html') ? args[0] : 'tg';
const files = args.filter((a) => a.endsWith('.html'));
const dir = (l) => new URL(`../${base}/${l}/`, import.meta.url);
const list = files.length ? files : (fs.existsSync(dir(locale)) ? fs.readdirSync(dir(locale)) : []).filter((f) => f.endsWith('.html'));

// comments are translatable; everything else inside <pre> must match
const stripComments = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, '/**/')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1//')
    .replace(/&lt;!--[\s\S]*?--&gt;/g, '<!---->');

const grab = (html) => ({
  pres: [...html.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g)].map((m) => [m[1].replace(/\sdata-title="[^"]*"/, ''), stripComments(m[2])]),
  expected: [...html.matchAll(/class="expected"[\s\S]*?<pre>([\s\S]*?)<\/pre>/g)].map((m) => m[1]),
  tasks: [...html.matchAll(/<article class="task" id="([^"]+)"/g)].map((m) => m[1]),
  levels: [...html.matchAll(/class="level (easy|mid|hard)"/g)].map((m) => m[1]),
  sections: [...html.matchAll(/<section[^>]*\sid="([^"]+)"/g)].map((m) => m[1]),
  hrefs: [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
  hints: (html.match(/<details class="hint"/g) || []).length,
  playgrounds: [...html.matchAll(/class="playground" data-mode="(\w+)"/g)].map((m) => m[1]),
  imgs: [...html.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]),
  yt: [...html.matchAll(/<div class="yt"[^>]*\sdata-id="([^"]+)"/g)].map((m) => m[1]),
  quizzes: [...html.matchAll(/<div class="quiz" data-answer="([^"]+)">/g)].map((m) => m[1]),
  checklists: [...html.matchAll(/<ul class="checklist" id="([^"]+)">([\s\S]*?)<\/ul>/g)].map((m) => `${m[1]}:${(m[2].match(/<li>/g) || []).length}`),
  hosts: [...html.matchAll(/<div class="submit-link"[^>]*\sdata-hosts="([^"]*)"/g)].map((m) => m[1]),
});

let bad = 0;
for (const f of list) {
  const ruPath = new URL(f, dir('ru'));
  if (!fs.existsSync(ruPath)) { console.log(`✗ ${f}: no ru source`); bad++; continue; }
  const a = grab(fs.readFileSync(ruPath, 'utf8'));
  const b = grab(fs.readFileSync(new URL(f, dir(locale)), 'utf8'));
  const errs = [];
  for (const k of ['tasks', 'levels', 'sections', 'hrefs', 'playgrounds', 'expected', 'imgs', 'yt', 'quizzes', 'checklists', 'hosts']) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      const i = a[k].findIndex((v, j) => JSON.stringify(v) !== JSON.stringify(b[k][j]));
      errs.push(`${k} differ (ru ${a[k].length} vs ${locale} ${b[k].length}; first at #${i}: ${JSON.stringify(a[k][i])?.slice(0, 80)} ≠ ${JSON.stringify(b[k][i])?.slice(0, 80)})`);
    }
  }
  if (a.hints !== b.hints) errs.push(`hints count ${a.hints} vs ${b.hints}`);
  if (a.pres.length !== b.pres.length) errs.push(`pre blocks ${a.pres.length} vs ${b.pres.length}`);
  else a.pres.forEach((p, i) => {
    if (p[0] !== b.pres[i][0]) errs.push(`pre #${i} attributes differ`);
    else if (p[1] !== b.pres[i][1]) {
      const x = p[1].split('\n'), y = b.pres[i][1].split('\n');
      const l = x.findIndex((s, j) => s !== y[j]);
      errs.push(`pre #${i} code differs at line ${l + 1}: ${JSON.stringify(x[l])?.slice(0, 70)} ≠ ${JSON.stringify(y[l])?.slice(0, 70)}`);
    }
  });
  if (errs.length) { bad++; console.log(`✗ ${f}\n  - ${errs.slice(0, 8).join('\n  - ')}`); }
  else console.log(`✓ ${f}`);
}
process.exit(bad ? 1 : 0);
