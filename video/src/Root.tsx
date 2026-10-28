import { Composition } from 'remotion';
import { HowItWorks, TOTAL_FRAMES, FPS, type HowProps } from './HowItWorks';

const empty = { desktop: {}, mobile: {} } as HowProps['marks'];

export const Root = () => (
  <>
    {(['ru', 'tg'] as const).map((locale) => (
      <Composition
        key={locale}
        id={`how-${locale}`}
        component={HowItWorks}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={TOTAL_FRAMES}
        defaultProps={{ locale, marks: empty } satisfies HowProps}
      />
    ))}
  </>
);
