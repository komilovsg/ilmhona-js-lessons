import type { Metadata } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import Header from '@/components/Header';
import { getTaskIds } from '@/lib/lessons.server';
import './globals.css';

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

export const metadata: Metadata = {
  title: 'Ilmhona',
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Crect width=%2732%27 height=%2732%27 rx=%278%27 fill=%27%230e7a55%27/%3E%3Ctext x=%2716%27 y=%2723%27 font-family=%27Arial%27 font-weight=%27700%27 font-size=%2720%27 fill=%27white%27 text-anchor=%27middle%27%3EI%3C/text%3E%3C/svg%3E",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${jetbrains.variable}`}>
      <body>
        <Header taskIds={getTaskIds()} />
        {children}
      </body>
    </html>
  );
}
