// Optional 2.5D tools: a camera you keyframe, billboards projected with perspective + lens depth-of-field,
// particles with speed streaks, a perspective floor. Use them, extend them, or ignore them.
import React from 'react';
import { clamp01, inOut, kf, lin, prog, seeded, type KP } from '../engine/util';

export type Vec3 = { x: number; y: number; z: number };
export type Cam3 = Vec3 & { r: number };
export type CamKey = [number, Cam3, ((x: number) => number)?];

/** interpolate camera keys (easing on a key applies to the segment ending at it) */
export const camAt = (keys: CamKey[], t: number): Cam3 => {
  const pick = (fn: (c: Cam3) => number) => kf(t, keys.map(([f, c, e]) => [f, fn(c), e] as KP));
  return { x: pick((c) => c.x), y: pick((c) => c.y), z: pick((c) => c.z), r: pick((c) => c.r) };
};

/** screen position + scale of a world point. F = focal length (a card at distance F renders at native size) */
export const project3D = (p: Vec3, cam: Cam3, W: number, cy: number, F = 1200) => {
  const d = p.z - cam.z;
  const s = F / Math.max(1, d);
  return { x: W / 2 + (p.x - cam.x) * s, y: cy + (p.y - cam.y) * s, s, d };
};

/** a DOM element placed in 3D. `focusZ` = the depth in focus (lens blur grows away from it); `unfocus` 0..1 = semantic dim/blur */
export const Billboard3D: React.FC<{ cam: Cam3; p: Vec3; w: number; h: number; W: number; H: number; cy?: number; F?: number; focusZ?: number; unfocus?: number; children: React.ReactNode }> = ({ cam, p, w, h, W, H, cy = H / 2, F = 1200, focusZ, unfocus = 0, children }) => {
  const { x, y, s, d } = project3D(p, cam, W, cy, F);
  if (d < 60) return null;
  if (x + (w * s) / 2 < -300 || x - (w * s) / 2 > W + 300 || y + (h * s) / 2 < -300 || y - (h * s) / 2 > H + 300) return null;
  const fd = focusZ !== undefined ? Math.max(200, focusZ - cam.z) : d;
  const blur = Math.min(18, Math.abs(1 / d - 1 / fd) * F * 11 + unfocus * 6);
  const op = prog(d, 90, 420, lin) * (1 - unfocus * 0.4);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transform: `translate(${(x - w / 2).toFixed(2)}px, ${(y - h / 2).toFixed(2)}px) scale(${s.toFixed(5)})`, transformOrigin: '50% 50%', opacity: op, zIndex: Math.round(100000 - d), filter: `blur(${(blur / s).toFixed(2)}px) saturate(${(1 - unfocus * 0.5).toFixed(2)})` }}>
      {children}
    </div>
  );
};

/** drifting particles in 3D with motion streaks when the camera moves */
export const Particles3D: React.FC<{ cam: Cam3; prev: Cam3; W: number; H: number; cy?: number; F?: number; n?: number; color?: string; hot?: string; seed?: number; spread?: number }> = ({ cam, prev, W, H, cy = H / 2, F = 1200, n = 140, color = '#111', hot = '#FF4A1C', seed = 1, spread = 1 }) => {
  const els: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const p = { x: (seeded(i * 3.1 + seed) - 0.5) * 5600 * spread, y: (seeded(i * 5.7 + seed * 2) - 0.5) * 3600 * spread, z: -2600 + seeded(i * 7.3 + seed * 3) * 14000 };
    const r = 3 + seeded(i * 1.9 + seed) * 6;
    const isHot = seeded(i * 2.3 + seed) > 0.72;
    const a = project3D(p, cam, W, cy, F);
    if (a.d < 80 || a.d > 9000 || a.x < -200 || a.x > W + 200 || a.y < -200 || a.y > H + 200) continue;
    const b = project3D(p, prev, W, cy, F);
    const alpha = (isHot ? 0.55 : 0.2) * prog(a.d, 80, 400, lin) * (1 - prog(a.d, 6500, 9000, lin));
    const rr = Math.max(1.2, r * a.s);
    const col = isHot ? hot : color;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 3) els.push(<line key={i} x1={b.x} y1={b.y} x2={a.x} y2={a.y} stroke={col} strokeOpacity={alpha} strokeWidth={rr * 2} strokeLinecap="round" />);
    else els.push(<circle key={i} cx={a.x} cy={a.y} r={rr} fill={col} fillOpacity={alpha} />);
  }
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      {els}
    </svg>
  );
};

/** perspective grid floor at world height y (fades into the horizon) */
export const Floor3D: React.FC<{ cam: Cam3; W: number; H: number; cy?: number; F?: number; y?: number; color?: string; alpha?: number; step?: number }> = ({ cam, W, H, cy = H / 2, F = 1200, y = 820, color = '#111', alpha = 0.14, step = 260 }) => {
  const zn = cam.z + 160;
  const zf = cam.z + 9000;
  const pr = (x: number, z: number) => project3D({ x, y, z }, cam, W, cy, F);
  const lines: React.ReactNode[] = [];
  const x0 = Math.round(cam.x / step) * step;
  for (let k = -16; k <= 16; k++) {
    const a = pr(x0 + k * step, zn);
    const b = pr(x0 + k * step, zf);
    lines.push(<line key={`x${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
  }
  for (let z = Math.ceil(zn / 420) * 420; z < zf; z += 420) {
    const a = pr(cam.x - 5000, z);
    const b = pr(cam.x + 5000, z);
    lines.push(<line key={`z${z}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
  }
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <linearGradient id="kitFloor" gradientUnits="userSpaceOnUse" x1="0" y1={cy} x2="0" y2={H}>
          <stop offset="0" stopColor={color} stopOpacity={0} />
          <stop offset="1" stopColor={color} stopOpacity={alpha} />
        </linearGradient>
      </defs>
      <g stroke="url(#kitFloor)" strokeWidth={1.4}>
        {lines}
      </g>
    </svg>
  );
};

/** smooth 0..1 weight of "this element is what the VO is talking about" between frames a and b */
export const focusWeight = (t: number, a: number, b: number, ramp = 8) => clamp01(inOut(clamp01((t - (a - ramp)) / (2 * ramp))) * (1 - inOut(clamp01((t - (b - ramp)) / (2 * ramp)))));
