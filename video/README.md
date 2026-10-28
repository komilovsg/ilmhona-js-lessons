# How-it-works video

Source of `public/media/how-it-works-{ru,tg}.{mp4,webm,webp}` (the home page section «Как учиться на платформе»).
Separate project: not part of the Next app (excluded in `tsconfig.json`, eslint and `.vercelignore`).

## Regenerate after UI changes

```bash
# 1. production build of the site, served on a free port
pnpm build && pnpm start -p 3430        # repo root, keep it running

# 2. once: dependencies and the Playwright browser
cd video && pnpm install && pnpm exec playwright install chromium

# 3. re-record the real UI and render everything
pnpm render:all
```

Needs `ffmpeg` (libx264 + libvpx-vp9) and `cwebp` on PATH. Set `BASE_URL` to record another host.

- `record.mjs` — Playwright script of the student flow (home -> Vibe Coding roadmap -> lesson `product-spec`
  with diagram, video thumbnail and quiz -> Frontend lesson `functions` code task -> roadmap with XP).
  Desktop 1440x900 and mobile 390x844, for `/ru` and `/tj`. Quiz answers are read from the lesson sources.
  Writes `raw/` (ignored by git) incl. chapter marks. Each chapter lasts at least 8.5 s.
  If a lesson slug, selector or task text changes, adjust the script.
- `render.mjs` — converts recordings, renders `src/` with Remotion (1920x1080, 30 fps, no audio), then encodes
  mp4 (h264) and webm (VP9) raising the CRF until each is under 5 MB, and a poster (webp, under 150 KB).
- `src/HowItWorks.tsx` — composition: device frames, chapter lengths (`CHAPTERS`), captions (`TEXT`, ru/tg).
  `pnpm studio` previews it (after one `pnpm record`, with marks passed as input props).

Separate scripts: `pnpm record`, `pnpm render`.
