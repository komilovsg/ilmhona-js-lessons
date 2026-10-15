import type { Metadata } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import I18nProvider from '@/components/I18nProvider';
import { getMessages, isLocale, locales } from '@/lib/i18n';
import { getTaskIds } from '@/lib/lessons.server';
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
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getMessages(locale).meta.siteTitle,
    icons: {
      icon: "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Crect width=%2732%27 height=%2732%27 rx=%278%27 fill=%27%230e7a55%27/%3E%3Ctext x=%2716%27 y=%2723%27 font-family=%27Arial%27 font-weight=%27700%27 font-size=%2720%27 fill=%27white%27 text-anchor=%27middle%27%3EI%3C/text%3E%3C/svg%3E",
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} className={`${manrope.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* themeScript is a constant from lib/theme.ts, no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <Header taskIds={getTaskIds()} />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
