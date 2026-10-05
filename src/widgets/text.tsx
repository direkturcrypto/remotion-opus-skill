// Kinetic headline (no card, type sits in the world), chat thread, benchmark bars, checklist.
import React from 'react';
import type { z } from 'zod';
import { Card, Chars, Head, gradText } from '../engine/atoms';
import { fitSize } from '../engine/fit';
import { grad, GREEN } from '../engine/looks';
import type { Ctx, WidgetOut } from '../engine/types';
import { pop, prog, typed } from '../engine/util';
import type { Bars, Chat, Checklist, Headline } from '../spec/schema';

export const headline = (w: z.infer<typeof Headline>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const f = ctx.f;
  const maxW = P ? 960 : 1600;
  const sizes = w.lines.map((ln) => fitSize(ln.map((x) => x.text).join(' '), f.disp, f.dispWeight, P ? 120 : 150, maxW, f.dispTrack));
  const size = Math.min(...sizes);
  const h = w.lines.length * size * 1.12 + (w.sub ? 90 : 0) + 20;
  const ats = w.lines.map((ln) => ln.map((x) => ctx.cue(x.at)));
  const subAt = ats[ats.length - 1][ats[ats.length - 1].length - 1] + 10;
  const node = (t: number) => (
    <div style={{ width: maxW, display: 'flex', flexDirection: 'column', alignItems: 'center', color: ctx.look.world.text }}>
      {w.lines.map((ln, li) => (
        <div key={li} data-fit="1" style={{ display: 'flex', gap: size * 0.28, fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: size, letterSpacing: `${f.dispTrack}em`, lineHeight: 1.12, whiteSpace: 'nowrap' }}>
          {ln.map((x, i) => (
            <span key={i}>
              <Chars text={x.text} t={t} at={ats[li][i] - 4} step={2} style={x.accent ? gradText(ctx) : undefined} />
            </span>
          ))}
        </div>
      ))}
      {w.sub && <div style={{ marginTop: 26, fontFamily: f.ui, fontWeight: 500, fontSize: P ? 38 : 40, opacity: 0.75 * prog(t, subAt, subAt + 14), textAlign: 'center' }}>{w.sub}</div>}
    </div>
  );
  return { layers: [{ key: 'text', dx: 0, dy: 0, w: maxW, h, node }], hits: ats.map((a) => ({ at: a[0], kind: 'punch' as const })) };
};

export const chat = (w: z.infer<typeof Chat>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const [cw, ch] = P ? [940, 900] : [1000, 660];
  const pad = P ? 48 : 44;
  const f = ctx.f;
  const ats = w.messages.map((m) => ctx.cue(m.at));
  const fs = P ? 32 : 28;
  const node = (t: number) => (
    <Card ctx={ctx} w={cw} h={ch} pad={pad}>
      <Head ctx={ctx} icon="chat" label={w.title.toUpperCase()} size={P ? 24 : 20} />
      <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'flex-end', height: ch - pad * 2 - 80 }}>
        {w.messages.map((m, i) => {
          const a = ats[i];
          const isAi = m.from === 'ai';
          const show = isAi ? a : a - 6;
          if (t < show - 18) return null;
          const p = pop(t, show, 4);
          const typing = isAi && t < a;
          const txt = isAi ? typed(m.text, t, a, 1.8) : m.text;
          return (
            <div key={i} style={{ alignSelf: isAi ? 'flex-start' : 'flex-end', maxWidth: '82%', padding: '18px 24px', borderRadius: 24, borderBottomLeftRadius: isAi ? 6 : 24, borderBottomRightRadius: isAi ? 24 : 6, background: isAi ? ctx.look.card.inset : grad(ctx.look), color: isAi ? ctx.look.card.insetFg : '#FFFFFF', fontFamily: f.ui, fontWeight: 500, fontSize: fs, lineHeight: 1.35, transform: `scale(${Math.min(1, 0.85 + 0.15 * p).toFixed(3)})`, transformOrigin: isAi ? 'left bottom' : 'right bottom', opacity: Math.min(1, p * 1.4 + (typing ? 1 : 0)) }}>
              {typing ? <span style={{ letterSpacing: 6, opacity: 0.7 }}>{'•••'.slice(0, 1 + (Math.floor(t / 6) % 3))}</span> : txt}
            </div>
          );
        })}
      </div>
    </Card>
  );
  return { layers: [{ key: 'card', dx: 0, dy: 0, w: cw, h: ch, node }], sfx: ats.map((a, i): [number, string, number] => [a - (w.messages[i].from === 'ai' ? 0 : 6), 'pop', 0.45]) };
};

export const bars = (w: z.infer<typeof Bars>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const [cw, ch] = P ? [940, 900] : [1200, 700];
  const pad = P ? 50 : 52;
  const f = ctx.f;
  const from = ctx.cue(w.from);
  const max = Math.max(...w.items.map((i) => i.value)) || 1;
  const labelW = P ? 250 : 290;
  const node = (t: number) => (
    <Card ctx={ctx} w={cw} h={ch} pad={pad}>
      <Head ctx={ctx} icon="bars" label={w.title.toUpperCase()} right={w.unit ? <span style={{ fontFamily: f.mono, fontSize: 20, color: ctx.look.card.muted }}>{w.unit}</span> : undefined} size={P ? 24 : 20} />
      <div style={{ marginTop: P ? 50 : 40, display: 'flex', flexDirection: 'column', gap: P ? 34 : 26 }}>
        {w.items.map((it, i) => {
          const p = prog(t, from + i * 6, from + i * 6 + 28);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: labelW, fontFamily: f.ui, fontWeight: it.highlight ? 700 : 500, fontSize: P ? 30 : 28, color: it.highlight ? ctx.look.card.fg : ctx.look.card.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
              <div style={{ flex: 1, height: P ? 46 : 42, borderRadius: 12, background: ctx.look.card.inset, overflow: 'hidden' }}>
                <div style={{ width: `${((it.value / max) * 100 * p).toFixed(2)}%`, height: '100%', borderRadius: 12, background: it.highlight ? grad(ctx.look, 90) : ctx.look.card.muted, opacity: it.highlight ? 1 : 0.55 }} />
              </div>
              <div style={{ width: P ? 150 : 160, textAlign: 'right', fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: P ? 38 : 36, color: it.highlight ? ctx.look.hot : ctx.look.card.fg, opacity: prog(t, from + i * 6 + 14, from + i * 6 + 26), whiteSpace: 'nowrap' }}>{it.display}</div>
            </div>
          );
        })}
      </div>
      {w.finePrint && <div style={{ position: 'absolute', left: 0, bottom: 0, fontFamily: f.mono, fontSize: 18, color: ctx.look.card.muted, lineHeight: 1.5 }}>{w.finePrint}</div>}
    </Card>
  );
  return { layers: [{ key: 'card', dx: 0, dy: 0, w: cw, h: ch, node }], hits: [{ at: from + 30, kind: 'punch' }], sfx: [[from, 'roll', 0.35]] };
};

export const checklist = (w: z.infer<typeof Checklist>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const [cw, ch] = P ? [940, 820] : [960, 640];
  const pad = P ? 50 : 52;
  const f = ctx.f;
  const ats = w.items.map((i) => ctx.cue(i.at));
  const node = (t: number) => (
    <Card ctx={ctx} w={cw} h={ch} pad={pad}>
      <Head ctx={ctx} icon="check" label={w.title.toUpperCase()} size={P ? 24 : 20} />
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: P ? 30 : 22 }}>
        {w.items.map((it, i) => {
          const p = pop(t, ats[i], 4);
          const on = t >= ats[i];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: on ? 1 : 0.35, transform: `translateX(${on ? 0 : 0}px)` }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, flex: 'none', border: `2px solid ${on ? GREEN : ctx.look.card.line}`, background: on ? 'rgba(34,197,94,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GREEN, fontSize: 32, transform: `scale(${on ? (0.7 + 0.3 * p).toFixed(3) : 1})` }}>{on ? '✓' : ''}</div>
              <div style={{ fontFamily: f.ui, fontWeight: 600, fontSize: P ? 38 : 36, whiteSpace: 'nowrap' }}>{it.text}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
  return { layers: [{ key: 'card', dx: 0, dy: 0, w: cw, h: ch, node }], sfx: ats.map((a): [number, string, number] => [a, 'tick', 0.35]) };
};
