import type React from 'react';
import type { Beat, Spec } from '../spec/schema';
import type { Fonts } from './fonts';
import type { Look } from './looks';
import type { Timeline } from './timeline';

export type Aspect = 'landscape' | 'portrait';

export type AspectCfg = {
  aspect: Aspect;
  W: number;
  H: number;
  F: number; // focal length: a card at distance F renders at its native pixel size
  cy0: number; // screen y of the optical centre (portrait sits lower: content low, captions under it)
  floorY: number;
  cap: { top: number; size: number; maxW: number };
  whip: [number, number, number, number];
};

export type Ctx = {
  P: boolean;
  A: AspectCfg;
  look: Look;
  f: Fonts;
  tl: Timeline;
  cue: (c: string) => number;
  spec: Spec;
  beat: Beat;
  index: number;
  arrive: number; // frame the camera settles on this beat
  exitAt: number | null; // a stacked successor (lockup) takes over here
  groupSize: number;
};

export type Hit = { at: number; kind: 'shake' | 'punch' | 'flash' | 'flashBrand' | 'whip' | 'bolt' };
export type Sfx = [number, string, number];

export type LayerDef = {
  key: string;
  dx: number; // offset from the beat's world position
  dy: number;
  dz?: number;
  w: number;
  h: number;
  node: (t: number) => React.ReactNode;
  /** where this layer drifts when a stacked lockup takes over (agents spread out) */
  spread?: [number, number];
  dim?: number;
};

export type WidgetOut = {
  layers: LayerDef[];
  hits?: Hit[];
  sfx?: Sfx[];
  /** close-up anchor for camera.open = 'closeup' (relative to beat position) */
  anchor?: [number, number];
  /** world-space focus offset for the camera (centre of the layers' bbox) */
  focus?: [number, number];
};
