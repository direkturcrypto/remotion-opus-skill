// Engine 2 — "poster": a flat editorial canvas. Every beat is a numbered panel (thick ink border, hard offset shadow),
// a route line is drawn panel to panel as the story travels, the camera whip-pans in 2D with directional motion blur,
// and before the end card it pulls out to show the whole poster at once. Same widgets, completely different space.
import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { ASPECTS } from '../engine/director';
import { fontsFor } from '../engine/fonts';
import { resolveLook, type Look } from '../engine/looks';
import { buildTimeline, type Timeline } from '../engine/timeline';
import type { Aspect, Ctx, Hit, LayerDef, Sfx } from '../engine/types';
import { clamp01, flyE, inOut, kf, type KP } from '../engine/util';
import { Captions } from '../engine/world';
import type { Spec } from '../spec/schema';
import { buildWidget } from '../widgets';
import { revealEnd } from '../engine/reveals';
import { AudioBed, HitOverlays, useHitFx, useQA, type EngineProps } from './shared';

type Cam2 = { x: number; y: number; s: number; r: number };
type Panel = { id: string; beatId: string; index: number; x: number; y: number; x0: number; y0: number; w: number; h: number; layers: LayerDef[]; label: string };

const LABEL: Record<string, string> = { hero: 'BARU', stat: 'ANGKA', vision: 'VISION', code: 'KODE', price: 'HARGA', agents: 'AGEN', lockup: 'COBA', headline: 'PESAN', chat: 'DEMO', bars: 'BANDING', checklist: 'ALASAN' };
const LABEL_EN: Record<string, string> = { hero: 'NEW', stat: 'NUMBER', vision: 'VISION', code: 'CODE', price: 'PRICE', agents: 'AGENTS', lockup: 'TRY IT', headline: 'MESSAGE', chat: 'DEMO', bars: 'COMPARE', checklist: 'REASONS' };

export const posterize = (base: Look): Look => {
  const ink = base.world.text;
  return {
    ...base,
    card: { ...base.card, border: `4px solid ${ink}`, shadow: `14px 14px 0 ${base.hot}`, radius: 10, glowA: 0 },
    lockup: { ...base.lockup, border: `5px solid ${ink}`, shadow: `18px 18px 0 ${ink}`, radius: 10 },
  };
};

const buildPoster = (spec: Spec, tl: Timeline, aspect: Aspect) => {
  const A = ASPECTS[aspect];
  const P = aspect === 'portrait';
  const look = posterize(resolveLook(spec.look));
  const f = fontsFor(look.fonts);
  const ctxBase = { P, A, look, f, tl, cue: tl.cue, spec };
  const hits: Hit[] = [];
  const sfx: Sfx[] = [];
  const arrive = spec.beats.map((b) => tl.cue(b.at) + 2);

  // ---- widgets → panels; a group becomes one panel row/column
  type Built = { i: number; layers: LayerDef[]; anchor?: [number, number]; w: number; h: number; cx: number; cy: number; x0: number; y0: number };
  const built: Built[] = spec.beats.map((b, i) => {
    const ctx: Ctx = { ...ctxBase, beat: b, index: i, arrive: arrive[i], exitAt: null, groupSize: 1 };
    const w = b.widget.type === 'lockup' ? { ...b.widget, stack: false } : b.widget;
    const out = buildWidget(w, ctx);
    hits.push(...(out.hits ?? []));
    (b.punches ?? []).forEach((c) => hits.push({ at: tl.cue(c), kind: 'punch' }));
    sfx.push(...(out.sfx ?? []));
    const xs = out.layers.flatMap((l) => [l.dx - l.w / 2, l.dx + l.w / 2]);
    const ys = out.layers.flatMap((l) => [l.dy - l.h / 2, l.dy + l.h / 2]);
    return { i, layers: out.layers, anchor: out.anchor, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, x0: Math.min(...xs), y0: Math.min(...ys) };
  });
  const stations: number[][] = [];
  spec.beats.forEach((b, i) => {
    const prev = spec.beats[i - 1];
    if (prev && b.group && prev.group === b.group) stations[stations.length - 1].push(i);
    else stations.push([i]);
  });
  const gap = 70;
  const stSize = stations.map((m) => (P ? [Math.max(...m.map((i) => built[i].w)), m.reduce((a, i) => a + built[i].h, 0) + gap * (m.length - 1)] : [m.reduce((a, i) => a + built[i].w, 0) + gap * (m.length - 1), Math.max(...m.map((i) => built[i].h))]));
  const cellW = Math.max(...stSize.map((s) => s[0])) + (P ? 200 : 300);
  const cellH = Math.max(...stSize.map((s) => s[1])) + (P ? 260 : 320);
  const zig = spec.path !== 'strip';
  const stXY = stations.map((_, s): [number, number] => {
    if (P) return [zig ? (s % 2 ? 150 : -150) : 0, s * cellH];
    if (!zig) return [s * cellW, s % 2 ? 70 : -70];
    const row = Math.floor(s / 2);
    const col = row % 2 === 0 ? s % 2 : 1 - (s % 2);
    return [col * cellW, row * cellH];
  });
  const panels: Panel[] = [];
  const center: [number, number][] = new Array(spec.beats.length);
  const fitS: number[] = new Array(spec.beats.length);
  stations.forEach((m, s) => {
    const [sx, sy] = stXY[s];
    const [tw, th] = stSize[s];
    let off = P ? -th / 2 : -tw / 2;
    m.forEach((i) => {
      const bb = built[i];
      const x = P ? sx : sx + off + bb.w / 2;
      const y = P ? sy + off + bb.h / 2 : sy;
      off += (P ? bb.h : bb.w) + gap;
      const b = spec.beats[i];
      const lbl = (spec.language === 'id' ? LABEL : LABEL_EN)[b.widget.type] ?? b.widget.type.toUpperCase();
      panels.push({ id: b.id, beatId: b.id, index: i, x: x - bb.cx, y: y - bb.cy, x0: bb.x0, y0: bb.y0, w: bb.w, h: bb.h, layers: bb.layers, label: lbl });
      center[i] = [x, y];
      const single = m.length === 1;
      const fill = single ? (P ? Math.min((A.W * 0.88) / bb.w, (A.H * 0.66) / bb.h) : Math.min((A.W * 0.8) / bb.w, (A.H * 0.8) / bb.h)) : P ? Math.min((A.W * 0.88) / bb.w, 1.05) : Math.min((A.W * 0.36) / bb.w, 1.05);
      // camera.zoom may push in, but never so far that the panel (plus its number tab) leaves the frame
      const maxFit = Math.min((A.W * 0.94) / bb.w, (A.H * (P ? 0.78 : 0.86)) / (bb.h + 70));
      fitS[i] = Math.min(fill / (b.camera?.zoom ?? 1), maxFit);
    });
  });

  // ---- camera (2D): whip-pan between panels, dip out on station changes, poster overview before the end card
  const keys: [number, Cam2, ((x: number) => number)?][] = [];
  const b0 = spec.beats[0];
  const anc = built[0].anchor;
  const closeup = !!anc && (b0.camera?.open ? b0.camera.open === 'closeup' : b0.widget.type === 'hero');
  if (closeup && anc) {
    const [ax, ay] = [center[0][0] + anc[0], center[0][1] + anc[1]];
    const reveal = b0.camera?.revealAt ? tl.cue(b0.camera.revealAt) : b0.widget.type === 'hero' && b0.widget.kickerAt ? tl.cue(b0.widget.kickerAt) : arrive[0] + 60;
    keys.push([0, { x: ax, y: ay + (P ? 120 : 40), s: 2.4, r: -4 }]);
    keys.push([Math.max(24, reveal - 40), { x: ax + 30, y: ay + (P ? 110 : 36), s: 2.0, r: -2 }]);
    keys.push([reveal + 6, { x: center[0][0], y: center[0][1], s: fitS[0] * 0.92, r: -1 }]);
  } else {
    keys.push([0, { x: center[0][0], y: center[0][1] + 60, s: fitS[0] * 0.7, r: -3 }]);
    keys.push([arrive[0] + 36, { x: center[0][0], y: center[0][1], s: fitS[0], r: -1 }]);
  }
  const stationOf = (i: number) => stations.findIndex((m) => m.includes(i));
  const allX = panels.flatMap((p) => [p.x + p.x0, p.x + p.x0 + p.w]);
  const allY = panels.flatMap((p) => [p.y + p.y0 - 70, p.y + p.y0 + p.h]);
  const ov = { x: (Math.min(...allX) + Math.max(...allX)) / 2, y: (Math.min(...allY) + Math.max(...allY)) / 2, s: Math.min((A.W * 0.92) / (Math.max(...allX) - Math.min(...allX) + 200), (A.H * 0.86) / (Math.max(...allY) - Math.min(...allY) + 200)) };
  for (let i = 1; i < spec.beats.length; i++) {
    const same = stationOf(i) === stationOf(i - 1);
    const last = i === spec.beats.length - 1;
    const lastKey = Math.max(...keys.map((k) => k[0]));
    const prevC: Cam2 = { x: center[i - 1][0], y: center[i - 1][1], s: fitS[i - 1] * 1.03, r: (i % 2 ? 1 : -1) * 0.6 };
    const r = (i % 2 ? -1 : 1) * (same ? 0.8 : 1.6);
    // only if the previous beat has been read by then — the overview must never eat a price hold
    const prevReady = revealEnd(spec.beats[i - 1], tl.cue).frame + 50; // ≈1 s to read it before pulling out
    if (last && stations.length >= 4 && arrive[i] - lastKey > 80 && arrive[i] - 76 >= prevReady) {
      // the poster moment: pull out, let the whole layout read, then slam into the end card
      keys.push([arrive[i] - 76, prevC]);
      keys.push([arrive[i] - 50, { ...ov, r: 0 }, inOut]);
      keys.push([arrive[i] - 22, { ...ov, s: ov.s * 1.04, r: 0 }]);
      keys.push([arrive[i], { x: center[i][0], y: center[i][1], s: fitS[i], r: 0 }, flyE]);
      sfx.push([arrive[i] - 78, 'fly', 0.5], [arrive[i] - 24, 'whoosh', 0.4]);
      continue;
    }
    const fly = same ? 16 : 24;
    const S = Math.max(lastKey + 6, arrive[i] - fly);
    keys.push([S, prevC]);
    if (!same) keys.push([(S + Math.max(arrive[i], S + 10)) / 2, { x: (center[i - 1][0] + center[i][0]) / 2, y: (center[i - 1][1] + center[i][1]) / 2, s: Math.min(fitS[i - 1], fitS[i]) * 0.72, r: r * 0.5 }, inOut]);
    keys.push([Math.max(arrive[i], S + 10), { x: center[i][0], y: center[i][1], s: fitS[i], r }, flyE]);
    sfx.push([S - 2, same ? 'whoosh' : 'fly', same ? 0.3 : 0.55]);
    (spec.beats[i].camera?.moves ?? []).forEach((m) => {
      const s2 = fitS[i] / Math.max(P ? 0.96 : 0.8, m.zoom ?? 0.94);
      const bw = built[i].w;
      const maxDx = Math.max(0, (A.W / 2 - 24) / s2 - bw / 2);
      keys.push([tl.cue(m.at) + 14, { x: center[i][0] + Math.max(-maxDx, Math.min(maxDx, (m.dx ?? 0) * (P ? 0.3 : 1))), y: center[i][1] + (m.dy ?? 0) * (P ? 0.3 : 1) * 0.5, s: s2, r: r * 0.5 }]);
    });
  }
  const li = spec.beats.length - 1;
  keys.push([tl.total, { x: center[li][0], y: center[li][1], s: fitS[li] * 1.05, r: 0 }]);
  keys.sort((a, b) => a[0] - b[0]);
  for (let k = 1; k < keys.length; k++) if (keys[k][0] <= keys[k - 1][0]) keys[k][0] = keys[k - 1][0] + 1;
  const camAt = (t: number): Cam2 => {
    const pick = (fn: (c: Cam2) => number) => kf(t, keys.map(([fr, c, e]) => [fr, fn(c), e] as KP));
    return { x: pick((c) => c.x), y: pick((c) => c.y), s: Math.exp(pick((c) => Math.log(c.s))), r: pick((c) => c.r) };
  };
  const focus: [number, string][] = spec.beats.map((b, i) => [i === 0 ? -100 : arrive[i] - 8, b.id]);
  const route = stations.map((m) => {
    const xs = m.map((i) => center[i][0]);
    const ys = m.map((i) => center[i][1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] as [number, number];
  });
  const routeAt = stations.map((m) => arrive[m[0]]);
  return { A, P, look, f, hits, sfx, panels, camAt, focus, route, routeAt, total: tl.total };
};

const semOf = (focus: [number, string][], t: number, key: string) => {
  let w = 0;
  focus.forEach(([fr, k], i) => {
    if (k !== key) return;
    const end = i + 1 < focus.length ? focus[i + 1][0] : 1e9;
    w += inOut(clamp01((t - (fr - 6)) / 12)) * (1 - inOut(clamp01((t - (end - 6)) / 12)));
  });
  return clamp01(w);
};

export const Poster: React.FC<EngineProps> = ({ spec, words, hasVo, hasMusic, sfx, qa, aspect }) => {
  const t = useCurrentFrame();
  const tl = useMemo(() => buildTimeline(spec, words), [spec, words]);
  const pl = useMemo(() => buildPoster(spec, tl, aspect), [spec, tl, aspect]);
  const { A, P, look, f } = pl;
  const cam = pl.camAt(t);
  const prev = pl.camAt(t - 1);
  const vx = (cam.x - prev.x) * cam.s;
  const vy = (cam.y - prev.y) * cam.s;
  const speed = Math.hypot(vx, vy) + Math.abs(Math.log(cam.s / prev.s)) * 900;
  const bx = Math.min(4, Math.abs(vx) / 9);
  const by = Math.min(4, Math.abs(vy) / 9);
  const { sh, punch, flash, flashB } = useHitFx(pl.hits, t, P);
  useQA(qa, speed < 4 && cam.s < 1.6, t, A, aspect);

  const s = cam.s * (1 + punch);
  const world = `translate(${(A.W / 2 + sh.x).toFixed(1)}px, ${(A.cy0 + sh.y).toFixed(1)}px) rotate(${cam.r.toFixed(3)}deg) scale(${s.toFixed(5)}) translate(${(-cam.x).toFixed(1)}px, ${(-cam.y).toFixed(1)}px)`;
  const dot = look.dark ? 'rgba(255,255,255,0.14)' : 'rgba(11,11,11,0.16)';
  // route drawn up to where the story is
  const seg = pl.route.length - 1;
  let prog = 0;
  for (let k = 0; k < seg; k++) prog += clamp01((t - (pl.routeAt[k + 1] - 26)) / 26);
  const pts = pl.route;
  const partial: [number, number][] = [pts[0]];
  for (let k = 0; k < seg; k++) {
    const p = clamp01(prog - k);
    if (p <= 0) break;
    partial.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * p, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * p]);
  }
  const ghost = [spec.brand.name.toUpperCase(), (spec.beats.find((b) => b.widget.type === 'hero')?.widget as { kicker?: string } | undefined)?.kicker ?? spec.title.split(' ')[0].toUpperCase(), spec.brand.url.toUpperCase()];
  const minX = Math.min(...pl.panels.map((p) => p.x + p.x0)) - 2400;
  const minY = Math.min(...pl.panels.map((p) => p.y + p.y0)) - 2400;
  const maxX = Math.max(...pl.panels.map((p) => p.x + p.x0 + p.w)) + 2400;
  const maxY = Math.max(...pl.panels.map((p) => p.y + p.y0 + p.h)) + 2400;

  return (
    <AbsoluteFill style={{ background: look.world.bg, overflow: 'hidden' }}>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="mb2">
          <feGaussianBlur stdDeviation={`${bx.toFixed(2)} ${by.toFixed(2)}`} />
        </filter>
      </svg>
      <AbsoluteFill style={{ filter: bx + by > 0.3 ? 'url(#mb2)' : 'none' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transform: world, transformOrigin: '0 0' }}>
          <div style={{ position: 'absolute', left: minX, top: minY, width: maxX - minX, height: maxY - minY, backgroundImage: `radial-gradient(${dot} 2.4px, transparent 2.8px)`, backgroundSize: '46px 46px' }} />
          {ghost.map((g, i) => (
            <div key={i} style={{ position: 'absolute', left: minX + (i % 2 ? -t : t) * 1.2, top: minY + 2000 + (i * (maxY - minY - 4000)) / 2.4, fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: 340, letterSpacing: `${f.dispTrack}em`, color: look.world.text, opacity: 0.045, whiteSpace: 'nowrap', lineHeight: 1 }}>
              {`${g}   ${g}   ${g}   ${g}   ${g}`}
            </div>
          ))}
          <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex: 1 }} width={1} height={1}>
            <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={look.world.text} strokeOpacity={0.12} strokeWidth={6} strokeDasharray="2 22" strokeLinecap="round" />
            {partial.length > 1 && <polyline points={partial.map((p) => p.join(',')).join(' ')} fill="none" stroke={look.hot} strokeWidth={16} strokeLinejoin="round" strokeLinecap="round" />}
            {partial.slice(1).map((p, k) => (
              <circle key={k} cx={p[0]} cy={p[1]} r={k < Math.floor(prog) ? 22 : 12} fill={look.hot} />
            ))}
          </svg>
          {pl.panels.map((p) => {
            const sem = semOf(pl.focus, t, p.beatId);
            const qaFocus = sem > 0.95 && speed < 4 ? '1' : '0';
            return (
              <div key={p.id} data-qa-layer={p.id} data-qa-focus={qaFocus} style={{ position: 'absolute', zIndex: 2, left: p.x, top: p.y, opacity: 0.45 + 0.55 * sem, filter: `grayscale(${((1 - sem) * 0.7).toFixed(2)})` }}>
                <div style={{ position: 'absolute', left: p.x0, top: p.y0 - 66, display: 'flex', alignItems: 'center', gap: 14, fontFamily: f.mono, fontWeight: 600, fontSize: 28, letterSpacing: '0.18em', color: look.world.text, whiteSpace: 'nowrap' }}>
                  <span style={{ background: look.world.text, color: look.dark ? '#0B0B0B' : '#FFFFFF', padding: '6px 14px' }}>{String(p.index + 1).padStart(2, '0')}</span>
                  {p.label}
                </div>
                {p.layers.map((l) => (
                  <div key={l.key} style={{ position: 'absolute', left: l.dx - l.w / 2, top: l.dy - l.h / 2, width: l.w, height: l.h }}>
                    {l.node(t)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <HitOverlays A={A} P={P} hits={pl.hits} t={t} spec={spec} look={look} flash={flash} flashB={flashB} />
      <Captions A={A} tl={tl} look={look} ui={f.ui} t={t} />
      <AudioBed spec={spec} tl={tl} total={pl.total} hasVo={hasVo} hasMusic={hasMusic} sfx={sfx} list={pl.sfx} />
    </AbsoluteFill>
  );
};
