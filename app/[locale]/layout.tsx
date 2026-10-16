import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import SiteFooter from '@/components/SiteFooter';
import I18nProvider from '@/components/I18nProvider';
import { fromUrlLocale, urlLocales } from '@/lib/i18n';
import { SITE_NAME, SITE_URL, alternatesFor, siteTexts } from '@/lib/site';
import { themeScript } from '@/lib/theme';
import '../globals.css';

// next/font self-hosts the files and declares @font-face with the plain family names
// ("Manrope", "JetBrains Mono"), so the --font/--mono vars in globals.css resolve unchanged.
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-manrope',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const dynamicParams = false;

export function generateStaticParams() {
  return urlLocales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) return {};
  const t = siteTexts[locale];
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${SITE_NAME} — ${t.homeTitle}`, template: `%s — ${SITE_NAME}` },
    description: t.description,
    applicationName: SITE_NAME,
    keywords: [...t.keywords],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    alternates: alternatesFor(locale),
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: `${SITE_NAME} — ${t.homeTitle}`,
      description: t.description,
      locale: locale === 'ru' ? 'ru_RU' : 'tg_TJ',
      alternateLocale: [locale === 'ru' ? 'tg_TJ' : 'ru_RU'],
    },
    twitter: { card: 'summary_large_image', title: `${SITE_NAME} — ${t.homeTitle}`, description: t.description },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f4ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1613' },
  ],
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) notFound();
  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${manrope.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* themeScript is a constant from lib/theme.ts, no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <Header />
          {children}
          <SiteFooter locale={locale} />
        </I18nProvider>
      </body>
    </html>
  );
}
