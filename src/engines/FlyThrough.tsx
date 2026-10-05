// Engine 1 — "flythrough": UI cards as billboards in a 3D space, one continuous forward dolly with arcs around the
// cards it passes, lens depth-of-field + semantic focus on the VO.
import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { buildPlan, focusZ, semOf } from '../engine/director';
import { buildTimeline } from '../engine/timeline';
import { prog } from '../engine/util';
import { Billboard, Captions, Floor, Particles, projOf } from '../engine/world';
import { AudioBed, HitOverlays, useHitFx, useQA, type EngineProps } from './shared';

export const FlyThrough: React.FC<EngineProps> = ({ spec, words, hasVo, hasMusic, sfx, qa, aspect }) => {
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
  const { sh, punch, flash, flashB } = useHitFx(plan.hits, t, P);
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

  useQA(qa, speed <= 6, t, A, aspect); // only audit settled frames; mid-flight cuts are intended

  const bgGlowX = A.W / 2 - cam.x * 0.06;
  const worldT = `translate(${sh.x.toFixed(1)}px, ${sh.y.toFixed(1)}px) rotate(${cam.r.toFixed(3)}deg) scale(${(1 + punch).toFixed(4)})`;

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
      <HitOverlays A={A} P={P} hits={plan.hits} t={t} spec={spec} look={look} flash={flash} flashB={flashB} />
      <Captions A={A} tl={tl} look={look} ui={f.ui} t={t} />

      <AudioBed spec={spec} tl={tl} total={plan.total} hasVo={hasVo} hasMusic={hasMusic} sfx={sfx} list={plan.sfx} />
    </AbsoluteFill>
  );
};

