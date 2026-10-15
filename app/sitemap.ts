import type { MetadataRoute } from 'next';
import { AVAILABLE } from '@/lib/lesson-meta.generated';

const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://ilmhona-js-lessons.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const l of ['ru', 'tj']) {
    out.push({ url: `${base}/${l}` });
    for (const slug of AVAILABLE) out.push({ url: `${base}/${l}/lessons/${slug}` });
    out.push({ url: `${base}/${l}/leaderboard` });
  }
  return out;
}
