import type { Metadata } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import I18nProvider from '@/components/I18nProvider';
import { getMessages, fromUrlLocale, urlLocales } from '@/lib/i18n';
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
  return {
    title: getMessages(locale).meta.siteTitle,
  };
}

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
    <html lang={locale} className={`${manrope.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* themeScript is a constant from lib/theme.ts, no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <Header />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
