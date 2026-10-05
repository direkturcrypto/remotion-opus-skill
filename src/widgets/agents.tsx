// Agent terminals that crawl, then race to "done" when the hit lands (whip / bolt), plus the brand lockup end card.
import React from 'react';
import type { z } from 'zod';
import { Easing } from 'remotion';
import { Chars, Mark, gradText } from '../engine/atoms';
import { fitSize } from '../engine/fit';
import { grad, GREEN } from '../engine/looks';
import type { Ctx, LayerDef, WidgetOut } from '../engine/types';
import { clamp01, inOut, lin, pop, prog } from '../engine/util';
import type { Agents, Lockup } from '../spec/schema';

const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

const gridFor = (P: boolean, n: number): { items: [number, number][]; head: [number, number]; spread: [number, number][] } => {
  if (P) {
    const ys = n === 4 ? [-320, -50, 220, 490] : n === 3 ? [-230, 40, 310] : [-140, 130];
    const spread: [number, number][] = n === 4 ? [[-110, -1010], [110, -740], [-110, 760], [110, 1030]] : n === 3 ? [[-110, -1010], [110, -740], [0, 900]] : [[0, -900], [0, 900]];
    return { items: ys.map((y) => [0, y]), head: [0, ys[0] - 290], spread };
  }
  const items: [number, number][] = n === 4 ? [[-370, -40], [370, -40], [-370, 270], [370, 270]] : n === 3 ? [[-370, -40], [370, -40], [0, 270]] : [[-370, 60], [370, 60]];
  const spread: [number, number][] = n === 4 ? [[-930, -400], [930, -400], [-930, 420], [930, 420]] : n === 3 ? [[-930, -400], [930, -400], [0, 520]] : [[-930, 0], [930, 0]];
  return { items, head: [0, n === 2 ? -230 : -330], spread };
};

export const agents = (w: z.infer<typeof Agents>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const L = ctx.look;
  const f = ctx.f;
  const [tw, th] = P ? [940, 240] : [700, 270];
  const go = ctx.cue(w.goAt);
  const g = gridFor(P, w.items.length);
  const headAt = w.headline.map((h) => ctx.cue(h.at));
  const headStr = w.headline.map((h) => h.text).join(' ');
  const headW = P ? 1000 : 1400;
  const headSize = fitSize(headStr, f.disp, f.dispWeight, P ? 96 : 104, headW - 40, f.dispTrack);
  const exitAt = ctx.exitAt;

  const term = (i: number) => (t: number) => {
    const { name, task } = w.items[i];
    const start = go + 2 + i * 4;
    const slow = 0.06 + 0.1 * prog(t, ctx.arrive - 30, go, lin) + i * 0.02;
    const fast = prog(t, start, start + 16, Easing.bezier(0.3, 0, 0.1, 1));
    const p = slow + (1 - slow) * fast;
    const done = t >= start + 16;
    const flash = t >= start && t < start + 14 ? 1 - (t - start) / 14 : 0;
    return (
      <div data-card="1" style={{ width: tw, height: th, borderRadius: Math.min(30, L.card.radius), background: L.card.bg, border: flash > 0 ? `1.5px solid ${L.hot}` : L.card.border, boxShadow: `${L.card.shadow}${flash > 0 ? `, 0 0 ${(40 * flash).toFixed(0)}px ${L.hot}` : ''}`, padding: P ? '26px 34px' : '28px 34px', boxSizing: 'border-box', color: L.card.fg, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: f.mono, fontWeight: 600, fontSize: 26 }}>{name}</span>
          <div style={{ flex: 1 }} />
          {w.meta && i === 0 && <span style={{ fontFamily: f.mono, fontSize: 19, color: L.card.muted }}>{w.meta}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: f.ui, fontWeight: 500, fontSize: 30, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: f.mono, color: done ? GREEN : L.hot, width: 26 }}>{done ? '✓' : SPIN[Math.floor(t / (fast > 0 ? 1 : 4)) % SPIN.length]}</span>
          <span>{task}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 14, borderRadius: 7, background: L.card.line, overflow: 'hidden' }}>
            <div style={{ width: `${(p * 100).toFixed(2)}%`, height: '100%', borderRadius: 7, background: grad(L, 90) }} />
          </div>
          <span style={{ fontFamily: f.mono, fontSize: 21, color: done ? GREEN : L.card.muted, width: 110, textAlign: 'right' }}>{done ? (ctx.spec.language === 'id' ? 'selesai' : 'done') : `${Math.round(p * 100)}%`}</span>
        </div>
      </div>
    );
  };

  const headline = (t: number) => {
    const out = exitAt !== null ? prog(t, exitAt - 4, exitAt + 14, inOut) : 0;
    return (
      <div style={{ display: 'flex', gap: P ? 26 : 34, alignItems: 'baseline', justifyContent: 'center', fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: headSize, letterSpacing: `${f.dispTrack}em`, color: L.world.text, whiteSpace: 'nowrap', opacity: 1 - out, transform: `translateY(${(-out * 40).toFixed(1)}px)`, width: headW }}>
        {w.headline.map((h, i) => (
          <span key={i}>
            <Chars text={h.text} t={t} at={headAt[i] - 4} step={2} style={h.accent ? gradText(ctx) : undefined} />
          </span>
        ))}
      </div>
    );
  };

  const layers: LayerDef[] = [
    { key: 'head', dx: g.head[0], dy: g.head[1], w: headW, h: 150, node: headline },
    ...w.items.map((_, i): LayerDef => ({ key: `t${i}`, dx: g.items[i][0], dy: g.items[i][1], w: tw, h: th, node: term(i), spread: g.spread[i], dim: 0.5 })),
  ];
  const ys = [g.head[1] - 75, ...g.items.map(([, y]) => y + th / 2)];
  return {
    layers,
    focus: [0, (Math.min(...ys) + Math.max(...ys)) / 2],
    hits: [
      ...(w.effect !== 'none' ? [{ at: go, kind: w.effect === 'bolt' ? ('bolt' as const) : ('whip' as const) }] : []),
      { at: go, kind: 'flash' },
      { at: go + 1, kind: 'shake' },
      ...(headAt.length > 1 ? [{ at: headAt[1], kind: 'punch' as const }] : []),
    ],
    sfx: [[go - 8, w.effect === 'bolt' ? 'impact' : 'whip', 0.8], ...w.items.map((_, i): [number, string, number] => [go + 18 + i * 4, 'tick', 0.3])],
  };
};

export const lockup = (w: z.infer<typeof Lockup>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const L = ctx.look;
  const f = ctx.f;
  const [cw, ch] = P ? [960, 740] : [1260, 600];
  const logoAt = ctx.cue(w.logoAt);
  const appear = w.stack ? ctx.cue(ctx.beat.at) - 2 : ctx.arrive - 10;
  const dot = w.wordmark.lastIndexOf('.');
  const head = dot > 0 ? w.wordmark.slice(0, dot) : w.wordmark;
  const tail = dot > 0 ? w.wordmark.slice(dot) : '';
  const markSize = P ? 132 : 140;
  const wmSize = fitSize(w.wordmark, f.disp, f.dispWeight, P ? 112 : 128, cw - 160 - markSize - 34, f.dispTrack);
  const brandRed = ctx.spec.brand.color ?? L.accent[1];
  // chips sit on the lockup card, so their contrast follows the card, not the world
  const lockupBgIsLight = /^#(?:[0-3])/i.test(L.lockup.fg);
  const node = (t: number) => {
    if (t < appear) return null;
    const inP = pop(t, appear + 2, 5);
    const logo = t < logoAt - 4 ? 0 : pop(t, logoAt - 4, 4);
    const chips = prog(t, logoAt + 8, logoAt + 24);
    const cta = pop(t, logoAt + 20, 5);
    return (
      <div data-card="1" style={{ width: cw, height: ch, borderRadius: L.lockup.radius, background: L.lockup.bg, border: L.lockup.border, boxShadow: L.lockup.shadow, boxSizing: 'border-box', padding: P ? '70px 56px' : '64px 72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: P ? 40 : 34, opacity: prog(t, appear, appear + 11, inOut), transform: `scale(${(0.86 + 0.14 * inP).toFixed(3)})`, color: L.lockup.fg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: P ? 28 : 34, transform: `scale(${(0.86 + 0.14 * logo).toFixed(3)})` }}>
          <Mark ctx={ctx} size={markSize} id={`mkE${P ? 'p' : 'l'}`} />
          <div style={{ fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: wmSize, letterSpacing: `${f.dispTrack}em`, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {head}
            <span style={{ color: brandRed }}>{tail}</span>
          </div>
        </div>
        {w.chips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: P ? 'column' : 'row', alignItems: 'center', gap: 18, opacity: chips, transform: `translateY(${((1 - chips) * 20).toFixed(1)}px)` }}>
            {w.chips.map((c, i) =>
              c.style === 'dark' ? (
                <div key={i} style={{ flex: 'none', whiteSpace: 'nowrap', background: L.lockup.fg, color: lockupBgIsLight ? '#FFFFFF' : '#111214', fontFamily: f.mono, fontSize: P ? 32 : 30, padding: '16px 28px', borderRadius: 999 }}>{c.text}</div>
              ) : (
                <div key={i} style={{ flex: 'none', whiteSpace: 'nowrap', background: grad(L), color: '#FFFFFF', fontFamily: f.ui, fontWeight: 700, fontSize: P ? 38 : 34, padding: '14px 30px', borderRadius: 999 }}>{c.text}</div>
              ),
            )}
          </div>
        )}
        {w.cta && (
          <div style={{ fontFamily: f.ui, fontWeight: 600, fontSize: P ? 42 : 40, display: 'flex', alignItems: 'center', gap: 12, transform: `scale(${clamp01(cta * 1.2).toFixed(3)})`, opacity: t >= logoAt + 20 ? 1 : 0, whiteSpace: 'nowrap' }}>
            {w.cta} <span style={{ color: brandRed }}>→</span>
          </div>
        )}
        {w.finePrint && <div style={{ fontFamily: f.mono, fontSize: P ? 17 : 16, lineHeight: 1.5, opacity: 0.6 * chips, textAlign: 'center', maxWidth: cw - 120 }}>{w.finePrint}</div>}
      </div>
    );
  };
  return {
    layers: [{ key: 'card', dx: 0, dy: 0, dz: w.stack ? -30 : 0, w: cw, h: ch, node }],
    hits: [{ at: logoAt, kind: 'shake' }, { at: logoAt, kind: 'punch' }],
    sfx: [[appear - 6, 'whoosh', 0.4], [logoAt - 3, 'impact', 0.45], ...(w.cta ? ([[logoAt + 18, 'chime', 0.4]] as [number, string, number][]) : [])],
  };
};
