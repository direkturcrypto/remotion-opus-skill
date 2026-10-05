import React from 'react';
import { Caret, Chars, Card, Mark, gradText } from '../engine/atoms';
import { fitSize } from '../engine/fit';
import { GREEN } from '../engine/looks';
import type { Ctx, WidgetOut } from '../engine/types';
import { pop, prog, typed } from '../engine/util';
import type { Hero } from '../spec/schema';
import type { z } from 'zod';

type W = z.infer<typeof Hero>;

export const hero = (w: W, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const [cw, ch] = P ? [960, 880] : [1520, 640];
  const pad = P ? 60 : 64;
  const L = ctx.look;
  const f = ctx.f;
  const nameAt = w.name.map((n) => ctx.cue(n.at));
  const accentAt = w.accentWord ? ctx.cue(w.accentWord.at) : null;
  const last = accentAt ?? nameAt[nameAt.length - 1];
  const kickerAt = w.kickerAt ? ctx.cue(w.kickerAt) : nameAt[0] - 30;
  const badgeBump = ctx.cue(ctx.beat.at);
  const first = ctx.index === 0;
  const nameStr = w.name.map((n) => n.text).join('');
  const inner = cw - pad * 2;
  const gap = 34;
  const accW = (s: number) => (w.accentWord ? gap + s * 0.02 : 0);
  // landscape: name + accent on one line; portrait: accent wraps under the name
  const nameSize = (() => {
    const max = P ? 132 : 150;
    if (P) return fitSize(nameStr, f.disp, f.dispWeight, max, inner, f.dispTrack);
    const both = nameStr + (w.accentWord ? ' ' + w.accentWord.text : '');
    return fitSize(both, f.disp, f.dispWeight, max, inner - accW(max), f.dispTrack);
  })();
  const id = w.id ?? '';
  const idStart = nameAt[0] - 4;
  const idCps = id.length / Math.max(24, last - idStart);

  const node = (t: number) => {
    const toast = pop(t, first ? -10 : ctx.arrive - 16, 4) * (1 + 0.1 * (t >= badgeBump - 2 ? Math.exp(-(t - badgeBump + 2) / 6) : 0));
    const shine = prog(t, badgeBump + 8, badgeBump + 32);
    const proP = accentAt !== null ? pop(t, accentAt - 3, 4) : 0;
    const live = prog(t, last + 4, last + 16);
    const idTxt = typed(id, t, idStart, idCps);
    return (
      <Card ctx={ctx} w={cw} h={ch} pad={pad}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12, background: ctx.spec.brand.color ?? '#E7010A', color: '#FFFFFF', borderRadius: 999, padding: '12px 28px', fontFamily: f.ui, fontWeight: 700, fontSize: 28, letterSpacing: '0.1em', transform: `scale(${toast.toFixed(3)})`, transformOrigin: 'left center', whiteSpace: 'nowrap' }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: '#FFFFFF', opacity: 0.6 + 0.4 * Math.sin(t / 6) }} />
            {w.badge}
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: 60, left: `${(-20 + shine * 140).toFixed(1)}%`, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', transform: 'skewX(-20deg)' }} />
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: prog(t, first ? 0 : ctx.arrive - 10, (first ? 0 : ctx.arrive - 10) + 14) }}>
            <Mark ctx={ctx} size={48} id={`mkA${P ? 'p' : 'l'}`} />
            <span style={{ fontFamily: f.mono, fontSize: 26, color: L.card.muted }}>{ctx.spec.brand.url}</span>
          </div>
        </div>
        <div style={{ marginTop: P ? 64 : 62, fontFamily: f.mono, fontWeight: 500, fontSize: 30, letterSpacing: '0.32em', color: L.card.muted, height: 40, whiteSpace: 'nowrap' }}>{w.kicker ? typed(w.kicker, t, kickerAt, 0.5) : ''}</div>
        <div style={{ marginTop: P ? 18 : 10, display: 'flex', flexWrap: P ? 'wrap' : 'nowrap', alignItems: 'center', columnGap: gap, rowGap: 6, fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: nameSize, letterSpacing: `${f.dispTrack}em`, lineHeight: 1.08 }}>
          <span data-fit="1" style={{ whiteSpace: 'nowrap' }}>
            {w.name.map((n, i) => (
              <Chars key={i} text={n.text} t={t} at={nameAt[i] - 4} step={2.6} style={n.accent ? gradText(ctx) : undefined} />
            ))}
          </span>
          {w.accentWord && accentAt !== null && (
            <span style={{ display: 'inline-block', transform: `scale(${(proP * (1 + 0.04 * Math.exp(-Math.max(0, t - accentAt) / 10))).toFixed(3)}) rotate(${((1 - proP) * -10).toFixed(2)}deg)`, transformOrigin: 'left center', opacity: t >= accentAt - 3 ? 1 : 0, fontSize: P ? nameSize * 1.12 : nameSize }}>
              <span style={{ display: 'inline-block', ...gradText(ctx), paddingRight: 8 }}>{w.accentWord.text}</span>
            </span>
          )}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: P ? 'column' : 'row', alignItems: P ? 'flex-start' : 'center', gap: P ? 30 : 26 }}>
          {id && (
            <div style={{ display: 'flex', alignItems: 'center', background: L.card.inset, border: `1.5px solid ${L.card.line}`, borderRadius: 18, padding: '16px 24px', fontFamily: f.mono, fontSize: P ? 30 : 30, color: L.card.insetFg, opacity: prog(t, idStart - 6, idStart + 4), minWidth: P ? 0 : 520, whiteSpace: 'nowrap' }}>
              <span style={{ color: L.hot, marginRight: 14 }}>$</span>
              {idTxt}
              <Caret t={t} h={30} color={L.hot} />
            </div>
          )}
          {w.status && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: f.ui, fontWeight: 500, fontSize: 30, color: L.card.fg, opacity: live * 0.88, transform: `translateX(${((1 - live) * 30).toFixed(1)}px)`, whiteSpace: 'nowrap' }}>
              <span style={{ width: 16, height: 16, borderRadius: 8, background: GREEN, boxShadow: `0 0 0 ${(6 + 4 * Math.sin(t / 7)).toFixed(1)}px rgba(34,197,94,0.18)` }} />
              {w.status}
            </div>
          )}
        </div>
      </Card>
    );
  };

  return {
    layers: [{ key: 'card', dx: 0, dy: 0, w: cw, h: ch, node }],
    anchor: P ? [-cw / 2 + pad + 150, -ch / 2 + pad + 28] : [-cw / 2 + pad + 150, -ch / 2 + pad + 28],
    hits: [...(accentAt !== null ? [{ at: accentAt, kind: 'shake' as const }, { at: accentAt, kind: 'punch' as const }] : []), { at: nameAt[0], kind: 'punch' as const }],
    sfx: [
      [first ? Math.max(0, badgeBump - 4) : ctx.arrive - 14, 'pop', 0.6],
      [nameAt[0] - 4, 'type', 0.35],
      ...(accentAt !== null ? ([[accentAt - 3, 'impact', 0.5]] as [number, string, number][]) : []),
    ],
  };
};
