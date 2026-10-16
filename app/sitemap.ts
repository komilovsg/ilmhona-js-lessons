import type { MetadataRoute } from 'next';
import { AVAILABLE } from '@/lib/lesson-meta.generated';
import { SITE_URL as base } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const l of ['ru', 'tj']) {
    out.push({ url: `${base}/${l}` });
    for (const slug of AVAILABLE) out.push({ url: `${base}/${l}/lessons/${slug}` });
    out.push({ url: `${base}/${l}/leaderboard` });
    out.push({ url: `${base}/${l}/privacy` }, { url: `${base}/${l}/terms` });
  }
  return out;
}
