import type { MetadataRoute } from 'next';
import { SITE_URL as base } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/*/dev/', '/*/admin/'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
