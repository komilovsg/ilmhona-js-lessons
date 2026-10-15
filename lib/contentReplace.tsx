/**
 * html-react-parser `replace` for lesson HTML fragments: turns authoring markup into React components.
 *
 * ---------------------------------------------------------------------------------------------
 * CONTENT FORMAT (lesson fragments, content/lessons/*.html)
 *
 * 1. Console block (default). Static when no `data-run`; live editor + console output with it.
 *      <pre class="code" data-run data-title="Optional header text" data-lang="js">…code…</pre>
 *    `data-lang` is optional: js (default) | jsx | html | css (syntax highlighting only).
 *    Console mode is async-aware: setTimeout / setInterval / Promise / fetch / async-await work,
 *    the run ends when nothing is pending (hard cap 8 s).
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
 * ---------------------------------------------------------------------------------------------
 */
import { isTag } from 'domhandler';
import { findOne, textContent } from 'domutils';
import { domToReact, Element, type DOMNode, type HTMLReactParserOptions } from 'html-react-parser';
import CodeBlock from '@/components/CodeBlock';
import Playground, { type PlaygroundFile } from '@/components/Playground';
import Prompt from '@/components/Prompt';
import Task from '@/components/Task';
import type { Lang } from '@/lib/highlight';

export const hasClass = (el: Element, c: string) => (el.attribs.class ?? '').split(/\s+/).includes(c);

const LANGS: Lang[] = ['js', 'jsx', 'html', 'css'];
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
