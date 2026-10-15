import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LessonBody from '@/components/LessonBody';
import { getLesson, lessons } from '@/content/lessons';

export const dynamicParams = false;

export function generateStaticParams() {
  return lessons.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const lesson = getLesson((await params).slug);
  if (!lesson) return {};
  return { title: `Урок ${lesson.num} · ${lesson.title} — Ilmhona` };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = getLesson((await params).slug);
  if (!lesson) notFound();
  return <LessonBody lesson={lesson} />;
}
