import { isTag } from 'domhandler';
import { findAll, textContent } from 'domutils';
import parse, { htmlToDOM, type Element } from 'html-react-parser';
import type { Lesson } from '@/content/lessons';
import { readFragment } from '@/lib/lessons.server';
import { hasClass, makeReplaceOptions } from '@/lib/contentReplace';
import Pager from './Pager';
import Toc, { type TocItem } from './Toc';

export default function LessonBody({ lesson }: { lesson: Lesson }) {
  const raw = readFragment(lesson.file);
  const styleMatch = raw.match(/^<style>([\s\S]*?)<\/style>\n/);
  const css = styleMatch ? styleMatch[1] : '';
  const html = styleMatch ? raw.slice(styleMatch[0].length) : raw;

  const options = makeReplaceOptions(lesson.slug);

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
          {parse(html, options)}
          <Pager lesson={lesson} />
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
