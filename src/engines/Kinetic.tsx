// Engine 3 — "kinetic": full-bleed type on colour fields, no cards. Every scene carries a coloured "portal" disc;
// the next scene lives inside it at 1/5 scale. The camera zooms through the portal (log-space zoom about a moving
// fixed point) so the disc becomes the next background — one continuous camera, never a slide change.
import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { ASPECTS } from '../engine/director';
import { fontsFor } from '../engine/fonts';
import { resolveLook, type Look } from '../engine/looks';
import { buildTimeline, type Timeline } from '../engine/timeline';
import type { Aspect, Ctx, Hit, Sfx } from '../engine/types';
import { clamp01, flyE, prog } from '../engine/util';
import { Captions } from '../engine/world';
import { kineticWidget, type Box, type KPal } from '../kinetic/renderers';
import type { Spec } from '../spec/schema';
import { AudioBed, HitOverlays, useHitFx, useQA, type EngineProps } from './shared';

const Q = 0.2;
const FRAME: Record<Aspect, { fw: number; fh: number; box: Box; portal: { x: number; y: number; r: number } }> = {
  landscape: { fw: 1920, fh: 1080, box: { x: 140, y: 150, w: 1060, h: 800 }, portal: { x: 1545, y: 560, r: 240 } },
  portrait: { fw: 1080, fh: 1920, box: { x: 90, y: 210, w: 900, h: 980 }, portal: { x: 560, y: 1420, r: 236 } },
};

const palettes = (look: Look): Record<'base' | 'accent' | 'ink', KPal> => ({
  base: { bg: look.world.bg, fg: look.world.text, muted: look.dark ? 'rgba(255,255,255,0.62)' : 'rgba(17,18,20,0.55)', hot: look.hot, line: look.dark ? 'rgba(255,255,255,0.14)' : 'rgba(17,18,20,0.12)', inset: look.card.inset },
  accent: { bg: `linear-gradient(135deg, ${look.accent[0]} 0%, ${look.accent[1]} 100%)`, fg: '#FFFFFF', muted: 'rgba(255,255,255,0.78)', hot: '#111214', line: 'rgba(255,255,255,0.28)', inset: 'rgba(0,0,0,0.18)' },
  ink: look.dark
    ? { bg: '#F4F1EA', fg: '#111214', muted: 'rgba(17,18,20,0.58)', hot: look.accent[1], line: 'rgba(17,18,20,0.14)', inset: '#E8E4DA' }
    : { bg: '#0F1014', fg: '#FFFFFF', muted: 'rgba(255,255,255,0.62)', hot: look.hot, line: 'rgba(255,255,255,0.16)', inset: '#1A1B20' },
});

type V2 = [number, number];
const rot = ([x, y]: V2, deg: number): V2 => {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

const buildKinetic = (spec: Spec, tl: Timeline, aspect: Aspect) => {
  const A = ASPECTS[aspect];
  const P = aspect === 'portrait';
  const fr = FRAME[aspect];
  const look = resolveLook(spec.look);
  const f = fontsFor(look.fonts);
  const pals = palettes(look);
  const order: ('base' | 'accent' | 'ink')[] = ['base', 'accent', 'ink'];
  const kinds: ('base' | 'accent' | 'ink')[] = [];
  spec.beats.forEach((b, i) => {
    let kd = order[i % 3];
    if (b.widget.type === 'lockup') kd = kinds[i - 1] === 'base' ? 'ink' : 'base';
    kinds.push(kd);
  });
  const arrive = spec.beats.map((b) => tl.cue(b.at) + 2);
  const hits: Hit[] = [];
  const sfx: Sfx[] = [];
  const theta = spec.path === 'turns' ? 90 : 0;
  const pv: V2 = [fr.portal.x - fr.fw / 2, fr.portal.y - fr.fh / 2];
  const O: V2[] = [];
  const S: number[] = [];
  const R: number[] = [];
  const scenes = spec.beats.map((b, i) => {
    if (i === 0) {
      O.push([0, 0]);
      S.push(1);
      R.push(0);
    } else {
      const d = rot([pv[0] * S[i - 1], pv[1] * S[i - 1]], R[i - 1]);
      O.push([O[i - 1][0] + d[0], O[i - 1][1] + d[1]]);
      S.push(S[i - 1] * Q);
      R.push(R[i - 1] + theta * (i % 2 ? 1 : -1));
    }
    const ctx: Ctx = { P, A, look, f, tl, cue: tl.cue, spec, beat: b, index: i, arrive: arrive[i], exitAt: null, groupSize: 1 };
    const out = kineticWidget(b.widget, { ...ctx, pal: pals[kinds[i]], box: fr.box, fw: fr.fw, fh: fr.fh });
    hits.push(...(out.hits ?? []));
    (b.punches ?? []).forEach((c) => hits.push({ at: tl.cue(c), kind: 'punch' }));
    sfx.push(...(out.sfx ?? []));
    return { id: b.id, node: out.node, pal: pals[kinds[i]], last: i === spec.beats.length - 1 };
  });

  // camera: settle on scene i at arrive[i] (scale 1), drift in, then zoom through the portal into i+1
  type K = { t0: number; t1: number; i: number };
  const flights: K[] = [];
  for (let i = 1; i < spec.beats.length; i++) {
    const t1 = arrive[i];
    const t0 = Math.max(arrive[i - 1] + 12, t1 - 28);
    flights.push({ t0, t1, i });
    sfx.push([t0 - 2, 'fly', 0.55]);
  }
  const camAt = (t: number) => {
    const fl = flights.find((k) => t >= k.t0 && t < k.t1);
    if (fl) {
      const u = flyE(clamp01((t - fl.t0) / (fl.t1 - fl.t0)));
      const a = fl.i - 1;
      const Z0 = (1 / S[a]) * 1.05;
      const Z1 = 1 / S[fl.i];
      const Z = Math.exp(Math.log(Z0) + (Math.log(Z1) - Math.log(Z0)) * u);
      const Pp = O[fl.i];
      const k = (Z0 / Z) * (1 - u);
      return { c: [Pp[0] + (O[a][0] - Pp[0]) * k, Pp[1] + (O[a][1] - Pp[1]) * k] as V2, z: Z, r: R[a] + (R[fl.i] - R[a]) * u, settled: -1 };
    }
    let i = 0;
    for (let k = 0; k < spec.beats.length; k++) if (t >= (k === 0 ? -1e9 : arrive[k])) i = k;
    const next = flights.find((k) => k.i === i + 1);
    const holdEnd = next ? next.t0 : tl.total;
    const start = i === 0 ? 0 : arrive[i];
    const drift = i === 0 ? 0.9 + 0.15 * prog(t, 0, holdEnd) : 1 + 0.05 * prog(t, start, holdEnd);
    return { c: O[i], z: (1 / S[i]) * drift, r: R[i], settled: i };
  };
  return { A, P, fr, look, f, hits, sfx, scenes, O, S, R, arrive, camAt, total: tl.total, kinds, pals };
};

export const Kinetic: React.FC<EngineProps> = ({ spec, words, hasVo, hasMusic, sfx, qa, aspect }) => {
  const t = useCurrentFrame();
  const tl = useMemo(() => buildTimeline(spec, words), [spec, words]);
  const k = useMemo(() => buildKinetic(spec, tl, aspect), [spec, tl, aspect]);
  const { A, P, fr, look, f } = k;
  const cam = k.camAt(t);
  const prev = k.camAt(t - 1);
  const zoomSpeed = Math.abs(Math.log(cam.z / prev.z));
  const { sh, punch, flash, flashB } = useHitFx(k.hits, t, P);
  useQA(qa, zoomSpeed < 0.004, t, A, aspect);
  const Z = cam.z * (1 + punch);
  const screen = (p: V2): V2 => {
    const d = rot([(p[0] - cam.c[0]) * Z, (p[1] - cam.c[1]) * Z], -cam.r);
    return [A.W / 2 + d[0] + sh.x, A.H / 2 + d[1] + sh.y];
  };
  // field under everything = the scene the camera last settled into (its parent's portal covers the frame anyway)
  let base = 0;
  for (let i = 0; i < k.scenes.length; i++) if (t >= (i === 0 ? -1e9 : k.arrive[i])) base = i;
  const mblur = Math.min(3, zoomSpeed * 40);

  return (
    <AbsoluteFill style={{ background: k.scenes[base].pal.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ filter: `blur(${mblur.toFixed(2)}px)` }}>
        {k.scenes.map((sc, i) => {
          const sc2 = Z * k.S[i];
          const items: React.ReactNode[] = [];
          // the portal disc this scene lives in (drawn in the parent, filled with this scene's colour)
          if (i > 0) {
            const rr = fr.portal.r * k.S[i - 1] * Z;
            if (rr > 1 && rr < 6000) {
              const [x, y] = screen(k.O[i]);
              items.push(<div key="disc" style={{ position: 'absolute', left: x - rr, top: y - rr, width: rr * 2, height: rr * 2, borderRadius: '50%', background: sc.pal.bg, boxShadow: rr < 900 ? `0 0 0 ${Math.max(2, rr * 0.03).toFixed(1)}px ${k.scenes[i - 1].pal.fg}22` : undefined }} />);
            }
          }
          if (sc2 > 0.03 && sc2 < 9) {
            const [x, y] = screen(k.O[i]);
            const fade = 1 - prog(sc2, 3, 7, (v) => v);
            const settled = cam.settled === i;
            items.push(
              <div key="scene" data-qa-layer={sc.id} data-qa-focus={settled ? '1' : '0'} style={{ position: 'absolute', left: x - fr.fw / 2, top: y - fr.fh / 2, width: fr.fw, height: fr.fh, transform: `rotate(${(k.R[i] - cam.r).toFixed(3)}deg) scale(${sc2.toFixed(5)})`, transformOrigin: '50% 50%', opacity: fade }}>
                {sc.node(t)}
              </div>,
            );
          }
          return <React.Fragment key={sc.id}>{items}</React.Fragment>;
        })}
      </AbsoluteFill>
      <HitOverlays A={A} P={P} hits={k.hits} t={t} spec={spec} look={look} flash={flash} flashB={flashB} />
      <Captions A={A} tl={tl} look={look} ui={f.ui} t={t} />
      <AudioBed spec={spec} tl={tl} total={k.total} hasVo={hasVo} hasMusic={hasMusic} sfx={sfx} list={k.sfx} />
    </AbsoluteFill>
  );
};
