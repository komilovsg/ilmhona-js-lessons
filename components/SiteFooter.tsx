import Link from 'next/link';
import { toUrlLocale, type Locale } from '@/lib/i18n';
import { footerLabels } from '@/lib/legal';

export default function SiteFooter({ locale }: { locale: Locale }) {
  const l = footerLabels(locale);
  const base = `/${toUrlLocale(locale)}`;
  return (
    <footer className="site-footer">
      <Link href={`${base}/privacy`}>{l.privacy}</Link>
      <Link href={`${base}/terms`}>{l.terms}</Link>
    </footer>
  );
}
