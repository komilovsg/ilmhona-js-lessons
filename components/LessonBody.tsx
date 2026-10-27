import { isTag } from 'domhandler';
import { findAll, textContent } from 'domutils';
import parse, { htmlToDOM, type Element } from 'html-react-parser';
import type { CourseEntry } from '@/content/course';
import { COURSES, lessonKey, type CourseId } from '@/lib/courses';
import { getMessages, type Locale } from '@/lib/i18n';
import { neighbours, readFragment } from '@/lib/lessons.server';
import { hasClass, makeReplaceOptions } from '@/lib/contentReplace';
import MentorChat from './MentorChat';
import Pager from './Pager';
import Toc, { type TocItem } from './Toc';

export default function LessonBody({
  lesson,
  locale,
  courseId = 'frontend',
}: {
  lesson: CourseEntry;
  locale: Locale;
  courseId?: CourseId;
}) {
  const c = COURSES[courseId];
  const key = lessonKey(c, lesson.slug);
  const { html: raw, isFallback } = readFragment(lesson, locale, c);
  const styleMatch = raw.match(/^<style>([\s\S]*?)<\/style>\n/);
  const css = styleMatch ? styleMatch[1] : '';
  const html = styleMatch ? raw.slice(styleMatch[0].length) : raw;

  const options = makeReplaceOptions(key);

  // Table of contents: `main section[id] > h2`, with the tasks inside each section.
  const items = tocItems(html);

  return (
    <>
      {css && <style>{css}</style>}
      <div className="layout">
        <aside className="toc">
          <Toc items={items} lessonSlug={key} />
        </aside>
        <main>
          {isFallback && (
            <div className="callout fallback-notice" role="note">
              <p>{getMessages(locale).lesson.fallbackNotice}</p>
            </div>
          )}
          {parse(html, options)}
          <Pager {...neighbours(lesson.slug, c)} locale={locale} courseId={courseId} />
        </main>
        <MentorChat key={key} lessonSlug={key} />
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
