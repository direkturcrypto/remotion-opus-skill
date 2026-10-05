import { Easing } from 'remotion';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const outE = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const flyE = Easing.bezier(0.8, 0, 0.2, 1);
export const lin = (x: number) => x;

/** eased 0→1 progress of t between frames a and b */
export const prog = (t: number, a: number, b: number, e: (x: number) => number = outE) => e(clamp01((t - a) / (b - a || 1)));

/** springy 0→1 overshoot that starts at t0 (0 before) */
export const pop = (t: number, t0: number, k = 4) => (t < t0 ? 0 : 1 - Math.exp(-(t - t0) / k) * Math.cos((t - t0) * 0.45));

/** hit envelope: eases in over `rise` frames before `at`, decays after. Never a single-frame step (reads as a glitch). */
export const hitEnv = (t: number, at: number, decay = 8, rise = 6) => (t < at ? prog(t, at - rise, at, inOut) : Math.exp(-(t - at) / decay));

export const seeded = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

export type KP = [number, number, ((x: number) => number)?];
/** keyframe interpolation; the easing on a key applies to the segment that ENDS at that key */
export const kf = (t: number, pts: KP[]) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [f1, v1, e] = pts[i];
    const [f0, v0] = pts[i - 1];
    if (t <= f1) return v0 + (v1 - v0) * (e ?? inOut)(clamp01((t - f0) / (f1 - f0 || 1)));
  }
  return pts[pts.length - 1][1];
};

export const typed = (s: string, t: number, at: number, cps = 1.4) => s.slice(0, Math.max(0, Math.min(s.length, Math.floor((t - at) * cps))));
