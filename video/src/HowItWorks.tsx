import { AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Video } from '@remotion/media';
import { loadFont } from '@remotion/google-fonts/Manrope';
import { loadFont as loadNoto } from '@remotion/google-fonts/NotoSans';

const subsets = ['cyrillic', 'cyrillic-ext', 'latin'] as const;
const weights = ['500', '700', '800'] as const;
const manrope = loadFont('normal', { weights: [...weights], subsets: [...subsets] }).fontFamily;
// Manrope has no Tajik letters (ҷ, ҳ ...): the Tajik version uses Noto Sans, which has them.
const noto = loadNoto('normal', { weights: [...weights], subsets: [...subsets] }).fontFamily;

export const FPS = 30;
type Locale = 'ru' | 'tg';
type Marks = Record<string, number>;
export type HowProps = { locale: Locale; marks: { desktop: Marks; mobile: Marks } };

// Chapters in the order of the recording (see ../record.mjs). `sec` = length on screen.
const CHAPTERS = [
  { id: 'choose', sec: 8 },
  { id: 'roadmap', sec: 8 },
  { id: 'theory', sec: 8 },
  { id: 'quiz', sec: 8 },
  { id: 'task', sec: 11 },
  { id: 'xp', sec: 8 },
] as const;
const END_SEC = 3;
const frames = (s: number) => Math.round(s * FPS);
export const TOTAL_FRAMES = CHAPTERS.reduce((n, c) => n + frames(c.sec), 0) + frames(END_SEC);

// Captions follow the terms of messages/ru.ts and messages/tg.ts.
const TEXT: Record<Locale, { captions: string[]; end: string; endSub: string }> = {
  ru: {
    captions: ['Выберите курс', 'Карта курса', 'Теория и видео', 'Тест с автопроверкой', 'Задача в редакторе', 'Опыт и достижения'],
    end: 'Начните с первого шага',
    endSub: 'Бесплатно · ksg-courses.online',
  },
  tg: {
    captions: ['Курсро интихоб кунед', 'Харитаи курс', 'Назария ва видео', 'Тест бо санҷиши худкор', 'Вазифа дар муҳаррир', 'Таҷриба ва дастовардҳо'],
    end: 'Аз қадами аввал оғоз кунед',
    endSub: 'Ройгон · ksg-courses.online',
  },
};

const C = {
  bg: '#0f1613',
  panel: '#151e1a',
  line: '#26332d',
  ink: '#e5ece7',
  ink2: '#b2beb7',
  accent: '#3ccf95',
  accentDeep: '#0e7a55',
  metal: '#222c27',
  metalHi: '#34423b',
};

const LAPTOP = { w: 1120, h: 700, bezel: 14 };
const PHONE = { w: 330, h: 714, bezel: 11 };

const Logo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <rect width="32" height="32" rx="8" fill={C.accent} />
    <path d="M7.5 24.5H13V18.5H19V12.5H24.5" fill="none" stroke="#06231a" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** One chapter of a recording, trimmed to its marks and time-stretched to the chapter length. */
const Clip = ({ src, from, to, len }: { src: string; from: number; to: number; len: number }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const srcFrames = ((to - from) / 1000) * FPS;
  return (
    <AbsoluteFill style={{ opacity }}>
      <Video
        src={staticFile(src)}
        trimBefore={Math.round((from / 1000) * FPS)}
        playbackRate={Math.max(0.5, Math.min(2, srcFrames / len))}
        muted
        objectFit="cover"
        style={{ width: '100%', height: '100%' }}
      />
    </AbsoluteFill>
  );
};

const Screen = ({ w, h, radius, src, marks, locale }: { w: number; h: number; radius: number; src: 'desktop' | 'mobile'; marks: Marks; locale: Locale }) => {
  let at = 0;
  return (
    <div style={{ width: w, height: h, borderRadius: radius, overflow: 'hidden', background: '#fff', position: 'relative' }}>
      {CHAPTERS.map((c) => {
        const len = frames(c.sec);
        const from = at;
        at += len;
        const m0 = marks[c.id] ?? 0;
        const m1 = marks[c.id + 'End'] ?? m0 + c.sec * 1000;
        return (
          <Sequence key={c.id} from={from} durationInFrames={len} layout="none">
            <Clip src={`rec/${locale}-${src}.mp4`} from={m0} to={m1} len={len} />
          </Sequence>
        );
      })}
    </div>
  );
};

const Laptop = (p: { marks: Marks; locale: Locale }) => (
  <div style={{ width: 1280, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div
      style={{
        width: LAPTOP.w + LAPTOP.bezel * 2,
        height: LAPTOP.h + LAPTOP.bezel * 2,
        borderRadius: '22px 22px 6px 6px',
        background: `linear-gradient(160deg, ${C.metalHi}, ${C.metal})`,
        padding: LAPTOP.bezel,
        position: 'relative',
        boxShadow: '0 40px 80px rgba(0,0,0,.45)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'absolute', top: 5, left: '50%', width: 6, height: 6, marginLeft: -3, borderRadius: 3, background: '#0a0f0d' }} />
      <Screen w={LAPTOP.w} h={LAPTOP.h} radius={6} src="desktop" {...p} />
    </div>
    <div
      style={{
        width: 1280,
        height: 16,
        borderRadius: '2px 2px 18px 18px',
        background: `linear-gradient(${C.metalHi}, ${C.metal})`,
        position: 'relative',
        boxShadow: '0 18px 30px rgba(0,0,0,.4)',
      }}
    >
      <div style={{ position: 'absolute', left: '50%', top: 0, width: 160, height: 6, marginLeft: -80, borderRadius: '0 0 10px 10px', background: '#141b18' }} />
    </div>
  </div>
);

const Phone = (p: { marks: Marks; locale: Locale }) => (
  <div
    style={{
      width: PHONE.w + PHONE.bezel * 2,
      height: PHONE.h + PHONE.bezel * 2,
      borderRadius: 50,
      background: `linear-gradient(160deg, ${C.metalHi}, ${C.metal})`,
      padding: PHONE.bezel,
      boxSizing: 'border-box',
      position: 'relative',
      boxShadow: '0 40px 80px rgba(0,0,0,.45)',
    }}
  >
    <div style={{ position: 'absolute', top: PHONE.bezel + 10, left: '50%', width: 10, height: 10, marginLeft: -5, borderRadius: 5, background: '#0a0f0d', zIndex: 2 }} />
    <Screen w={PHONE.w} h={PHONE.h} radius={40} src="mobile" {...p} />
  </div>
);

const Caption = ({ locale }: { locale: Locale }) => {
  const frame = useCurrentFrame();
  const t = TEXT[locale];
  let at = 0;
  return (
    <>
      {CHAPTERS.map((c, i) => {
        const len = frames(c.sec);
        const from = at;
        at += len;
        const local = frame - from;
        const inP = interpolate(local, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) });
        const outP = interpolate(local, [len - 8, len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        if (local < 0 || local > len) return null;
        return (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 884,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 22,
              opacity: Math.min(inP, outP),
              translate: `0px ${(1 - inP) * 18}px`,
            }}
          >
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: C.accent,
                color: '#06231a',
                fontWeight: 800,
                fontSize: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 60, fontWeight: 800, color: C.ink, letterSpacing: -1 }}>{t.captions[i]}</span>
          </div>
        );
      })}
    </>
  );
};

const Progress = () => {
  const frame = useCurrentFrame();
  let at = 0;
  return (
    <div style={{ position: 'absolute', left: 120, right: 120, bottom: 38, display: 'flex', gap: 10 }}>
      {CHAPTERS.map((c) => {
        const len = frames(c.sec);
        const p = interpolate(frame, [at, at + len], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        at += len;
        return (
          <div key={c.id} style={{ flex: len, height: 6, borderRadius: 3, background: C.line, overflow: 'hidden' }}>
            <div style={{ width: `${p * 100}%`, height: '100%', background: C.accent }} />
          </div>
        );
      })}
    </div>
  );
};

const EndCard = ({ locale }: { locale: Locale }) => {
  const frame = useCurrentFrame();
  const t = TEXT[locale];
  const a = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center', opacity: a, gap: 26 }}>
      <Logo size={120} />
      <div style={{ fontSize: 84, fontWeight: 800, color: C.ink, letterSpacing: -2 }}>{t.end}</div>
      <div style={{ fontSize: 40, fontWeight: 500, color: C.accent }}>{t.endSub}</div>
    </AbsoluteFill>
  );
};

export const HowItWorks = ({ locale, marks }: HowProps) => {
  const main = TOTAL_FRAMES - frames(END_SEC);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: locale === 'tg' ? noto : manrope }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 600px at 18% 8%, rgba(60,207,149,.16), transparent 70%), radial-gradient(700px 500px at 95% 95%, rgba(14,122,85,.25), transparent 70%)` }} />
      <Sequence durationInFrames={main} layout="none">
        <div style={{ position: 'absolute', left: 120, top: 34, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo size={44} />
          <span style={{ fontSize: 30, fontWeight: 800, color: C.ink, letterSpacing: -0.5 }}>MakeFirstStep</span>
        </div>
        <div style={{ position: 'absolute', left: 120, top: 112 }}>
          <Laptop marks={marks.desktop} locale={locale} />
        </div>
        <div style={{ position: 'absolute', left: 120 + 1280 + 48, top: 112 + 728 + 16 - (PHONE.h + PHONE.bezel * 2) }}>
          <Phone marks={marks.mobile} locale={locale} />
        </div>
        <Caption locale={locale} />
        <Progress />
      </Sequence>
      <Sequence from={main} layout="none">
        <EndCard locale={locale} />
      </Sequence>
    </AbsoluteFill>
  );
};
