// Optional effects. Every hit eases in/out over several frames — single-frame steps read as glitches.
import React from 'react';
import { Easing } from 'remotion';
import { hitEnv, lin, prog, seeded } from '../engine/util';

export type Hit = { at: number; kind: 'shake' | 'punch' | 'flash'; amp?: number };
/** camera feel for a list of hits: shake offset, zoom punch scale, flash opacity */
export const useHits = (hits: Hit[], t: number) => {
  let x = 0;
  let y = 0;
  let punch = 0;
  let flash = 0;
  for (const h of hits) {
    if (h.kind === 'shake' && t >= h.at && t <= h.at + 18) {
      const d = Math.exp(-(t - h.at) / 4.5) * (h.amp ?? 10);
      x += Math.sin((t - h.at) * 2.3) * d;
      y += Math.cos((t - h.at) * 1.9) * d;
    }
    if (h.kind === 'punch') punch += (h.amp ?? 0.022) * hitEnv(t, h.at);
    if (h.kind === 'flash' && t >= h.at && t < h.at + 10) flash += (h.amp ?? 0.16) * (1 - (t - h.at) / 10);
  }
  return { x, y, scale: 1 + punch, flash };
};

/** film grain overlay (static noise frequency reads as print, not video noise) */
export const Grain: React.FC<{ opacity?: number; W: number; H: number }> = ({ opacity = 0.1, W, H }) => (
  <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
    <filter id="kitGrain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={3} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#kitGrain)" />
  </svg>
);

/** radial burst of strokes + ring at (x, y) starting at `at` */
export const Burst: React.FC<{ t: number; at: number; x: number; y: number; color: string; n?: number; size?: number }> = ({ t, at, x, y, color, n = 12, size = 160 }) => {
  if (t < at || t > at + 20) return null;
  const p = prog(t, at, at + 18);
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} width={1} height={1}>
      {Array.from({ length: n }).map((_, k) => {
        const a = (k / n) * Math.PI * 2 + 0.3;
        const r0 = size * (0.2 + 0.4 * p);
        const r1 = r0 + size * (0.4 + 0.6 * p);
        return <line key={k} x1={x + Math.cos(a) * r0} y1={y + Math.sin(a) * r0} x2={x + Math.cos(a) * r1} y2={y + Math.sin(a) * r1} stroke={color} strokeWidth={10 * (1 - p) + 1} strokeLinecap="round" opacity={1 - p} />;
      })}
      <circle cx={x} cy={y} r={size * (0.2 + p)} fill="none" stroke={color} strokeWidth={12 * (1 - p)} opacity={1 - p} />
    </svg>
  );
};

/** a tapered lash from a→b that cracks at `at` (with motion trail) */
export const Whip: React.FC<{ t: number; at: number; a: [number, number]; b: [number, number]; color: string; W: number; H: number; width?: number }> = ({ t, at, a, b, color, W, H, width = 46 }) => {
  if (t < at - 10 || t > at + 20) return null;
  const shape = (tt: number) => {
    const reveal = prog(tt, at - 10, at + 2, Easing.bezier(0.6, 0, 0.9, 0.6));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    const nx = -dy / L;
    const ny = dx / L;
    const amp = 150 * (1 - 0.6 * prog(tt, at, at + 16));
    const left: string[] = [];
    const right: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const u = (i / 60) * reveal;
      const wave = Math.sin(u * Math.PI * 2.1 - (tt - at + 10) * 0.5) * amp * Math.sin(u * Math.PI);
      const x = a[0] + dx * u + nx * wave;
      const y = a[1] + dy * u + ny * wave;
      const wd = width * (1 - u) ** 1.4 + 5;
      left.push(`${(x + nx * wd * 0.5).toFixed(1)},${(y + ny * wd * 0.5).toFixed(1)}`);
      right.unshift(`${(x - nx * wd * 0.5).toFixed(1)},${(y - ny * wd * 0.5).toFixed(1)}`);
    }
    return [...left, ...right].join(' ');
  };
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 1 - prog(t, at + 6, at + 18, lin) }}>
      {t - 3 >= at - 10 && <polygon points={shape(t - 3)} fill={color} opacity={0.25} />}
      <polygon points={shape(t)} fill={color} />
    </svg>
  );
};

/** deterministic confetti falling from the top from `at` */
export const Confetti: React.FC<{ t: number; at: number; W: number; H: number; colors: string[]; n?: number; seed?: number }> = ({ t, at, W, H, colors, n = 80, seed = 3 }) => {
  if (t < at) return null;
  const dt = t - at;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => {
        const x0 = seeded(i * 1.7 + seed) * W;
        const vy = 6 + seeded(i * 2.9 + seed) * 10;
        const y = -40 + vy * dt + 0.08 * dt * dt * seeded(i * 4.1 + seed);
        if (y > H + 40) return null;
        const x = x0 + Math.sin(dt / (8 + seeded(i * 3.3) * 10) + i) * 40;
        const rot = dt * (6 + seeded(i * 5.1) * 12);
        return <rect key={i} x={x} y={y} width={14} height={8} fill={colors[i % colors.length]} transform={`rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`} />;
      })}
    </svg>
  );
};
