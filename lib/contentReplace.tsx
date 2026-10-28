/**
 * html-react-parser `replace` for lesson HTML fragments: turns authoring markup into React components.
 *
 * ---------------------------------------------------------------------------------------------
 * CONTENT FORMAT (lesson fragments, content/lessons/*.html)
 *
 * 1. Console block (default). Static when no `data-run`; live editor + console output with it.
 *      <pre class="code" data-run data-title="Optional header text" data-lang="js">…code…</pre>
 *    `data-lang` is optional: js (default) | jsx | ts | html | css (syntax highlighting only, except ts).
 *    Console mode is async-aware: setTimeout / setInterval / Promise / fetch / async-await work,
 *    the run ends when nothing is pending (hard cap 8 s).
 *    TypeScript block (needs data-run to be checked; also works inside <article class="task">):
 *      <pre class="code" data-run data-lang="ts">const n: number = 'a';</pre>
 *    On Run the snippet is type-checked with the real compiler (strict, ES2022 + DOM lib, always a module so top-level
 *    await works), then transpiled and executed in the console runner exactly like a JS block. Diagnostics are
 *    printed above the console output as `Строка 3, столбец 7: Type 'string' is not assignable to type 'number'.
 *    (TS2322)` (English compiler text kept on purpose) and underlined in the editor. In a task any type error counts
 *    like an uncaught error: the `.expected` comparison is skipped, so «исправь ошибку типов» tasks work. The compiler
 *    (self-hosted /ts-lib/typescript.js + libs.json in a Web Worker, see lib/tscheck.ts) loads on the first Run of a ts
 *    block only; pages without ts blocks never request it. react playgrounds stay strip-only (no type errors shown).
 *
 * 2. Playground: one editor with file tabs, a visible sandboxed preview and a console panel.
 *      <div class="playground" data-mode="dom" data-title="Карточки товаров">
 *        <pre class="code" data-lang="html">…</pre>      -> tab index.html (body markup, no <html>/<body>)
 *        <pre class="code" data-lang="css">…</pre>       -> tab style.css   (optional)
 *        <pre class="code" data-lang="js">…</pre>        -> tab script.js
 *      </div>
 *      <div class="playground" data-mode="react" data-title="Счётчик">
 *        <pre class="code" data-lang="jsx">…</pre>       -> tab App.jsx (export default function App)
 *        <pre class="code" data-lang="css">…</pre>       -> tab style.css (optional)
 *      </div>
 *    Rules: the <pre> children are matched by data-lang (html/css/js for dom; jsx/css for react),
 *    order is irrelevant, text is taken as-is (escape < as &lt; inside the <pre>).
 *    dom: the JS runs as an ES module after the HTML is parsed. react: JSX is compiled in the
 *    browser (sucrase); React 19 + react-dom come from esm.sh (pinned) so it needs internet.
 *    The preview is a sandbox="allow-scripts" iframe (no same-origin): fetch to CORS-enabled
 *    public APIs works, localStorage/cookies of the host are unreachable.
 *
 * 3. Vibe Coding practice blocks (content/vibe-coding/lessons). Graded ones sit inside <article class="task">.
 *    - Video, click-to-load (youtube-nocookie): <div class="yt" data-id="11-char id" data-title="…" data-start="90"></div>
 *    - Checklist (state in localStorage, all ticked inside a task = solved, half XP):
 *        <ul class="checklist" id="cl-x"><li>…</li></ul>
 *    - Quiz, data-answer is 1-based ("2" = one answer, "1,3" = several; all quizzes of a task solved = solved):
 *        <div class="quiz" data-answer="2"><p>Question</p><ol class="options"><li>…</li></ol><div class="explain">…</div></div>
 *    - Homework link (https, host must equal / be a subdomain of one of data-hosts; saved = solved, half XP):
 *        <div class="submit-link" data-hosts="vercel.app github.com" data-placeholder="https://…"></div>
 *    - Copyable prompt: existing <div class="prompt good-prompt">. Screenshot: <figure class="shot"><img …><figcaption>.
 *      Diagram: inline <figure class="diagram"><svg>.
 * ---------------------------------------------------------------------------------------------
 */
import { isTag } from 'domhandler';
import { findOne, textContent } from 'domutils';
import { domToReact, Element, type DOMNode, type HTMLReactParserOptions } from 'html-react-parser';
import CodeBlock from '@/components/CodeBlock';
import Playground, { type PlaygroundFile } from '@/components/Playground';
import Checklist from '@/components/Checklist';
import Prompt from '@/components/Prompt';
import Quiz from '@/components/Quiz';
import SubmitLink from '@/components/SubmitLink';
import Task from '@/components/Task';
import YouTube from '@/components/YouTube';
import type { Lang } from '@/lib/highlight';

export const hasClass = (el: Element, c: string) => (el.attribs.class ?? '').split(/\s+/).includes(c);

const LANGS: Lang[] = ['js', 'jsx', 'ts', 'html', 'css'];
const preText = (el: Element) => textContent(el).replace(/^\n/, '').replace(/\s+$/, '');

function playgroundFiles(node: Element, mode: 'dom' | 'react'): PlaygroundFile[] {
  const pres = node.children.filter((c): c is Element => isTag(c) && c.name === 'pre');
  const pick = (lang: string) => pres.find((p) => p.attribs['data-lang'] === lang);
  const file = (name: string, lang: Lang, el?: Element): PlaygroundFile[] =>
    el ? [{ name, lang, code: preText(el) }] : [];
  return mode === 'react'
    ? [...file('App.jsx', 'jsx', pick('jsx')), ...file('style.css', 'css', pick('css'))]
    : [
        ...file('index.html', 'html', pick('html')),
        ...file('style.css', 'css', pick('css')),
        ...file('script.js', 'js', pick('js')),
      ];
}

export function makeReplaceOptions(lessonSlug: string): HTMLReactParserOptions {
  const options: HTMLReactParserOptions = {
    replace(node) {
      if (!isTag(node)) return;
      if (node.name === 'div' && hasClass(node, 'playground')) {
        const mode = node.attribs['data-mode'] === 'react' ? 'react' : 'dom';
        const files = playgroundFiles(node, mode);
        if (files.length) return <Playground mode={mode} title={node.attribs['data-title']} files={files} />;
      }
      if (node.name === 'div' && hasClass(node, 'yt')) {
        const start = Number(node.attribs['data-start']);
        return <YouTube id={node.attribs['data-id'] ?? ''} title={node.attribs['data-title']} start={start > 0 ? start : undefined} />;
      }
      if (node.name === 'ul' && hasClass(node, 'checklist') && node.attribs.id) {
        const items = node.children.filter((c): c is Element => isTag(c) && c.name === 'li');
        return <Checklist id={node.attribs.id} lessonKey={lessonSlug} items={items.map((li) => domToReact(li.children as DOMNode[], options))} />;
      }
      if (node.name === 'div' && hasClass(node, 'quiz')) {
        const kids = node.children;
        const list = kids.find((c): c is Element => isTag(c) && c.name === 'ol' && hasClass(c, 'options'));
        const explain = kids.find((c): c is Element => isTag(c) && hasClass(c, 'explain'));
        const answer = (node.attribs['data-answer'] ?? '').split(',').map(Number).filter((n) => n > 0);
        if (list && answer.length) {
          const lis = list.children.filter((c): c is Element => isTag(c) && c.name === 'li');
          return (
            <Quiz
              answer={answer}
              question={domToReact(kids.filter((c) => c !== list && c !== explain) as DOMNode[], options)}
              options={lis.map((li) => domToReact(li.children as DOMNode[], options))}
              explain={explain && <div className="explain">{domToReact(explain.children as DOMNode[], options)}</div>}
            />
          );
        }
      }
      if (node.name === 'div' && hasClass(node, 'submit-link')) {
        const hosts = (node.attribs['data-hosts'] ?? '').split(/\s+/).filter(Boolean);
        return <SubmitLink lessonKey={lessonSlug} hosts={hosts} placeholder={node.attribs['data-placeholder']} />;
      }
      if (node.name === 'pre' && hasClass(node, 'code')) {
        const l = node.attribs['data-lang'] as Lang;
        return (
          <CodeBlock
            code={preText(node)}
            run={'data-run' in node.attribs}
            title={node.attribs['data-title']}
            lang={LANGS.includes(l) ? l : 'js'}
          />
        );
      }
      if (node.name === 'article' && hasClass(node, 'task')) {
        const lvl = findOne((e) => hasClass(e, 'level'), node.children, true);
        const level = (['easy', 'mid', 'hard'] as const).find((l) => lvl && hasClass(lvl, l)) ?? null;
        return (
          <Task id={node.attribs.id} lessonSlug={lessonSlug} level={level}>
            {domToReact(node.children as DOMNode[], options)}
          </Task>
        );
      }
      if (hasClass(node, 'prompt')) {
        return (
          <Prompt className={node.attribs.class} text={textContent(node).trim()}>
            {domToReact(node.children as DOMNode[], options)}
          </Prompt>
        );
      }
    },
  };
  return options;
}
