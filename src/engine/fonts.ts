// Font pairs (display / UI / mono). Loaded lazily — only the pair a spec picks hits the network.
import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { loadFont as unbounded } from '@remotion/google-fonts/Unbounded';
import { loadFont as onest } from '@remotion/google-fonts/Onest';
import { loadFont as azeret } from '@remotion/google-fonts/AzeretMono';
import { loadFont as sora } from '@remotion/google-fonts/Sora';
import { loadFont as inter } from '@remotion/google-fonts/Inter';
import { loadFont as jetbrains } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as bricolage } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as geist } from '@remotion/google-fonts/Geist';
import { loadFont as geistMono } from '@remotion/google-fonts/GeistMono';
import { loadFont as syne } from '@remotion/google-fonts/Syne';
import { loadFont as hanken } from '@remotion/google-fonts/HankenGrotesk';
import { loadFont as fragment } from '@remotion/google-fonts/FragmentMono';
import { loadFont as spaceG } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as manrope } from '@remotion/google-fonts/Manrope';
import { loadFont as plexMono } from '@remotion/google-fonts/IBMPlexMono';
import { loadFont as archivoBlack } from '@remotion/google-fonts/ArchivoBlack';
import { loadFont as interTight } from '@remotion/google-fonts/InterTight';
import { loadFont as dmMono } from '@remotion/google-fonts/DMMono';

export type Fonts = { disp: string; ui: string; mono: string; dispWeight: number; dispTrack: number; wait: () => Promise<void> };
export type FontPairId = 'unbounded' | 'sora' | 'bricolage' | 'syne' | 'space' | 'archivo';

const L = { subsets: ['latin'] as ['latin'] };
const PAIRS: Record<FontPairId, () => Fonts> = {
  unbounded: () => {
    const disp = unbounded('normal', { weights: ['500', '700'], ...L });
    const ui = onest('normal', { weights: ['400', '500', '600', '700'], ...L });
    const mono = azeret('normal', { weights: ['400', '500', '600'], ...L });
    return {
      disp: disp.fontFamily,
      ui: ui.fontFamily,
      mono: mono.fontFamily,
      dispWeight: 700,
      dispTrack: -0.045,
      wait: () => Promise.all([disp.waitUntilDone(), ui.waitUntilDone(), mono.waitUntilDone()]).then(() => undefined),
    };
  },
  sora: () => {
    const disp = sora('normal', { weights: ['500', '700'], ...L });
    const ui = inter('normal', { weights: ['400', '500', '600', '700'], ...L });
    const mono = jetbrains('normal', { weights: ['400', '500', '600'], ...L });
    return {
      disp: disp.fontFamily,
      ui: ui.fontFamily,
      mono: mono.fontFamily,
      dispWeight: 700,
      dispTrack: -0.04,
      wait: () => Promise.all([disp.waitUntilDone(), ui.waitUntilDone(), mono.waitUntilDone()]).then(() => undefined),
    };
  },
  bricolage: () => {
    const disp = bricolage('normal', { weights: ['500', '800'], ...L });
    const ui = geist('normal', { weights: ['400', '500', '600', '700'], ...L });
    const mono = geistMono('normal', { weights: ['400', '500', '600'], ...L });
    return {
      disp: disp.fontFamily,
      ui: ui.fontFamily,
      mono: mono.fontFamily,
      dispWeight: 800,
      dispTrack: -0.05,
      wait: () => Promise.all([disp.waitUntilDone(), ui.waitUntilDone(), mono.waitUntilDone()]).then(() => undefined),
    };
  },
  syne: () => {
    const disp = syne('normal', { weights: ['500', '800'], ...L });
    const ui = hanken('normal', { weights: ['400', '500', '600', '700'], ...L });
    const mono = fragment('normal', { weights: ['400'], ...L });
    return {
      disp: disp.fontFamily,
      ui: ui.fontFamily,
      mono: mono.fontFamily,
      dispWeight: 800,
      dispTrack: -0.03,
      wait: () => Promise.all([disp.waitUntilDone(), ui.waitUntilDone(), mono.waitUntilDone()]).then(() => undefined),
    };
  },
  space: () => {
    const disp = spaceG('normal', { weights: ['500', '700'], ...L });
    const ui = manrope('normal', { weights: ['400', '500', '600', '700'], ...L });
    const mono = plexMono('normal', { weights: ['400', '500', '600'], ...L });
    return {
      disp: disp.fontFamily,
      ui: ui.fontFamily,
      mono: mono.fontFamily,
      dispWeight: 700,
      dispTrack: -0.045,
      wait: () => Promise.all([disp.waitUntilDone(), ui.waitUntilDone(), mono.waitUntilDone()]).then(() => undefined),
    };
  },
  archivo: () => {
    const disp = archivoBlack('normal', { weights: ['400'], ...L });
    const ui = interTight('normal', { weights: ['400', '500', '600', '700'], ...L });
    const mono = dmMono('normal', { weights: ['400', '500'], ...L });
    return {
      disp: disp.fontFamily,
      ui: ui.fontFamily,
      mono: mono.fontFamily,
      dispWeight: 400,
      dispTrack: -0.035,
      wait: () => Promise.all([disp.waitUntilDone(), ui.waitUntilDone(), mono.waitUntilDone()]).then(() => undefined),
    };
  },
};

const cache = new Map<FontPairId, Fonts>();
export const fontsFor = (id: FontPairId): Fonts => {
  if (!cache.has(id)) cache.set(id, PAIRS[id]());
  return cache.get(id)!;
};

const ready = new Set<Fonts>();
/** Holds the render until THIS pair's webfonts are downloaded and registered. (document.fonts.ready is not enough:
 *  Remotion adds a FontFace to document.fonts only after it loads, so ready resolves early and measurements lie.) */
export const useFontsReady = (f: Fonts) => {
  const [ok, setOk] = useState(ready.has(f));
  const [handle] = useState(() => (ready.has(f) ? null : delayRender('webfonts')));
  useEffect(() => {
    if (ok || handle === null) return;
    f.wait()
      .then(() => document.fonts.ready)
      .then(() => {
        ready.add(f);
        setOk(true);
        continueRender(handle);
      });
  }, [ok, handle, f]);
  return ok;
};
