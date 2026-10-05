// The director turns a spec into a shot plan: where every widget lives in 3D, where the camera is on every frame,
// what is in focus, which hits/SFX fire. All of the "taste" lives here so the spec author can't break it.
import type { Spec } from '../spec/schema';
import { buildWidget } from '../widgets';
import { fontsFor } from './fonts';
import { resolveLook } from './looks';
import type { Timeline } from './timeline';
import type { Aspect, AspectCfg, Ctx, Hit, LayerDef, Sfx } from './types';
import { clamp01, flyE, inOut, kf, type KP } from './util';

export const ASPECTS: Record<Aspect, AspectCfg> = {
  landscape: { aspect: 'landscape', W: 1920, H: 1080, F: 1200, cy0: 520, floorY: 820, cap: { top: 968, size: 40, maxW: 1500 }, whip: [140, 990, 1700, 220] },
  portrait: { aspect: 'portrait', W: 1080, H: 1920, F: 1200, cy0: 900, floorY: 1300, cap: { top: 1640, size: 46, maxW: 960 }, whip: [60, 1520, 1020, 300] },
};

export type Vec = { x: number; y: number; z: number };
export type Cam = Vec & { r: number };
type CamKey = [number, Cam, ((x: number) => number)?];

export type Placed = LayerDef & { id: string; beatId: string; base: Vec; spreadAt: number | null };
export type Plan = {
  A: AspectCfg;
  layers: Placed[];
  camAt: (t: number) => Cam;
  focus: [number, string][];
  zOf: Record<string, number>;
  stackOver: Record<string, string>; // lockup beat id -> beat it covers
  hits: Hit[];
  sfx: Sfx[];
  ctxBase: Omit<Ctx, 'beat' | 'index' | 'arrive' | 'exitAt' | 'groupSize'>;
  total: number;
  notes: string[];
};

const DZ = 1700;

const stationXY = (path: Spec['path'], s: number, P: boolean): [number, number] => {
  if (path === 'serpentine') return P ? [s === 0 ? 0 : s % 2 ? 300 : -300, 0] : [s === 0 ? 0 : s % 2 ? 560 : -560, 0];
  if (path === 'staircase') return [0, -s * (P ? 720 : 560)];
  return [0, 0];
};

export const buildPlan = (spec: Spec, tl: Timeline, aspect: Aspect): Plan => {
  const A = ASPECTS[aspect];
  const P = aspect === 'portrait';
  const look = resolveLook(spec.look);
  const f = fontsFor(look.fonts);
  const notes: string[] = [];
  const ctxBase = { P, A, look, f, tl, cue: tl.cue, spec };

  // ---- stations
  type St = { s: number; x: number; y: number; z: number };
  const stOf: St[] = [];
  let s = -1;
  spec.beats.forEach((b, i) => {
    const prev = spec.beats[i - 1];
    const sameGroup = prev && b.group && prev.group === b.group;
    const stacked = prev && b.widget.type === 'lockup' && b.widget.stack;
    if (!sameGroup && !stacked) s++;
    const [x, y] = stationXY(spec.path, s, P);
    stOf.push({ s, x, y, z: s * DZ });
  });
  const groupMembers = (i: number) => spec.beats.map((b, k) => ({ b, k })).filter(({ b, k }) => stOf[k].s === stOf[i].s && !(b.widget.type === 'lockup' && b.widget.stack && k > 0));

  // ---- widgets
  const arrive = spec.beats.map((b) => tl.cue(b.at) + 2);
  const layers: Placed[] = [];
  const hits: Hit[] = [];
  const sfx: Sfx[] = [];
  const target: Vec[] = [];
  const zoom: number[] = [];
  const anchors: ([number, number] | undefined)[] = [];
  const stackOver: Record<string, string> = {};
  spec.beats.forEach((b, i) => {
    const next = spec.beats[i + 1];
    const nextStacked = next && next.widget.type === 'lockup' && next.widget.stack;
    const members = groupMembers(i);
    const ctx: Ctx = { ...ctxBase, beat: b, index: i, arrive: arrive[i], exitAt: nextStacked ? tl.cue(next.at) : null, groupSize: members.length };
    const out = buildWidget(b.widget, ctx);
    const st = stOf[i];
    let gx = 0;
    let gy = 0;
    if (members.length > 1) {
      const k = members.findIndex((m) => m.k === i);
      const lw = out.layers[0].w;
      const lh = out.layers[0].h;
      if (P) gy = (k - (members.length - 1) / 2) * (lh + 80);
      else gx = (k - (members.length - 1) / 2) * (lw + 60);
    }
    const base: Vec = { x: st.x + gx, y: st.y + gy, z: st.z };
    const stacked = b.widget.type === 'lockup' && b.widget.stack && i > 0;
    if (stacked) stackOver[b.id] = spec.beats[i - 1].id;
    out.layers.forEach((l) => layers.push({ ...l, id: `${b.id}:${l.key}`, beatId: b.id, base, spreadAt: nextStacked && l.spread ? tl.cue(next.at) : null }));
    hits.push(...(out.hits ?? []));
    (b.punches ?? []).forEach((c) => hits.push({ at: tl.cue(c), kind: 'punch' }));
    sfx.push(...(out.sfx ?? []));
    const fo = out.focus ?? [0, 0];
    target.push({ x: base.x + fo[0], y: base.y + fo[1], z: base.z });
    anchors.push(out.anchor);
    // framing: how far the camera sits (zoom = distance / F)
    const xs = out.layers.flatMap((l) => [l.dx - l.w / 2, l.dx + l.w / 2]);
    const ys = out.layers.flatMap((l) => [l.dy - l.h / 2, l.dy + l.h / 2]);
    const bw = Math.max(...xs) - Math.min(...xs);
    const bh = Math.max(...ys) - Math.min(...ys);
    let z = members.length > 1 ? (P ? 1.0 : 0.98) : P ? Math.max(bw / (A.W * 0.9), bh / (A.H * 0.7)) : Math.max(bw / (A.W * 0.82), bh / (A.H * 0.84));
    if (stacked) z = zoom[i - 1] * 1.14;
    z *= b.camera?.zoom ?? 1;
    // a zoom from the spec may push in, but never crop the card
    z = Math.max(z, members.length > 1 ? 0 : Math.max(bw / (A.W * 0.94), bh / (A.H * (P ? 0.8 : 0.9))));
    zoom.push(z);
  });

  // ---- camera keys
  const at = (v: Vec, zm: number, dx = 0, dy = 0, r = 0): Cam => ({ x: v.x + dx, y: v.y + dy, z: v.z - A.F * zm, r });
  const keys: CamKey[] = [];
  const b0 = spec.beats[0];
  const anchor = anchors[0];
  // a hero always opens on its badge close-up: frame 0 is the thumbnail and must never be an empty card
  const openClose = (b0.camera?.open ?? (b0.widget.type === 'hero' ? 'closeup' : undefined)) === 'closeup';
  if (openClose && anchor) {
    const av: Vec = { x: target[0].x + anchor[0], y: target[0].y + anchor[1] + (P ? 120 : 0), z: target[0].z };
    const heroW = b0.widget.type === 'hero' ? b0.widget : null;
    const reveal = b0.camera?.revealAt ? tl.cue(b0.camera.revealAt) : heroW?.kickerAt ? tl.cue(heroW.kickerAt) : heroW ? Math.max(40, tl.cue(heroW.name[0].at) - 24) : arrive[0] + 70;
    keys.push([0, at(av, 0.4, 0, 0, -3)]);
    keys.push([Math.max(24, reveal - 46), at(av, 0.5, 25, 6, -1.2)]);
    keys.push([reveal + 2, at(target[0], zoom[0] * 1.14, -20, 0, -0.4)]);
    keys.push([reveal + 60, at(target[0], zoom[0] * 1.02, 0, 0, 0.4)]);
  } else {
    keys.push([0, at(target[0], zoom[0] * 1.6, 0, 40, -3)]);
    keys.push([arrive[0] + 40, at(target[0], zoom[0] * 1.05, 0, 0, 0)]);
  }
  type Flight = { from: number; to: number; i: number; forward: boolean };
  const flights: Flight[] = [];
  const pushMoves = (i: number) => {
    // moves are authored for landscape; portrait cards fill the width, so lateral pushes are damped
    const k2 = P ? 0.3 : 1;
    const lay = layers.filter((l) => l.beatId === spec.beats[i].id);
    const bw = Math.max(...lay.map((l) => Math.abs(l.dx) + l.w / 2)) * 2;
    const bh = Math.max(...lay.map((l) => Math.abs(l.dy) + l.h / 2)) * 2;
    (spec.beats[i].camera?.moves ?? []).forEach((m, k) => {
      const zm = zoom[i] * Math.max(P ? 0.96 : 0.8, m.zoom ?? 0.94);
      // keep the card inside the frame (24 px margin): half the visible world width minus half the card
      const maxDx = Math.max(0, (A.W / 2 - 24) * zm - bw / 2);
      const maxDy = Math.max(0, (A.H / 2 - 24) * zm - bh / 2);
      const dx = Math.max(-maxDx, Math.min(maxDx, (m.dx ?? 0) * k2));
      const dy = Math.max(-maxDy, Math.min(maxDy, (m.dy ?? 0) * k2));
      keys.push([tl.cue(m.at) + 14, at(target[i], zm, dx, dy, k % 2 ? -0.5 : 0.5)]);
    });
  };
  pushMoves(0);
  for (let i = 1; i < spec.beats.length; i++) {
    const b = spec.beats[i];
    const stacked = b.widget.type === 'lockup' && b.widget.stack;
    const same = stOf[i].s === stOf[i - 1].s;
    const fly = stacked ? 24 : same ? 18 : 28;
    const lastKey = Math.max(...keys.map((k) => k[0]));
    let S = arrive[i] - fly;
    if (S < lastKey + 6) {
      S = lastKey + 6;
      if (arrive[i] < S + 10) notes.push(`beat ${b.id}: previous beat is too short for a clean camera move`);
    }
    const prevCam = keys.filter((k) => k[0] <= S).sort((a, c) => a[0] - c[0]).pop()![1];
    const drift = i % 2 ? 20 : -20;
    if (!stacked) keys.push([S, { ...prevCam, x: prevCam.x + drift * 0.5, z: prevCam.z - A.F * 0.04, r: prevCam.r * 0.6 }]);
    const r = stacked ? 0 : (i % 2 ? -1 : 1) * (same ? 0.8 : 1.2);
    keys.push([Math.max(arrive[i], S + 10), at(target[i], stacked ? zoom[i] : zoom[i] * 1.03, 0, 0, r), stacked ? inOut : flyE]);
    if (!same && !stacked) flights.push({ from: S, to: Math.max(arrive[i], S + 10), i, forward: true });
    pushMoves(i);
  }
  const lastI = spec.beats.length - 1;
  keys.push([tl.total, at(target[lastI], zoom[lastI] * 0.94, 0, 0, 0)]);
  keys.sort((a, c) => a[0] - c[0]);
  for (let k = 1; k < keys.length; k++) if (keys[k][0] <= keys[k - 1][0]) keys[k][0] = keys[k - 1][0] + 1;

  const rawCam = (t: number): Cam => {
    const pick = (fn: (k: Cam) => number) => kf(t, keys.map(([fr, k, e]) => [fr, fn(k), e] as KP));
    return { x: pick((k) => k.x), y: pick((k) => k.y), z: pick((k) => k.z), r: pick((k) => k.r) };
  };

  // ---- arcs: a forward fly-by must pass beside the cards it leaves behind, never punch through them
  const arcs: [number, number, number, number][] = [];
  let dir = -1;
  flights.forEach((fl) => {
    const leaving = layers.filter((l) => stOf[spec.beats.findIndex((b) => b.id === l.beatId)].s === stOf[fl.i - 1].s);
    if (!leaving.length) return;
    const zPlane = Math.max(...leaving.map((l) => l.base.z + (l.dz ?? 0))) - 200;
    let tc = fl.to;
    let uc = 0.6;
    for (let tt = fl.from; tt <= fl.to; tt += 0.5) {
      if (rawCam(tt).z >= zPlane) {
        tc = tt;
        uc = (tt - fl.from) / (fl.to - fl.from);
        break;
      }
    }
    const c = rawCam(tc);
    const rects = leaving.map((l) => ({ x0: l.base.x + l.dx - l.w / 2, x1: l.base.x + l.dx + l.w / 2, y0: l.base.y + l.dy - l.h / 2, y1: l.base.y + l.dy + l.h / 2 }));
    const m = 240;
    const hitR = rects.some((r) => c.x > r.x0 - m && c.x < r.x1 + m && c.y > r.y0 - m && c.y < r.y1 + m);
    if (!hitR) return;
    const bu = Math.max(0.35, Math.sin(Math.PI * uc) ** 2);
    if (P) {
      const need = dir < 0 ? Math.min(...rects.map((r) => r.x0)) - m - c.x : Math.max(...rects.map((r) => r.x1)) + m - c.x;
      arcs.push([fl.from, fl.to, Math.max(-1400, Math.min(1400, need / bu)), 0]);
    } else {
      const need = dir < 0 ? Math.min(...rects.map((r) => r.y0)) - m - c.y : Math.max(...rects.map((r) => r.y1)) + m - c.y;
      arcs.push([fl.from, fl.to, 0, Math.max(-1200, Math.min(1200, need / bu))]);
    }
    dir = -dir;
  });

  const camAt = (t: number): Cam => {
    const c = rawCam(t);
    for (const [f0, f1, dx, dy] of arcs) {
      const b = Math.sin(Math.PI * clamp01((t - f0) / (f1 - f0))) ** 2;
      c.x += dx * b;
      c.y += dy * b;
    }
    return c;
  };

  // ---- focus + flight SFX
  const focus: [number, string][] = spec.beats.map((b, i) => [i === 0 ? -100 : arrive[i] - 10, b.id]);
  const zOf: Record<string, number> = {};
  spec.beats.forEach((b, i) => (zOf[b.id] = stOf[i].z));
  for (let i = 1; i < spec.beats.length; i++) {
    const b = spec.beats[i];
    if (b.widget.type === 'lockup' && b.widget.stack) continue;
    const same = stOf[i].s === stOf[i - 1].s;
    const fl = keys.find((k) => k[0] >= arrive[i] - 30 && k[0] <= arrive[i]);
    const S = fl ? arrive[i] - (same ? 18 : 28) : arrive[i] - 20;
    sfx.push([S - 2, same ? 'whoosh' : 'fly', same ? 0.3 : 0.6]);
  }
  return { A, layers, camAt, focus, zOf, stackOver, hits, sfx, ctxBase, total: tl.total, notes };
};

export const semOf = (plan: Plan, t: number, key: string) => {
  let w = 0;
  plan.focus.forEach(([fr, k], i) => {
    if (k !== key) return;
    const end = i + 1 < plan.focus.length ? plan.focus[i + 1][0] : 1e9;
    w += inOut(clamp01((t - (fr - 6)) / 12)) * (1 - inOut(clamp01((t - (end - 6)) / 12)));
  });
  return clamp01(w);
};

export const focusZ = (plan: Plan, t: number) => {
  const pts: KP[] = [[-100, plan.zOf[plan.focus[0][1]]]];
  plan.focus.slice(1).forEach(([fr, k], i) => {
    pts.push([fr - 8, plan.zOf[plan.focus[i][1]]]);
    pts.push([fr + 6, plan.zOf[k]]);
  });
  return kf(t, pts);
};
