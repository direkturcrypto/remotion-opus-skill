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

export type Fonts = { disp: string; ui: string; mono: string; dispWeight: number; dispTrack: number };
export type FontPairId = 'unbounded' | 'sora' | 'bricolage' | 'syne' | 'space' | 'archivo';

const L = { subsets: ['latin'] as ['latin'] };
const PAIRS: Record<FontPairId, () => Fonts> = {
  unbounded: () => ({
    disp: unbounded('normal', { weights: ['500', '700'], ...L }).fontFamily,
    ui: onest('normal', { weights: ['400', '500', '600', '700'], ...L }).fontFamily,
    mono: azeret('normal', { weights: ['400', '500', '600'], ...L }).fontFamily,
    dispWeight: 700,
    dispTrack: -0.045,
  }),
  sora: () => ({
    disp: sora('normal', { weights: ['500', '700'], ...L }).fontFamily,
    ui: inter('normal', { weights: ['400', '500', '600', '700'], ...L }).fontFamily,
    mono: jetbrains('normal', { weights: ['400', '500', '600'], ...L }).fontFamily,
    dispWeight: 700,
    dispTrack: -0.04,
  }),
  bricolage: () => ({
    disp: bricolage('normal', { weights: ['500', '800'], ...L }).fontFamily,
    ui: geist('normal', { weights: ['400', '500', '600', '700'], ...L }).fontFamily,
    mono: geistMono('normal', { weights: ['400', '500', '600'], ...L }).fontFamily,
    dispWeight: 800,
    dispTrack: -0.05,
  }),
  syne: () => ({
    disp: syne('normal', { weights: ['500', '800'], ...L }).fontFamily,
    ui: hanken('normal', { weights: ['400', '500', '600', '700'], ...L }).fontFamily,
    mono: fragment('normal', { weights: ['400'], ...L }).fontFamily,
    dispWeight: 800,
    dispTrack: -0.03,
  }),
  space: () => ({
    disp: spaceG('normal', { weights: ['500', '700'], ...L }).fontFamily,
    ui: manrope('normal', { weights: ['400', '500', '600', '700'], ...L }).fontFamily,
    mono: plexMono('normal', { weights: ['400', '500', '600'], ...L }).fontFamily,
    dispWeight: 700,
    dispTrack: -0.045,
  }),
  archivo: () => ({
    disp: archivoBlack('normal', { weights: ['400'], ...L }).fontFamily,
    ui: interTight('normal', { weights: ['400', '500', '600', '700'], ...L }).fontFamily,
    mono: dmMono('normal', { weights: ['400', '500'], ...L }).fontFamily,
    dispWeight: 400,
    dispTrack: -0.035,
  }),
};

const cache = new Map<FontPairId, Fonts>();
export const fontsFor = (id: FontPairId): Fonts => {
  if (!cache.has(id)) cache.set(id, PAIRS[id]());
  return cache.get(id)!;
};

let ready = false;
/** Holds the render until webfonts are in, so text measurement (fit.ts) sees real metrics. */
export const useFontsReady = () => {
  const [ok, setOk] = useState(ready);
  const [handle] = useState(() => (ready ? null : delayRender('webfonts')));
  useEffect(() => {
    if (ok || handle === null) return;
    document.fonts.ready.then(() => {
      ready = true;
      setOk(true);
      continueRender(handle);
    });
  }, [ok, handle]);
  return ok;
};
