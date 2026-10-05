// One composition, two aspects, several visual languages. The spec picks the engine; all engines share the
// timeline (VO-locked cues), captions, hits and audio.
import React from 'react';
import { fontsFor, useFontsReady } from './engine/fonts';
import { resolveLook } from './engine/looks';
import { FlyThrough } from './engines/FlyThrough';
import { Kinetic } from './engines/Kinetic';
import { Poster } from './engines/Poster';
import type { EngineProps, SpotProps } from './engines/shared';

export type { SpotProps } from './engines/shared';

const ENGINES = { flythrough: FlyThrough, poster: Poster, kinetic: Kinetic } as const;

const Gate: React.FC<EngineProps> = (p) => {
  // start the webfont loads first, then hold the frame until they are in (fit.ts measures real glyphs)
  const f = fontsFor(resolveLook(p.spec.look).fonts);
  const ready = useFontsReady(f);
  const E = ENGINES[p.spec.engine ?? 'flythrough'];
  return ready ? <E {...p} /> : null;
};

export const SpotLandscape: React.FC<SpotProps> = (p) => <Gate {...p} aspect="landscape" />;
export const SpotPortrait: React.FC<SpotProps> = (p) => <Gate {...p} aspect="portrait" />;
