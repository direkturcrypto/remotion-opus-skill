import React from 'react';
import { Easing } from 'remotion';
import type { Cam, Plan, Vec } from './director';
import type { Look } from './looks';
import type { Timeline } from './timeline';
import type { AspectCfg } from './types';
import { lin, pop, prog, seeded } from './util';

/** a card as a billboard in 3D: perspective scale, lens depth-of-field + semantic focus blur, near-plane fade */
export const Billboard: React.FC<{ A: AspectCfg; cam: Cam; fd: number; p: Vec; w: number; h: number; sem: number; dim?: number; children: React.ReactNode; qaId: string }> = ({ A, cam, fd, p, w, h, sem, dim = 0.38, children, qaId }) => {
  const d = p.z - cam.z;
  if (d < 60) return null;
  const s = A.F / d;
  const sx = A.W / 2 + (p.x - cam.x) * s;
  const sy = A.cy0 + (p.y - cam.y) * s;
  const hw = (w * s) / 2;
  const hh = (h * s) / 2;
  if (sx + hw < -300 || sx - hw > A.W + 300 || sy + hh < -300 || sy - hh > A.H + 300) return null;
  const coc = Math.abs(1 / d - 1 / fd) * A.F * 11;
  const unf = 1 - sem;
  const blur = Math.min(18, coc + unf * 6);
  const near = prog(d, 90, 420, lin);
  const op = near * (1 - prog(d, 7000, 9500, lin)) * (1 - unf * dim);
  if (op <= 0.002) return null;
  return (
    <div
      data-qa-layer={qaId}
      data-qa-focus={sem > 0.95 && op > 0.95 && blur < 1 && s < 1.12 ? '1' : '0'}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        transform: `translate(${(sx - w / 2).toFixed(2)}px, ${(sy - h / 2).toFixed(2)}px) scale(${s.toFixed(5)})`,
        transformOrigin: '50% 50%',
        opacity: op,
        zIndex: Math.round(100000 - d),
        // always on: toggling a filter off re-rasterizes the layer and pops every edge by a sub-pixel
        filter: `blur(${(blur / s).toFixed(2)}px) saturate(${(1 - unf * 0.5).toFixed(2)})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
};

const PARTS = Array.from({ length: 220 }).map((_, i) => ({
  x: (seeded(i * 3.1 + 1) - 0.5) * 5600,
  y: (seeded(i * 5.7 + 2) - 0.5) * 3600,
  z: -2600 + seeded(i * 7.3 + 3) * 14000,
  r: 3 + seeded(i * 1.9 + 4) * 6,
  hot: seeded(i * 2.3 + 5) > 0.72,
}));

export const Particles: React.FC<{ A: AspectCfg; look: Look; cam: Cam; prev: Cam; fd: number; near: boolean; yShift: number }> = ({ A, look, cam, prev, fd, near, yShift }) => {
  const pc = look.world.particles;
  const els: React.ReactNode[] = [];
  PARTS.slice(0, pc.n).forEach((p, i) => {
    const py0 = p.y + yShift;
    const d = p.z - cam.z;
    if (d < 80 || d > 9000) return;
    if (near !== d < fd * 0.8) return;
    const s = A.F / d;
    const x = A.W / 2 + (p.x - cam.x) * s;
    const y = A.cy0 + (py0 - cam.y) * s;
    if (x < -200 || x > A.W + 200 || y < -200 || y > A.H + 200) return;
    const ps = A.F / Math.max(80, p.z - prev.z);
    const px = A.W / 2 + (p.x - prev.x) * ps;
    const py = A.cy0 + (py0 - prev.y) * ps;
    const coc = Math.abs(1 / d - 1 / fd) * A.F * 11;
    const r = Math.max(1.2, p.r * s) + coc * 0.7;
    const a = (p.hot ? pc.hotA : pc.inkA) * Math.min(1, 3 / (1 + coc * 0.35)) * prog(d, 80, 400, lin) * (1 - prog(d, 6500, 9000, lin));
    const col = p.hot ? pc.hot : pc.ink;
    if (Math.hypot(x - px, y - py) > 3) els.push(<line key={i} x1={px} y1={py} x2={x} y2={y} stroke={col} strokeOpacity={a} strokeWidth={r * 2} strokeLinecap="round" />);
    else els.push(<circle key={i} cx={x} cy={y} r={r} fill={col} fillOpacity={a} />);
  });
  return (
    <svg width={A.W} height={A.H} style={{ position: 'absolute', left: 0, top: 0, zIndex: near ? 200000 : 1, pointerEvents: 'none' }}>
      {els}
    </svg>
  );
};

export const Floor: React.FC<{ A: AspectCfg; look: Look; cam: Cam; floorY: number }> = ({ A, look, cam, floorY }) => {
  const fl = look.world.floor;
  if (!fl) return null;
  const step = 260;
  const zstep = 420;
  const zn = cam.z + 160;
  const zf = cam.z + 9000;
  const proj = (x: number, z: number) => {
    const s = A.F / (z - cam.z);
    return [A.W / 2 + (x - cam.x) * s, A.cy0 + (floorY - cam.y) * s];
  };
  const lines: React.ReactNode[] = [];
  const x0 = Math.round(cam.x / step) * step;
  for (let k = -16; k <= 16; k++) {
    const [ax, ay] = proj(x0 + k * step, zn);
    const [bx, by] = proj(x0 + k * step, zf);
    lines.push(<line key={`x${k}`} x1={ax} y1={ay} x2={bx} y2={by} />);
  }
  if (!fl.dots)
    for (let z = Math.ceil(zn / zstep) * zstep; z < zf; z += zstep) {
      const [ax, ay] = proj(cam.x - 5000, z);
      const [bx, by] = proj(cam.x + 5000, z);
      lines.push(<line key={`z${z}`} x1={ax} y1={ay} x2={bx} y2={by} />);
    }
  const horizon = A.cy0 + (floorY - cam.y) * (A.F / 9000);
  return (
    <svg width={A.W} height={A.H} style={{ position: 'absolute', left: 0, top: 0, zIndex: 0 }}>
      <defs>
        <linearGradient id="floorFade" gradientUnits="userSpaceOnUse" x1="0" y1={Math.min(horizon, A.H - 10)} x2="0" y2={A.H}>
          <stop offset="0" stopColor={fl.color} stopOpacity={0} />
          <stop offset="1" stopColor={fl.color} stopOpacity={fl.alpha} />
        </linearGradient>
      </defs>
      <g stroke="url(#floorFade)" strokeWidth={fl.dots ? 3 : 1.4} strokeDasharray={fl.dots ? '1 26' : undefined} strokeLinecap="round">
        {lines}
      </g>
    </svg>
  );
};

// ---- screen-space hits
const whipShape = (A: AspectCfg, P: boolean, go: number, tt: number) => {
  const t0 = go - 10;
  const [ax, ay, bx, by] = A.whip;
  const reveal = prog(tt, t0, go + 2, Easing.bezier(0.6, 0, 0.9, 0.6));
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy);
  const nx = -dy / L;
  const ny = dx / L;
  const amp = (P ? 120 : 160) * (1 - 0.6 * prog(tt, go, go + 16));
  const left: string[] = [];
  const right: string[] = [];
  let tip = [ax, ay];
  for (let i = 0; i <= 60; i++) {
    const u = (i / 60) * reveal;
    const wave = Math.sin(u * Math.PI * 2.1 - (tt - t0) * 0.5) * amp * Math.sin(u * Math.PI);
    const x = ax + dx * u + nx * wave;
    const y = ay + dy * u + ny * wave;
    const wd = 46 * (1 - u) ** 1.4 + 5;
    left.push(`${(x + nx * wd * 0.5).toFixed(1)},${(y + ny * wd * 0.5).toFixed(1)}`);
    right.unshift(`${(x - nx * wd * 0.5).toFixed(1)},${(y - ny * wd * 0.5).toFixed(1)}`);
    tip = [x, y];
  }
  return { pts: [...left, ...right].join(' '), tip };
};

export const Whip: React.FC<{ A: AspectCfg; P: boolean; go: number; t: number; color: string; hot: string; ink: string }> = ({ A, P, go, t, color, hot, ink }) => {
  if (t < go - 10 || t > go + 20) return null;
  const fade = 1 - prog(t, go + 6, go + 18, lin);
  const { pts, tip } = whipShape(A, P, go, t);
  const crack = t >= go ? prog(t, go, go + 14) : 0;
  return (
    <svg width={A.W} height={A.H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: fade, zIndex: 250000 }}>
      {[4, 2].map((k) => (t - k >= go - 10 ? <polygon key={k} points={whipShape(A, P, go, t - k).pts} fill={hot} opacity={k === 2 ? 0.28 : 0.14} /> : null))}
      <polygon points={pts} fill={color} />
      {crack > 0 &&
        Array.from({ length: 10 }).map((_, k) => {
          const ang = (k / 10) * Math.PI * 2 + 0.3;
          const r0 = 26 + crack * 60;
          const r1 = r0 + 60 + crack * 110;
          return <line key={k} x1={tip[0] + Math.cos(ang) * r0} y1={tip[1] + Math.sin(ang) * r0} x2={tip[0] + Math.cos(ang) * r1} y2={tip[1] + Math.sin(ang) * r1} stroke={k % 2 ? hot : ink} strokeWidth={12 * (1 - crack) + 1} strokeLinecap="round" opacity={1 - crack} />;
        })}
      {crack > 0 && <circle cx={tip[0]} cy={tip[1]} r={30 + crack * 150} fill="none" stroke={hot} strokeWidth={14 * (1 - crack)} opacity={1 - crack} />}
    </svg>
  );
};

export const Bolt: React.FC<{ A: AspectCfg; go: number; t: number; color: string }> = ({ A, go, t, color }) => {
  if (t < go - 6 || t > go + 14) return null;
  const p = prog(t, go - 6, go, lin);
  const fade = 1 - prog(t, go + 2, go + 14, lin);
  const pts: [number, number][] = [];
  const x0 = A.W * 0.62;
  for (let i = 0; i <= 9; i++) pts.push([x0 + (i % 2 ? -1 : 1) * (40 + seeded(i) * 70) - i * 18, (A.H * 0.62 * i) / 9]);
  const n = Math.max(2, Math.round(p * pts.length));
  const d = pts.slice(0, n).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg width={A.W} height={A.H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: fade, zIndex: 250000 }}>
      <path d={d} fill="none" stroke={color} strokeWidth={26} strokeLinejoin="miter" opacity={0.35} />
      <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinejoin="miter" />
    </svg>
  );
};

export const Captions: React.FC<{ A: AspectCfg; tl: Timeline; look: Look; ui: string; t: number }> = ({ A, tl, look, ui, t }) => {
  const idx = tl.captions.findIndex((c) => t >= c.start && t < c.end);
  if (idx < 0) return null;
  const cap = tl.captions[idx];
  const last = idx === tl.captions.length - 1;
  const inP = pop(t, cap.start, 3.5);
  const outP = last ? prog(t, cap.end - 10, cap.end, lin) : 0;
  const sz = A.cap.size;
  return (
    <div data-qa-caption="1" style={{ position: 'absolute', left: 0, right: 0, top: A.cap.top, display: 'flex', justifyContent: 'center', zIndex: 300000, opacity: 1 - outP }}>
      <div style={{ maxWidth: A.cap.maxW, display: 'block', textAlign: 'center', textWrap: 'balance', lineHeight: 1.25, background: look.caption.bg, borderRadius: sz * 0.6, padding: `${sz * 0.28}px ${sz * 0.7}px`, fontFamily: ui, fontWeight: 600, fontSize: sz, color: look.caption.fg, transform: `scale(${(0.92 + 0.08 * inP).toFixed(3)})`, boxShadow: '0 20px 40px -20px rgba(0,0,0,0.45)' }}>
        {cap.words.map((w, i) => {
          const on = t >= w.at - 2;
          const cur = on && (i + 1 >= cap.words.length || t < cap.words[i + 1].at - 2);
          return (
            <React.Fragment key={i}>
              {/* nowrap keeps a URL from splitting at its hyphen; the space stays outside so lines can still wrap */}
              <span style={{ opacity: on ? 1 : 0.32, color: cur ? look.caption.hot : look.caption.fg, whiteSpace: 'nowrap' }}>{w.text}</span>
              {i < cap.words.length - 1 ? ' ' : ''}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const projOf = (A: AspectCfg, cam: Cam, p: Vec) => {
  const s = A.F / (p.z - cam.z);
  return [A.W / 2 + (p.x - cam.x) * s, A.cy0 + (p.y - cam.y) * s];
};

export type { Plan };
