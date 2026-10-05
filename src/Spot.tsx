// One composition, two aspects. Everything visual is derived from (spec, words) by the director.
import React, { useLayoutEffect, useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { buildPlan, focusZ, semOf } from './engine/director';
import { fontsFor, useFontsReady } from './engine/fonts';
import { resolveLook } from './engine/looks';
import { buildTimeline } from './engine/timeline';
import type { Aspect } from './engine/types';
import { hitEnv, prog } from './engine/util';
import { Billboard, Bolt, Captions, Floor, Particles, Whip, projOf } from './engine/world';
import type { Spec, Words } from './spec/schema';

export type SpotProps = { spec: Spec; words: Words | null; hasVo: boolean; hasMusic: boolean; sfx: boolean; qa?: boolean };

const SFX_VOL: Record<string, number> = { fly: 1, whoosh: 1, pop: 1, type: 1, impact: 1, roll: 1, scan: 1, slash: 1, stamp: 1, whip: 1, tick: 1, chime: 1 };

const Inner: React.FC<SpotProps & { aspect: Aspect }> = ({ spec, words, hasVo, hasMusic, sfx, qa, aspect }) => {
  const t = useCurrentFrame();
  const tl = useMemo(() => buildTimeline(spec, words), [spec, words]);
  const plan = useMemo(() => buildPlan(spec, tl, aspect), [spec, tl, aspect]);
  const { A, ctxBase } = plan;
  const { look, f, P } = ctxBase;

  const cam = plan.camAt(t);
  const prev = plan.camAt(t - 1);
  const fd = Math.max(200, focusZ(plan, t) - cam.z);
  const speed = Math.hypot(cam.x - prev.x, cam.y - prev.y) * (A.F / fd) + (Math.abs(cam.z - prev.z) * (A.W * 0.5)) / fd;
  const mblur = Math.max(0, Math.min(3.2, (speed - 26) / 14));
  const shakeAmp = P ? 9 : 11;
  const sh = plan.hits
    .filter((h) => h.kind === 'shake')
    .reduce(
      (a, h) => {
        if (t < h.at || t > h.at + 18) return a;
        const d = Math.exp(-(t - h.at) / 4.5);
        return { x: a.x + Math.sin((t - h.at) * 2.3) * shakeAmp * d, y: a.y + Math.cos((t - h.at) * 1.9) * shakeAmp * d };
      },
      { x: 0, y: 0 },
    );
  const punch = plan.hits.filter((h) => h.kind === 'punch').reduce((a, h) => a + 0.022 * hitEnv(t, h.at), 0);
  const flash = plan.hits.filter((h) => h.kind === 'flash' && t >= h.at && t < h.at + 10).reduce((a, h) => a + 0.16 * (1 - (t - h.at) / 10), 0);
  const flashB = plan.hits.filter((h) => h.kind === 'flashBrand' && t >= h.at && t < h.at + 8).reduce((a, h) => a + 0.12 * (1 - (t - h.at) / 8), 0);
  const staircase = spec.path === 'staircase';

  // stacked lockup: covered beat's layers spread out and dim, connectors run into the lockup
  const semFor = (beatId: string) => {
    const own = semOf(plan, t, beatId);
    const over = Object.entries(plan.stackOver).find(([, under]) => under === beatId);
    return over ? Math.max(own, 0.25 * semOf(plan, t, over[0])) : own;
  };
  const posOf = (l: (typeof plan.layers)[number]) => {
    const sp = l.spreadAt !== null && l.spread ? prog(t, l.spreadAt - 4, l.spreadAt + 22) : 0;
    const tx = l.spread ? l.dx + (l.spread[0] - l.dx) * sp : l.dx;
    const ty = l.spread ? l.dy + (l.spread[1] - l.dy) * sp : l.dy;
    return { x: l.base.x + tx, y: l.base.y + ty, z: l.base.z + (l.dz ?? 0) + 40 * sp };
  };
  const lockups = Object.keys(plan.stackOver).map((id) => plan.layers.find((l) => l.beatId === id)!);
  const connectors = lockups.flatMap((lk) => {
    const under = plan.layers.filter((l) => l.beatId === plan.stackOver[lk.beatId] && l.spread);
    if (!under.length) return [];
    const at0 = under[0].spreadAt ?? 0;
    const conn = prog(t, at0 + 6, at0 + 30);
    if (conn <= 0) return [];
    const lp = posOf(lk);
    const c = projOf(A, cam, lp);
    const s = A.F / (lp.z - cam.z);
    const hw = (lk.w * s) / 2 + 6;
    const hh = (lk.h * s) / 2 + 6;
    return under.map((u) => {
      const a = projOf(A, cam, posOf(u));
      // stop at the lockup's edge — never draw across the logo
      const dx = c[0] - a[0];
      const dy = c[1] - a[1];
      const tEdge = Math.min(dx ? (Math.abs(dx) - hw) / Math.abs(dx) : 1, dy ? (Math.abs(dy) - hh) / Math.abs(dy) : 1);
      const k = Math.max(0, Math.min(tEdge, 1)) * conn;
      return { a, b: [a[0] + dx * k, a[1] + dy * k], z: posOf(u).z };
    });
  });

  // QA: report text that escapes its card, and focused cards that leave the frame (read by `ros stills`)
  useLayoutEffect(() => {
    if (!qa || speed > 6) return; // only audit settled frames; mid-flight cuts are intended
    document.querySelectorAll('[data-qa-focus="1"]').forEach((layer) => {
      const id = layer.getAttribute('data-qa-layer');
      const cards = layer.querySelectorAll('[data-card]');
      cards.forEach((card) => {
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
    });
    const cap = document.querySelector('[data-qa-caption] > div');
    if (cap) {
      const r = cap.getBoundingClientRect();
      if (r.left < 16 || r.right > A.W - 16) console.warn(`[ROS-QA] frame ${t} ${aspect}: caption wider than the safe area`);
    }
  });

  const bgGlowX = A.W / 2 - cam.x * 0.06;
  const worldT = `translate(${sh.x.toFixed(1)}px, ${sh.y.toFixed(1)}px) rotate(${cam.r.toFixed(3)}deg) scale(${(1 + punch).toFixed(4)})`;
  const voIds = spec.vo.lines.map((l) => l.id);

  return (
    <AbsoluteFill style={{ background: look.world.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse ${A.W * 0.7}px ${A.H * 0.32}px at ${bgGlowX.toFixed(1)}px ${(A.cy0 + 60).toFixed(1)}px, rgba(${look.world.glow},${look.world.glowA}), transparent 70%)` }} />
      <AbsoluteFill style={{ transform: worldT, transformOrigin: `${A.W / 2}px ${A.cy0}px`, filter: `blur(${mblur.toFixed(2)}px)` }}>
        <Floor A={A} look={look} cam={cam} floorY={staircase ? A.floorY + cam.y : A.floorY} />
        <Particles A={A} look={look} cam={cam} prev={prev} fd={fd} near={false} yShift={staircase ? cam.y * 0.85 : 0} />
        {connectors.length > 0 && (
          <svg width={A.W} height={A.H} style={{ position: 'absolute', left: 0, top: 0, zIndex: Math.round(100000 - (connectors[0].z - cam.z)) - 1, pointerEvents: 'none' }}>
            {connectors.map((c, i) => (
              <line key={i} x1={c.a[0]} y1={c.a[1]} x2={c.b[0]} y2={c.b[1]} stroke={look.hot} strokeWidth={4} strokeDasharray="14 12" strokeDashoffset={-t * 2.4} strokeOpacity={0.7} strokeLinecap="round" />
            ))}
          </svg>
        )}
        {plan.layers.map((l) => (
          <Billboard key={l.id} qaId={l.id} A={A} cam={cam} fd={fd} p={posOf(l)} w={l.w} h={l.h} sem={semFor(l.beatId)} dim={l.dim}>
            {l.node(t)}
          </Billboard>
        ))}
        <Particles A={A} look={look} cam={cam} prev={prev} fd={fd} near yShift={staircase ? cam.y * 0.85 : 0} />
      </AbsoluteFill>
      {plan.hits.filter((h) => h.kind === 'whip').map((h, i) => <Whip key={`w${i}`} A={A} P={P} go={h.at} t={t} color={spec.brand.color ?? '#E7010A'} hot={look.hot} ink={look.world.text} />)}
      {plan.hits.filter((h) => h.kind === 'bolt').map((h, i) => <Bolt key={`b${i}`} A={A} go={h.at} t={t} color={look.hot} />)}
      {flash > 0 && <AbsoluteFill style={{ background: look.hot, opacity: flash }} />}
      {flashB > 0 && <AbsoluteFill style={{ background: spec.brand.color ?? '#E7010A', opacity: flashB }} />}
      <Captions A={A} tl={tl} look={look} ui={f.ui} t={t} />

      {hasMusic && <Audio src={staticFile('music.mp3')} volume={(fr) => (tl.voActive(fr) ? 0.3 : 0.5) * interpolate(fr, [0, 4, plan.total - 40, plan.total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />}
      {hasVo &&
        voIds.map((id) => (
          <Sequence key={id} from={tl.V[id]}>
            <Audio src={staticFile(`vo/${id}.mp3`)} volume={0.9} />
          </Sequence>
        ))}
      {sfx &&
        plan.sfx.map(([from, name, vol], i) => (
          <Sequence key={i} from={Math.max(0, Math.round(from))} durationInFrames={90}>
            <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol * 0.5 * (SFX_VOL[name] ?? 1)} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

const Gate: React.FC<SpotProps & { aspect: Aspect }> = (p) => {
  // start the webfont loads first, then hold the frame until they are in (fit.ts measures real glyphs)
  fontsFor(resolveLook(p.spec.look).fonts);
  const ready = useFontsReady();
  return ready ? <Inner {...p} /> : null;
};

export const SpotLandscape: React.FC<SpotProps> = (p) => <Gate {...p} aspect="landscape" />;
export const SpotPortrait: React.FC<SpotProps> = (p) => <Gate {...p} aspect="portrait" />;
