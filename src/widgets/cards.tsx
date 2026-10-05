// Compact feature cards that usually sit side by side at one station (group): stat counter, vision scan, code editor.
import React from 'react';
import type { z } from 'zod';
import { Easing } from 'remotion';
import { Caret, Card, Chip, Fit, Head } from '../engine/atoms';
import { grad, GREEN } from '../engine/looks';
import type { Ctx, WidgetOut } from '../engine/types';
import { clamp01, inOut, lin, pop, prog, typed } from '../engine/util';
import type { Code, Stat, Vision } from '../spec/schema';

export const featureSize = (P: boolean): [number, number] => (P ? [940, 580] : [640, 580]);
const isLightCard = (ctx: Ctx) => /^#(?:[0-3])/i.test(ctx.look.card.fg) || ctx.look.card.fg.toLowerCase() === '#0b0b0b';

export const stat = (w: z.infer<typeof Stat>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const [cw, ch] = featureSize(P);
  const pad = P ? 52 : 46;
  const from = ctx.cue(w.from);
  const to = ctx.cue(w.to) + 10;
  const blocks = P ? 40 : 28;
  const loc = ctx.spec.language === 'id' ? 'id-ID' : 'en-US';
  const finalTxt = `${w.prefix ?? ''}${w.value.toLocaleString(loc)}${w.suffix ?? ''}`;
  const node = (t: number) => {
    const fill = prog(t, from - 4, to, Easing.bezier(0.3, 0, 0.2, 1));
    const n = Math.round(w.value * fill);
    return (
      <Card ctx={ctx} w={cw} h={ch} pad={pad}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Head ctx={ctx} icon="ctx" label={w.label} right={w.chip ? <Chip ctx={ctx} size={P ? 24 : 20}>{w.chip}</Chip> : undefined} size={P ? 24 : 20} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Fit text={finalTxt} family={ctx.f.disp} weight={ctx.f.dispWeight} size={P ? 112 : 92} maxW={cw - pad * 2} track={ctx.f.dispTrack} style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {`${w.prefix ?? ''}${n.toLocaleString(loc)}${w.suffix ?? ''}`}
            </Fit>
            <div style={{ marginTop: 16, fontFamily: ctx.f.ui, fontWeight: 500, fontSize: P ? 34 : 29, color: ctx.look.card.muted }}>{w.caption}</div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: (P ? 70 : 62) + 18, display: 'flex', gap: 12, height: 50 }}>
              {(w.chips ?? []).map((c, i) => {
                const a = from + 4 + i * 9;
                const sink = prog(t, a + 14, a + 30, inOut);
                return (
                  <Chip key={c} ctx={ctx} size={P ? 24 : 21} style={{ opacity: prog(t, a, a + 8) * (1 - sink), transform: `translateY(${((1 - prog(t, a, a + 12)) * -20 + sink * 40).toFixed(1)}px) scale(${(1 - sink * 0.3).toFixed(3)})` }}>
                    {c}
                  </Chip>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 5, height: P ? 70 : 62, padding: 8, background: ctx.look.card.inset, borderRadius: 16, border: `1.5px solid ${ctx.look.card.line}`, boxSizing: 'border-box' }}>
              {Array.from({ length: blocks }).map((_, i) => {
                const on = clamp01(fill * blocks - i);
                return <div key={i} style={{ flex: 1, borderRadius: 4, background: on > 0 ? grad(ctx.look, 90) : ctx.look.card.line, backgroundSize: `${blocks * 100}% 100%`, backgroundPosition: `${(i / (blocks - 1)) * 100}% 0`, opacity: 0.25 + 0.75 * on, transform: `scaleY(${(0.55 + 0.45 * on).toFixed(3)})` }} />;
              })}
            </div>
          </div>
        </div>
      </Card>
    );
  };
  return { layers: [{ key: 'card', dx: 0, dy: 0, w: cw, h: ch, node }], hits: [{ at: ctx.cue(w.to), kind: 'punch' }], sfx: [[from, 'roll', 0.35]] };
};

export const vision = (w: z.infer<typeof Vision>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const [cw, ch] = featureSize(P);
  const pad = P ? 52 : 46;
  const iw = cw - pad * 2;
  const ih = 300;
  const headH = (P ? 24 : 20) * 2.1;
  const mt = P ? 34 : 30;
  const s0 = ctx.cue(w.scanFrom);
  const s1 = ctx.cue(w.scanTo);
  const boxesAll: [number, number, number, number][] =
    w.scene === 'document'
      ? [
          [0.05, 0.07, 0.5, 0.14],
          [0.05, 0.3, 0.9, 0.36],
          [0.62, 0.74, 0.33, 0.18],
        ]
      : [
          [0.05, 0.08, 0.42, 0.16],
          [0.05, 0.33, 0.6, 0.6],
          [0.72, 0.72, 0.23, 0.18],
        ];
  const boxes = w.detect.map((label, i) => [...boxesAll[i], label] as [number, number, number, number, string]);
  const resAt = s1 - 6;
  const node = (t: number) => {
    const scan = prog(t, s0 - 2, s1 + 22, lin);
    const outTxt = w.result ? typed(w.result, t, resAt, 0.9) : '';
    const light = '#F4F4F1';
    const dark = '#2A2B30';
    return (
      <Card ctx={ctx} w={cw} h={ch} pad={pad}>
        <Head ctx={ctx} icon="eye" label={w.label} right={w.chip ? <Chip ctx={ctx} size={P ? 24 : 20}>{w.chip}</Chip> : undefined} size={P ? 24 : 20} />
        <div style={{ position: 'relative', marginTop: mt, width: iw, height: ih, borderRadius: 18, background: light, overflow: 'hidden', border: `1.5px solid ${ctx.look.card.line}` }}>
          {w.scene === 'document' ? (
            <>
              <div style={{ position: 'absolute', left: iw * 0.05, top: ih * 0.1, width: iw * 0.46, height: ih * 0.07, borderRadius: 6, background: dark }} />
              {[0, 1, 2, 3, 4].map((k) => (
                <div key={k} style={{ position: 'absolute', left: iw * 0.05, top: ih * (0.34 + k * 0.065), width: iw * (0.88 - (k % 3) * 0.12), height: ih * 0.03, borderRadius: 4, background: '#B9BAB5' }} />
              ))}
              <div style={{ position: 'absolute', left: iw * 0.64, top: ih * 0.77, width: iw * 0.3, height: ih * 0.12, borderRadius: 8, border: `3px solid ${dark}` }} />
            </>
          ) : (
            <>
              <div style={{ position: 'absolute', left: iw * 0.05, top: ih * 0.1, width: iw * 0.38, height: ih * 0.055, borderRadius: 6, background: dark }} />
              <div style={{ position: 'absolute', left: iw * 0.05, top: ih * 0.19, width: iw * 0.24, height: ih * 0.035, borderRadius: 6, background: '#B9BAB5' }} />
              <div style={{ position: 'absolute', left: iw * 0.05, top: ih * 0.35, width: iw * 0.6, height: ih * 0.58, display: 'flex', alignItems: 'flex-end', gap: iw * 0.02, borderBottom: `3px solid ${dark}` }}>
                {[0.34, 0.46, 0.4, 0.62, 0.74, 0.92].map((b, i, arr) => (
                  <div key={i} style={{ flex: 1, height: `${b * 100}%`, borderRadius: '6px 6px 0 0', background: i === arr.length - 1 ? ctx.look.hot : '#3A3B41' }} />
                ))}
              </div>
              <div style={{ position: 'absolute', left: iw * 0.72, top: ih * 0.38, width: iw * 0.23, height: ih * 0.26, borderRadius: 12, background: '#E3E3DE' }} />
              <div style={{ position: 'absolute', left: iw * 0.72, top: ih * 0.74, width: iw * 0.23, height: ih * 0.14, borderRadius: 999, background: dark }} />
            </>
          )}
          <div style={{ position: 'absolute', left: 0, right: 0, top: scan * ih - 50, height: 50, background: `linear-gradient(180deg, transparent, ${ctx.look.hot}48)`, opacity: scan > 0 && scan < 1 ? 1 : 0 }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: scan * ih - 2, height: 3, background: ctx.look.hot, opacity: scan > 0 && scan < 1 ? 1 : 0, boxShadow: `0 0 18px ${ctx.look.hot}` }} />
        </div>
        <div style={{ position: 'absolute', left: 0, top: mt + headH, width: iw, height: ih }}>
          {boxes.map(([bx, by, bw, bh, label], i) => {
            const a = s1 - 10 + i * 7;
            if (t < a) return null;
            const p = pop(t, a, 3.5);
            return (
              <div key={label + i} style={{ position: 'absolute', left: bx * iw - 6, top: by * ih - 6, width: bw * iw + 12, height: bh * ih + 12, border: `3px solid ${ctx.look.hot}`, borderRadius: 10, transform: `scale(${(1.25 - 0.25 * p).toFixed(3)})`, opacity: clamp01(p * 1.4), boxSizing: 'border-box' }}>
                <div style={{ position: 'absolute', left: 4, top: 4, background: ctx.look.hot, color: '#FFF', fontFamily: ctx.f.mono, fontWeight: 600, fontSize: P ? 24 : 18, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', left: 0, bottom: 0, fontFamily: ctx.f.mono, fontSize: P ? 28 : 24, color: ctx.look.card.fg, display: 'flex', alignItems: 'center', height: 40, whiteSpace: 'nowrap' }}>
          {outTxt}
          {outTxt.length > 0 && t < resAt + 50 ? <Caret t={t} h={P ? 28 : 24} color={ctx.look.hot} /> : null}
        </div>
      </Card>
    );
  };
  return { layers: [{ key: 'card', dx: 0, dy: 0, w: cw, h: ch, node }], hits: [{ at: s1, kind: 'punch' }], sfx: [[s0 + 2, 'scan', 0.45]] };
};

const KW = /^(async|await|function|const|let|var|if|else|return|for|while|def|import|from|export|class|new|try|catch|in|of|true|false|null|None|True|False|elif|with|as)$/;
const tokenize = (line: string): [string, 'kw' | 'call' | 'str' | 'com' | 'num' | 'txt'][] => {
  const out: [string, 'kw' | 'call' | 'str' | 'com' | 'num' | 'txt'][] = [];
  const re = /(\/\/.*|#.*)|("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) out.push([m[1], 'com']);
    else if (m[2]) out.push([m[2], 'str']);
    else if (m[3]) out.push([m[3], 'num']);
    else if (m[4]) out.push([m[4], KW.test(m[4]) ? 'kw' : 'call']);
    else if (m[5]) out.push([m[5], KW.test(m[5]) ? 'kw' : 'txt']);
    else out.push([m[6], 'txt']);
  }
  return out;
};

export const code = (w: z.infer<typeof Code>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const [cw, ch] = featureSize(P);
  const pad = P ? 52 : 46;
  const fs = P ? 30 : 23;
  const from = ctx.cue(w.from) - 8;
  const chars = w.lines.reduce((a, l) => a + l.length, 0);
  const doneAt = w.doneAt ? ctx.cue(w.doneAt) + 12 : from + Math.ceil(chars / 2.2) + 14;
  const light = isLightCard(ctx);
  const col = { kw: ctx.look.accent[0], call: light ? '#2563EB' : '#7DD3FC', str: light ? '#15803D' : '#86EFAC', com: ctx.look.card.muted, num: light ? '#B45309' : '#FCD34D', txt: ctx.look.card.insetFg };
  const toks = w.lines.map(tokenize);
  const node = (t: number) => {
    let budget = Math.max(0, Math.floor((t - from) * 2.2));
    const pass = prog(t, doneAt, doneAt + 10);
    return (
      <Card ctx={ctx} w={cw} h={ch} pad={pad}>
        <Head ctx={ctx} icon="code" label={w.label} right={w.chip ? <Chip ctx={ctx} size={P ? 24 : 20}>{w.chip}</Chip> : undefined} size={P ? 24 : 20} />
        <div style={{ marginTop: P ? 34 : 30, height: ch - pad * 2 - (P ? 24 : 20) * 2.1 - (P ? 34 : 30) - (w.done ? 64 : 0), boxSizing: 'border-box', background: ctx.look.card.inset, border: `1.5px solid ${ctx.look.card.line}`, borderRadius: 18, padding: P ? '24px 26px' : '20px 22px', fontFamily: ctx.f.mono, fontSize: fs, lineHeight: 1.6, overflow: 'hidden' }}>
          {toks.map((line, li) => {
            const spans: React.ReactNode[] = [];
            let lineChars = 0;
            line.forEach(([s, kind], si) => {
              const take = Math.min(s.length, Math.max(0, budget));
              budget -= take;
              lineChars += take;
              if (take > 0) spans.push(<span key={si} style={{ color: col[kind], whiteSpace: 'pre' }}>{s.slice(0, take)}</span>);
            });
            const caretHere = lineChars > 0 && budget <= 0;
            return (
              <div key={li} style={{ display: 'flex', height: fs * 1.6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                <span style={{ width: fs * 1.6, color: ctx.look.card.muted, opacity: 0.6, flex: 'none' }}>{li + 1}</span>
                {spans}
                {caretHere && t < doneAt ? <Caret t={t} h={fs} color={ctx.look.hot} /> : null}
              </div>
            );
          })}
        </div>
        {w.done && (
          <div style={{ position: 'absolute', left: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 14, fontFamily: ctx.f.ui, fontWeight: 600, fontSize: P ? 30 : 26, color: GREEN, opacity: pass, transform: `translateY(${((1 - pass) * 16).toFixed(1)}px)` }}>
            <span style={{ width: P ? 38 : 34, height: P ? 38 : 34, borderRadius: 10, background: 'rgba(34,197,94,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
            {w.done}
          </div>
        )}
      </Card>
    );
  };
  return { layers: [{ key: 'card', dx: 0, dy: 0, w: cw, h: ch, node }], hits: [{ at: doneAt, kind: 'punch' }], sfx: [[from + 2, 'type', 0.35], ...(w.done ? ([[doneAt, 'chime', 0.3]] as [number, string, number][]) : [])] };
};
