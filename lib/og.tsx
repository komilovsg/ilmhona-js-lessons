import fs from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import type { CourseEntry } from '@/content/course';
import { modules } from '@/content/course';
import type { Locale } from '@/lib/i18n';
import { courseName, siteTexts, SITE_NAME } from '@/lib/site';

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

// Fonts are bundled (lib/og-fonts, @fontsource woff). Subsets share one family name: satori falls back per glyph,
// so Latin, Cyrillic and Cyrillic Extended (Tajik ӣ ӯ ҳ қ ғ ҷ) all resolve.
// Images are prerendered at build time (generateStaticParams), so reading from cwd is enough.
const load = async (name: string) => {
  const b = await fs.readFile(path.join(process.cwd(), 'lib', 'og-fonts', `${name}.woff`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const subsets = ['latin', 'cyrillic', 'cyrillic-ext'];

let cache: ReturnType<typeof loadFonts> | undefined;
const fonts = () => (cache ??= loadFonts());

async function loadFonts() {
  // grouped by weight: satori's per-glyph fallback otherwise picks a lighter Cyrillic face for bold text
  const spec: { family: string; weight: 600 | 700 | 800; file: string }[] = [
    ...subsets.map((s) => ({ family: 'Manrope', weight: 800 as const, file: `manrope-${s}-800-normal` })),
    ...subsets.map((s) => ({ family: 'Manrope', weight: 600 as const, file: `manrope-${s}-600-normal` })),
    ...subsets.map((s) => ({ family: 'Mono', weight: 700 as const, file: `jetbrains-mono-${s}-700-normal` })),
  ];
  return Promise.all(spec.map(async (f) => ({ name: f.family, weight: f.weight, style: 'normal' as const, data: await load(f.file) })));
}

const C = { bg: '#0f1613', accent: '#3ccf95', ink: '#eef3ef', mute: '#9fb3a8', card: '#1b2130', line: '#2a3245', code: '#e6e9ef', kw: '#c792ea', str: '#a5e075', cm: '#6b7794', num: '#f78c6c' };

const Mark = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <rect width="32" height="32" rx="8" fill={C.accent} />
    <path d="M7.5 24.5H13V18.5H19V12.5H24.5" fill="none" stroke="#0f1613" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const mono = { fontFamily: 'Mono', fontWeight: 700 } as const;
const row = { display: 'flex' } as const;

function CodeCard({ lines }: { lines: { t: string; c: string }[][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 440, background: C.card, border: `2px solid ${C.line}`, borderRadius: 24, padding: '22px 28px 28px', boxShadow: '0 30px 60px rgba(0,0,0,.45)', transform: 'rotate(-3deg)' }}>
      <div style={{ ...row, gap: 10, marginBottom: 22 }}>
        {['#ff6b5e', '#ffbd44', '#3ccf95'].map((c) => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
        ))}
      </div>
      {lines.map((ln, i) => (
        <div key={i} style={{ ...row, ...mono, fontSize: 26, lineHeight: 1.55, color: C.code, whiteSpace: 'pre' }}>
          {ln.map((s, j) => (
            <span key={j} style={{ color: s.c }}>
              {s.t}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

const sizeFor = (s: string, big: number, small: number, limit: number) => (s.length > limit ? small : big);

function Frame({ locale, children, card }: { locale: Locale; children: React.ReactNode; card: React.ReactNode }) {
  return (
    <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', background: C.bg, fontFamily: 'Manrope', color: C.ink, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -160, top: -220, width: 700, height: 700, borderRadius: 350, background: 'rgba(60,207,149,.13)' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, background: C.accent }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '56px 64px 52px 76px', justifyContent: 'space-between' }}>
        <div style={{ ...row, alignItems: 'center', gap: 18 }}>
          <Mark size={68} />
          <div style={{ fontSize: 38, fontWeight: 800 }}>{SITE_NAME}</div>
          <div style={{ ...row, marginLeft: 8, padding: '6px 16px', borderRadius: 999, border: `2px solid ${C.line}`, color: C.accent, fontSize: 24, fontWeight: 600 }}>{courseName[locale]}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 590 }}>{children}</div>
        <div style={{ ...row, color: C.mute, fontSize: 25, fontWeight: 600 }}>{siteTexts[locale].tagline}</div>
      </div>
      <div style={{ position: 'absolute', right: 56, bottom: 120, display: 'flex' }}>{card}</div>
    </div>
  );
}

export async function homeOg(locale: Locale) {
  const head = locale === 'ru' ? ['Сделай', 'первый шаг'] : ['Қадами', 'аввалро гузор'];
  const card = (
    <CodeCard
      lines={[
        [{ t: 'const ', c: C.kw }, { t: 'course', c: C.code }, { t: ' = {', c: C.code }],
        [{ t: '  js: ', c: C.code }, { t: "'с нуля'", c: C.str }, { t: ',', c: C.code }],
        [{ t: '  ai: ', c: C.code }, { t: 'true', c: C.kw }, { t: ',', c: C.code }],
        [{ t: '  lessons: ', c: C.code }, { t: '24', c: C.num }, { t: ',', c: C.code }],
        [{ t: '};', c: C.code }],
        [{ t: '// → ', c: C.cm }, { t: 'XP +100', c: C.accent }],
      ].map((l) => (locale === 'tg' ? l.map((s) => ({ ...s, t: s.t.replace('с нуля', 'аз сифр') })) : l))}
    />
  );
  return new ImageResponse(
    (
      <Frame locale={locale} card={card}>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{head[0]}</div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, color: C.accent }}>{head[1]}</div>
      </Frame>
    ),
    { ...ogSize, fonts: await fonts() },
  );
}

export async function lessonOg(locale: Locale, c: CourseEntry) {
  const t = siteTexts[locale];
  const mod = modules.find((m) => m.id === c.module);
  const title = c.title[locale].replace(/№\s?/g, '#'); // № is missing from the bundled font subsets
  const num = String(c.num).padStart(2, '0');
  const card = (
    <CodeCard
      lines={[
        [{ t: `// ${t.lesson} ${num}`, c: C.cm }],
        [{ t: 'const ', c: C.kw }, { t: 'lesson', c: C.code }, { t: ' = ', c: C.code }],
        [{ t: `  '${c.slug.length > 14 ? c.slug.slice(0, 13) + '…' : c.slug}'`, c: C.str }, { t: ';', c: C.code }],
        [{ t: 'lesson.', c: C.code }, { t: 'done', c: C.accent }, { t: '();', c: C.code }],
        [{ t: '// → ', c: C.cm }, { t: 'XP +100', c: C.accent }],
      ]}
    />
  );
  return new ImageResponse(
    (
      <Frame locale={locale} card={card}>
        <div style={{ ...row, alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <div style={{ ...row, ...mono, fontSize: 30, color: '#0f1613', background: C.accent, borderRadius: 12, padding: '4px 16px' }}>{num}</div>
          <div style={{ ...row, fontSize: 27, fontWeight: 600, color: C.accent }}>
            {mod ? `${t.moduleWord} ${mod.id} · ${mod.title[locale]}` : ''}
          </div>
        </div>
        <div style={{ fontSize: sizeFor(title, 84, 62, 22), fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, display: 'flex', flexWrap: 'wrap', maxWidth: 590 }}>{title}</div>
      </Frame>
    ),
    { ...ogSize, fonts: await fonts() },
  );
}

/** 180x180 apple-touch-icon: the logo mark, full-bleed (iOS rounds the corners itself). */
export function appleIcon() {
  return new ImageResponse(
    (
      <svg width="180" height="180" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#0e7a55" />
        <path d="M7.5 24.5H13V18.5H19V12.5H24.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    { width: 180, height: 180 },
  );
}
