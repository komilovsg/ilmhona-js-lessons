// Guards a lesson translation: everything that affects running code or auto-check must be identical.
// Usage: node scripts/check-translation.mjs [tg] [NN-slug.html ...]   (default: all files present in content/lessons/<locale>)
import fs from 'node:fs';

const locale = process.argv[2] && !process.argv[2].endsWith('.html') ? process.argv[2] : 'tg';
const files = process.argv.slice(2).filter((a) => a.endsWith('.html'));
const dir = (l) => new URL(`../content/lessons/${l}/`, import.meta.url);
const list = files.length ? files : fs.readdirSync(dir(locale)).filter((f) => f.endsWith('.html'));

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
});

let bad = 0;
for (const f of list) {
  const ruPath = new URL(f, dir('ru'));
  if (!fs.existsSync(ruPath)) { console.log(`✗ ${f}: no ru source`); bad++; continue; }
  const a = grab(fs.readFileSync(ruPath, 'utf8'));
  const b = grab(fs.readFileSync(new URL(f, dir(locale)), 'utf8'));
  const errs = [];
  for (const k of ['tasks', 'levels', 'sections', 'hrefs', 'playgrounds', 'expected']) {
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
