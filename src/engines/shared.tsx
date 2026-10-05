// Pieces every engine shares: hit effects (shake / eased zoom punch / flashes / whip / bolt), the audio bed, and the
// DOM QA probe that `ros stills` reads.
import React, { useLayoutEffect } from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from 'remotion';
import type { Look } from '../engine/looks';
import type { Timeline } from '../engine/timeline';
import type { Aspect, AspectCfg, Hit, Sfx } from '../engine/types';
import { hitEnv } from '../engine/util';
import { Bolt, Whip } from '../engine/world';
import type { Spec, Words } from '../spec/schema';

export type SpotProps = { spec: Spec; words: Words | null; hasVo: boolean; hasMusic: boolean; sfx: boolean; qa?: boolean };
export type EngineProps = SpotProps & { aspect: Aspect };

export const useHitFx = (hits: Hit[], t: number, P: boolean) => {
  const amp = P ? 9 : 11;
  const sh = hits
    .filter((h) => h.kind === 'shake')
    .reduce(
      (a, h) => {
        if (t < h.at || t > h.at + 18) return a;
        const d = Math.exp(-(t - h.at) / 4.5);
        return { x: a.x + Math.sin((t - h.at) * 2.3) * amp * d, y: a.y + Math.cos((t - h.at) * 1.9) * amp * d };
      },
      { x: 0, y: 0 },
    );
  const punch = hits.filter((h) => h.kind === 'punch').reduce((a, h) => a + 0.022 * hitEnv(t, h.at), 0);
  const flash = hits.filter((h) => h.kind === 'flash' && t >= h.at && t < h.at + 10).reduce((a, h) => a + 0.16 * (1 - (t - h.at) / 10), 0);
  const flashB = hits.filter((h) => h.kind === 'flashBrand' && t >= h.at && t < h.at + 8).reduce((a, h) => a + 0.12 * (1 - (t - h.at) / 8), 0);
  return { sh, punch, flash, flashB };
};

export const HitOverlays: React.FC<{ A: AspectCfg; P: boolean; hits: Hit[]; t: number; spec: Spec; look: Look; flash: number; flashB: number }> = ({ A, P, hits, t, spec, look, flash, flashB }) => (
  <>
    {hits.filter((h) => h.kind === 'whip').map((h, i) => <Whip key={`w${i}`} A={A} P={P} go={h.at} t={t} color={spec.brand.color ?? '#E7010A'} hot={look.hot} ink={look.world.text} />)}
    {hits.filter((h) => h.kind === 'bolt').map((h, i) => <Bolt key={`b${i}`} A={A} go={h.at} t={t} color={look.hot} />)}
    {flash > 0 && <AbsoluteFill style={{ background: look.hot, opacity: flash }} />}
    {flashB > 0 && <AbsoluteFill style={{ background: spec.brand.color ?? '#E7010A', opacity: flashB }} />}
  </>
);

export const AudioBed: React.FC<{ spec: Spec; tl: Timeline; total: number; hasVo: boolean; hasMusic: boolean; sfx: boolean; list: Sfx[] }> = ({ spec, tl, total, hasVo, hasMusic, sfx, list }) => (
  <>
    {hasMusic && <Audio src={staticFile('music.mp3')} volume={(fr) => (tl.voActive(fr) ? 0.3 : 0.5) * interpolate(fr, [0, 4, total - 40, total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />}
    {hasVo &&
      spec.vo.lines.map((l) => (
        <Sequence key={l.id} from={tl.V[l.id]}>
          <Audio src={staticFile(`vo/${l.id}.mp3`)} volume={0.9} />
        </Sequence>
      ))}
    {sfx &&
      list.map(([from, name, vol], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(from))} durationInFrames={90}>
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol * 0.5} />
        </Sequence>
      ))}
  </>
);

/** QA probe: text escaping its card, focused cards cut by the frame, captions too wide. Logged for `ros stills`. */
export const useQA = (qa: boolean | undefined, settled: boolean, t: number, A: AspectCfg, aspect: Aspect) => {
  useLayoutEffect(() => {
    if (!qa || !settled) return;
    document.querySelectorAll('[data-qa-focus="1"]').forEach((layer) => {
      const id = layer.getAttribute('data-qa-layer');
      layer.querySelectorAll('[data-card]').forEach((card) => {
        const cr = card.getBoundingClientRect();
        if (cr.left < -4 || cr.top < -4 || cr.right > A.W + 4 || cr.bottom > A.H + 4) console.warn(`[ROS-QA] frame ${t} ${aspect}: focused card ${id} is cut by the frame edge`);
        card.querySelectorAll('[data-fit]').forEach((el) => {
          const r = el.getBoundingClientRect();
          const txt = (el.textContent ?? '').slice(0, 40);
          if (r.right > cr.right + 2 || r.left < cr.left - 2) console.warn(`[ROS-QA] frame ${t} ${aspect}: text "${txt}" overflows card ${id}`);
          const h = el as HTMLElement;
          if (h.scrollWidth > h.clientWidth + 2) console.warn(`[ROS-QA] frame ${t} ${aspect}: text "${txt}" is clipped in ${id}`);
        });
      });
      // card-less engines (kinetic): fitted text must stay inside the frame
      if (!layer.querySelector('[data-card]'))
        layer.querySelectorAll('[data-fit]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.left < 8 || r.right > A.W - 8) console.warn(`[ROS-QA] frame ${t} ${aspect}: text "${(el.textContent ?? '').slice(0, 40)}" runs off the frame in ${id}`);
        });
    });
    const cap = document.querySelector('[data-qa-caption] > div');
    if (cap) {
      const r = cap.getBoundingClientRect();
      if (r.left < 16 || r.right > A.W - 16) console.warn(`[ROS-QA] frame ${t} ${aspect}: caption wider than the safe area`);
    }
  });
};
