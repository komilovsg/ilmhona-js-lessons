import { isTag } from 'domhandler';
import { findAll, findOne, textContent } from 'domutils';
import parse, { domToReact, htmlToDOM, Element, type DOMNode, type HTMLReactParserOptions } from 'html-react-parser';
import type { Lesson } from '@/content/lessons';
import { getMessages, type Locale } from '@/lib/i18n';
import { readFragment } from '@/lib/lessons.server';
import CodeBlock from './CodeBlock';
import Pager from './Pager';
import Prompt from './Prompt';
import Task from './Task';
import Toc, { type TocItem } from './Toc';

const hasClass = (el: Element, c: string) => (el.attribs.class ?? '').split(/\s+/).includes(c);

export default function LessonBody({ lesson, locale }: { lesson: Lesson; locale: Locale }) {
  const { html: raw, isFallback } = readFragment(lesson.file, locale);
  const styleMatch = raw.match(/^<style>([\s\S]*?)<\/style>\n/);
  const css = styleMatch ? styleMatch[1] : '';
  const html = styleMatch ? raw.slice(styleMatch[0].length) : raw;

  const options: HTMLReactParserOptions = {
    replace(node) {
      if (!isTag(node)) return;
      if (node.name === 'pre' && hasClass(node, 'code')) {
        const code = textContent(node).replace(/^\n/, '').replace(/\s+$/, '');
        return <CodeBlock code={code} run={'data-run' in node.attribs} title={node.attribs['data-title']} />;
      }
      if (node.name === 'article' && hasClass(node, 'task')) {
        const lvl = findOne((e) => hasClass(e, 'level'), node.children, true);
        const level = (['easy', 'mid', 'hard'] as const).find((l) => lvl && hasClass(lvl, l)) ?? null;
        return (
          <Task id={node.attribs.id} lessonSlug={lesson.slug} level={level}>
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

  // Table of contents: `main section[id] > h2`, with the tasks inside each section.
  const items = tocItems(html);

  return (
    <>
      {css && <style>{css}</style>}
      <div className="layout">
        <aside className="toc">
          <Toc items={items} lessonSlug={lesson.slug} />
        </aside>
        <main>
          {isFallback && (
            <div className="callout fallback-notice" role="note">
              <p>{getMessages(locale).lesson.fallbackNotice}</p>
            </div>
          )}
          {parse(html, options)}
          <Pager lesson={lesson} locale={locale} />
        </main>
      </div>
    </>
  );
}

function tocItems(html: string): TocItem[] {
  const nodes = htmlToDOM(html);
  const heads = findAll(
    (e) => e.name === 'h2' && !!e.parent && isTag(e.parent) && e.parent.name === 'section' && !!e.parent.attribs.id,
    nodes,
  );
  return heads.map((h) => {
    const section = h.parent as Element;
    const tasks = findAll((e) => hasClass(e, 'task'), section.children);
    return {
      id: section.attribs.id,
      label: h.attribs['data-toc'] || textContent(h).replace(/^\s*\d+\s*/, '').trim(),
      taskIds: tasks.map((t) => t.attribs.id),
    };
  });
}
