import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://ilmhona-js-lessons.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/*/dev/', '/*/admin/'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
