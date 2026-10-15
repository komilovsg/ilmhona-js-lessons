import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import parse from 'html-react-parser';
import { makeReplaceOptions } from '@/lib/contentReplace';

// Dev-only demo of the runner modes (404 in production, see devPagesEnabled). Not linked anywhere, not indexed. Goes through the same
// parse + replace path as lesson fragments, so it also proves the fragment format.
export const metadata: Metadata = { title: 'Playground (dev)', robots: { index: false, follow: false } };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pre = (attrs: string, code: string) => `<pre class="code" ${attrs}>${esc(code.trim())}</pre>`;

const asyncDemo = `console.log('start');
setTimeout(() => console.log('timeout 500ms'), 500);
Promise.resolve().then(() => console.log('promise (microtask)'));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  await wait(300);
  console.log('await 300ms');
  await wait(300);
  console.log('await 600ms');
}
main().then(() => console.log('main done'));
console.log('end of script');`;

const intervalDemo = `let n = 0;
const id = setInterval(() => {
  n++;
  console.log('tick', n);
  if (n === 3) clearInterval(id);
}, 200);`;

const rejectDemo = `async function load() {
  throw new Error('что-то пошло не так');
}
load();`;

const fetchDemo = `const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');
const todo = await res.json();
console.log(todo);
console.log('title:', todo.title);`;

const loopDemo = `while (true) {}`;

const domHtml = `<h2>Товары</h2>
<button id="clear">Очистить</button>
<div id="list" class="grid"></div>`;

const domCss = `body { font-family: system-ui, sans-serif; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: 12px; }
.card { border: 1px solid #ddd; border-radius: 10px; padding: 10px; background: #fafafa; }
.card b { display: block; }
.card span { color: #0e7a55; font-weight: 700; }`;

const domJs = `const products = Array.from({ length: 10 }, (_, i) => ({
  name: 'Товар ' + (i + 1),
  price: (i + 1) * 15,
}));

const list = document.querySelector('#list');
for (const p of products) {
  const card = document.createElement('div');
  card.className = 'card';
  const name = document.createElement('b');
  name.textContent = p.name;
  const price = document.createElement('span');
  price.textContent = p.price + ' с.';
  card.append(name, price);
  list.append(card);
}
console.log('карточек:', list.children.length);

document.querySelector('#clear').addEventListener('click', () => {
  list.replaceChildren();
  console.log('очищено');
});`;

const reactJsx = `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="box">
      <p>Нажато: <b id="count">{count}</b></p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}`;

const reactCss = `.box { font-family: system-ui, sans-serif; }
button { padding: 6px 14px; font-size: 16px; }`;

const markup = `
<section>
  <h2>Console: async</h2>
  ${pre('data-run data-title="setTimeout + Promise + async/await"', asyncDemo)}
  ${pre('data-run data-title="setInterval (stops itself)"', intervalDemo)}
  ${pre('data-run data-title="Unhandled rejection"', rejectDemo)}
  ${pre('data-run data-title="Infinite loop (must recover)"', loopDemo)}
</section>
<section>
  <h2>Console: fetch</h2>
  ${pre('data-run data-title="fetch todos/1"', fetchDemo)}
</section>
<section>
  <h2>DOM playground</h2>
  <div class="playground" data-mode="dom" data-title="Карточки товаров">
    ${pre('data-lang="html"', domHtml)}
    ${pre('data-lang="css"', domCss)}
    ${pre('data-lang="js"', domJs)}
  </div>
</section>
<section>
  <h2>React playground</h2>
  <div class="playground" data-mode="react" data-title="Счётчик">
    ${pre('data-lang="jsx"', reactJsx)}
    ${pre('data-lang="css"', reactCss)}
  </div>
</section>`;

// Hidden in production builds unless NEXT_PUBLIC_ENABLE_DEV_PAGES=1 (inlined at build time).
const devPagesEnabled =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEV_PAGES === '1';

export default function PlaygroundDemo() {
  if (!devPagesEnabled) notFound();
  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr' }}>
      <main>
        <h1>Runner playground (dev)</h1>
        {parse(markup, makeReplaceOptions('dev'))}
      </main>
    </div>
  );
}
