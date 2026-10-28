// Renders the Remotion compositions from raw/ recordings into ../public/media (mp4 + webm + poster).
// Needs: ffmpeg (libx264, libvpx-vp9) and cwebp on PATH.
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, 'raw');
const REC = join(HERE, 'public', 'rec');
const WORK = join(HERE, 'out');
const MEDIA = join(HERE, '..', 'public', 'media');
const MAX_VIDEO = 5 * 1024 * 1024 - 120 * 1024; // keep a margin under 5 MB
const MAX_POSTER = 150 * 1024;
const POSTER_FRAME = 20 * 30; // inside the "theory and video" chapter
const LOCALES = (process.env.ONLY ?? 'ru,tg').split(','); // e.g. ONLY=tg to re-render one locale

const ff = (...args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const size = (f) => statSync(f).size;

mkdirSync(REC, { recursive: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(MEDIA, { recursive: true });

// 1. recordings -> constant 30 fps h264 (Remotion seeks frame-exact in these)
for (const loc of LOCALES) {
  for (const dev of ['desktop', 'mobile']) {
    const src = join(RAW, `${loc}-${dev}.webm`);
    if (!existsSync(src)) throw new Error(`missing ${src}: run "pnpm record" first`);
    ff('-i', src, '-r', '30', '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-g', '15', join(REC, `${loc}-${dev}.mp4`));
  }
}

// 2. bundle once, render a high-quality master per locale
const serveUrl = await bundle({ entryPoint: join(HERE, 'src', 'index.ts'), publicDir: join(HERE, 'public') });
for (const loc of LOCALES) {
  const marks = JSON.parse(readFileSync(join(RAW, `${loc}-marks.json`), 'utf8'));
  const inputProps = { locale: loc, marks };
  const composition = await selectComposition({ serveUrl, id: `how-${loc}`, inputProps });
  const master = join(WORK, `master-${loc}.mp4`);
  console.log('render', loc);
  await renderMedia({ composition, serveUrl, codec: 'h264', crf: 10, outputLocation: master, inputProps, muted: true, concurrency: 4 });

  // 3. final encodes: raise CRF until the file fits
  const mp4 = join(MEDIA, `how-it-works-${loc}.mp4`);
  for (let crf = 24; crf <= 38; crf += 2) {
    ff('-i', master, '-an', '-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4);
    if (size(mp4) <= MAX_VIDEO) break;
  }
  const webm = join(MEDIA, `how-it-works-${loc}.webm`);
  for (let crf = 32; crf <= 50; crf += 2) {
    ff('-i', master, '-an', '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '1', '-pix_fmt', 'yuv420p', webm);
    if (size(webm) <= MAX_VIDEO) break;
  }

  // 4. poster
  const png = join(WORK, `poster-${loc}.png`);
  await renderStill({ composition, serveUrl, frame: POSTER_FRAME, output: png, inputProps });
  const webp = join(MEDIA, `how-it-works-${loc}.webp`);
  for (let q = 82; q >= 40; q -= 6) {
    execFileSync('cwebp', ['-quiet', '-q', String(q), '-resize', '1280', '720', png, '-o', webp]);
    if (size(webp) <= MAX_POSTER) break;
  }
  console.log(loc, 'mp4', size(mp4), 'webm', size(webm), 'poster', size(webp));
  if (size(mp4) > 5 * 1024 * 1024 || size(webm) > 5 * 1024 * 1024 || size(webp) > MAX_POSTER) throw new Error('output too large');
}
rmSync(WORK, { recursive: true, force: true });
console.log('done:', MEDIA);
