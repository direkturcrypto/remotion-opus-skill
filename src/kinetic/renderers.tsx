// Typographic versions of every widget for the kinetic engine: no cards, giant fitted type on a colour field,
// everything revealed on its VO word. Each scene leaves room for the "portal" disc the camera zooms through next.
import React from 'react';
import { Easing } from 'remotion';
import { Caret, Chars, Mark, Odo } from '../engine/atoms';
import { fitSize } from '../engine/fit';
import { GREEN } from '../engine/looks';
import type { Ctx, Hit, Sfx } from '../engine/types';
import { clamp01, lin, pop, prog, typed } from '../engine/util';
import type { Widget } from '../spec/schema';

export type KPal = { bg: string; fg: string; muted: string; hot: string; line: string; inset: string };
export type Box = { x: number; y: number; w: number; h: number };
export type KCtx = Ctx & { pal: KPal; box: Box; fw: number; fh: number };
export type KOut = { node: (t: number) => React.ReactNode; hits?: Hit[]; sfx?: Sfx[] };

/** the scene's text block, vertically centred in its box so tall frames (portrait) don't leave a hole */
const Abs: React.FC<{ x: number; y: number; w?: number; h?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, w, h, children, style }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', ...style }}>
    <div style={{ position: 'relative', width: '100%' }}>{children}</div>
  </div>
);

/** a giant line: measured to the box, glyphs rise on their cues */
const Big: React.FC<{ k: KCtx; parts: { text: string; at: number; accent?: boolean }[]; max: number; t: number; color?: string; gap?: number; ghost?: boolean }> = ({ k, parts, max, t, color, gap = 0.22, ghost }) => {
  const f = k.f;
  const str = parts.map((p) => p.text).join(gap ? ' ' : '');
  const size = fitSize(str, f.disp, f.dispWeight, max, k.box.w, f.dispTrack);
  return (
    <div data-fit="1" style={{ position: 'relative', display: 'flex', columnGap: size * gap, whiteSpace: 'nowrap', fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: size, letterSpacing: `${f.dispTrack}em`, lineHeight: 1.02, color: color ?? k.pal.fg, maxWidth: k.box.w }}>
      {/* faint outline of the full line, so a scene is never empty before its words are spoken */}
      {ghost && <div style={{ position: 'absolute', left: 0, top: 0, display: 'flex', columnGap: size * gap, color: 'transparent', WebkitTextStroke: `2px ${color ?? k.pal.fg}`, opacity: 0.18 * (1 - prog(t, parts[0].at - 4, parts[parts.length - 1].at + 10)) }}>{parts.map((p, i) => <span key={i}>{p.text}</span>)}</div>}
      {parts.map((p, i) => (
        <span key={i}>
          <Chars text={p.text} t={t} at={p.at - 4} step={1.8} style={p.accent ? { color: k.pal.hot } : undefined} />
        </span>
      ))}
    </div>
  );
};

const Kicker: React.FC<{ k: KCtx; text: string; t: number; at: number }> = ({ k, text, t, at }) => (
  <div style={{ fontFamily: k.f.mono, fontWeight: 500, fontSize: k.P ? 30 : 30, letterSpacing: '0.32em', color: k.pal.muted, height: 40, whiteSpace: 'nowrap' }}>{typed(text, t, at, 0.7)}</div>
);

const Tag: React.FC<{ k: KCtx; text: string; t: number; at: number; solid?: boolean }> = ({ k, text, t, at, solid }) => {
  const p = pop(t, at, 4);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '12px 26px', borderRadius: 999, background: solid ? k.pal.hot : 'transparent', border: `3px solid ${solid ? k.pal.hot : k.pal.fg}`, color: solid ? k.pal.bg.startsWith('linear') ? '#111' : k.pal.bg : k.pal.fg, fontFamily: k.f.ui, fontWeight: 700, fontSize: 28, letterSpacing: '0.12em', transform: `scale(${p.toFixed(3)}) rotate(-3deg)`, transformOrigin: 'left center', whiteSpace: 'nowrap' }}>
      {text}
    </div>
  );
};

const Dash: React.FC<{ k: KCtx; p: number; h?: number }> = ({ k, p, h = 10 }) => (
  <div style={{ width: k.box.w, height: h, background: k.pal.line, borderRadius: h }}>
    <div style={{ width: `${(clamp01(p) * 100).toFixed(2)}%`, height: '100%', borderRadius: h, background: k.pal.hot }} />
  </div>
);

export const kineticWidget = (w: Widget, k: KCtx): KOut => {
  const { cue, f, pal, box } = k;
  const P = k.P;
  switch (w.type) {
    case 'hero': {
      const nameAt = w.name.map((n) => cue(n.at));
      const accAt = w.accentWord ? cue(w.accentWord.at) : null;
      const kickAt = w.kickerAt ? cue(w.kickerAt) : nameAt[0] - 30;
      const last = accAt ?? nameAt[nameAt.length - 1];
      return {
        node: (t) => (
          <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
            <Tag k={k} text={w.badge} t={t} at={k.index === 0 ? -8 : k.arrive - 12} solid />
            <div style={{ height: P ? 60 : 44 }} />
            {w.kicker && <Kicker k={k} text={w.kicker} t={t} at={kickAt} />}
            <Big k={k} t={t} max={P ? 210 : 230} gap={0} ghost parts={w.name.map((n, i) => ({ text: n.text, at: nameAt[i], accent: n.accent }))} />
            {w.accentWord && accAt !== null && (
              <div style={{ transform: `scale(${pop(t, accAt - 3, 4).toFixed(3)})`, transformOrigin: 'left center', opacity: t >= accAt - 3 ? 1 : 0 }}>
                <Big k={k} t={t} max={P ? 230 : 210} parts={[{ text: w.accentWord.text, at: accAt - 6 }]} color={pal.hot} />
              </div>
            )}
            {w.id && (
              <div style={{ marginTop: 30, fontFamily: f.mono, fontSize: 34, color: pal.fg, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', opacity: prog(t, nameAt[0] - 6, nameAt[0] + 4) }}>
                <span style={{ color: pal.hot, marginRight: 14 }}>$</span>
                {typed(w.id, t, nameAt[0] - 4, w.id.length / Math.max(24, last - nameAt[0]))}
                <Caret t={t} h={34} color={pal.hot} />
              </div>
            )}
            {w.status && <div style={{ marginTop: 18, fontFamily: f.ui, fontWeight: 600, fontSize: 34, color: pal.muted, opacity: prog(t, last + 4, last + 16) }}>{w.status}</div>}
          </Abs>
        ),
        hits: [...(accAt !== null ? [{ at: accAt, kind: 'shake' as const }, { at: accAt, kind: 'punch' as const }] : []), { at: nameAt[0], kind: 'punch' as const }],
        sfx: [[nameAt[0] - 4, 'type', 0.35], ...(accAt !== null ? ([[accAt - 3, 'impact', 0.5]] as Sfx[]) : [])],
      };
    }
    case 'stat': {
      const from = cue(w.from);
      const to = cue(w.to) + 10;
      const loc = k.spec.language === 'id' ? 'id-ID' : 'en-US';
      const finalTxt = `${w.prefix ?? ''}${w.value.toLocaleString(loc)}${w.suffix ?? ''}`;
      const size = fitSize(finalTxt, f.disp, f.dispWeight, P ? 230 : 250, box.w, f.dispTrack);
      return {
        node: (t) => {
          const fill = prog(t, from - 4, to, Easing.bezier(0.3, 0, 0.2, 1));
          return (
            <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
              <Kicker k={k} text={w.label} t={t} at={k.arrive - 20} />
              <div data-fit="1" style={{ marginTop: 20, fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: size, letterSpacing: `${f.dispTrack}em`, lineHeight: 1, color: pal.fg, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {`${w.prefix ?? ''}${Math.round(w.value * fill).toLocaleString(loc)}${w.suffix ?? ''}`}
              </div>
              <div style={{ marginTop: 26, fontFamily: f.ui, fontWeight: 600, fontSize: P ? 44 : 46, color: pal.fg, opacity: prog(t, from + 6, from + 20) }}>{w.caption}</div>
              <div style={{ marginTop: 40 }}>
                <Dash k={k} p={fill} h={14} />
              </div>
              <div style={{ marginTop: 22, display: 'flex', gap: 14 }}>
                {(w.chips ?? []).map((c, i) => (
                  <span key={c} style={{ fontFamily: f.mono, fontSize: 26, color: pal.muted, opacity: prog(t, from + 4 + i * 6, from + 14 + i * 6) }}>
                    + {c}
                  </span>
                ))}
              </div>
            </Abs>
          );
        },
        hits: [{ at: cue(w.to), kind: 'punch' }],
        sfx: [[from, 'roll', 0.35]],
      };
    }
    case 'vision': {
      const s0 = cue(w.scanFrom);
      const s1 = cue(w.scanTo);
      const iw = Math.min(box.w, P ? 900 : 760);
      const ih = iw * 0.52;
      const boxes: [number, number, number, number][] = [
        [0.05, 0.08, 0.42, 0.16],
        [0.05, 0.33, 0.6, 0.6],
        [0.72, 0.72, 0.23, 0.18],
      ];
      return {
        node: (t) => {
          const scan = prog(t, s0 - 2, s1 + 22, lin);
          return (
            <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
              <Kicker k={k} text={w.label} t={t} at={k.arrive - 20} />
              <Big k={k} t={t} max={P ? 150 : 140} parts={(w.chip ?? w.label).split(' ').map((x, i) => ({ text: x, at: s0 + i * 6 }))} />
              <div style={{ position: 'relative', marginTop: 34, width: iw, height: ih, borderRadius: 22, background: '#F4F4F1', overflow: 'hidden', boxShadow: `14px 14px 0 ${pal.hot}` }}>
                <div style={{ position: 'absolute', left: iw * 0.05, top: ih * 0.1, width: iw * 0.38, height: ih * 0.055, borderRadius: 6, background: '#2A2B30' }} />
                <div style={{ position: 'absolute', left: iw * 0.05, top: ih * 0.35, width: iw * 0.6, height: ih * 0.58, display: 'flex', alignItems: 'flex-end', gap: iw * 0.02, borderBottom: '3px solid #2A2B30' }}>
                  {[0.34, 0.46, 0.4, 0.62, 0.74, 0.92].map((b, i, arr) => (
                    <div key={i} style={{ flex: 1, height: `${b * 100}%`, borderRadius: '6px 6px 0 0', background: i === arr.length - 1 ? k.look.hot : '#3A3B41' }} />
                  ))}
                </div>
                <div style={{ position: 'absolute', left: iw * 0.72, top: ih * 0.74, width: iw * 0.23, height: ih * 0.14, borderRadius: 999, background: '#2A2B30' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, top: scan * ih - 3, height: 5, background: k.look.hot, opacity: scan > 0 && scan < 1 ? 1 : 0, boxShadow: `0 0 22px ${k.look.hot}` }} />
                {w.detect.map((label, i) => {
                  const a = s1 - 10 + i * 7;
                  if (t < a) return null;
                  const [bx, by, bw, bh] = boxes[i];
                  return (
                    <div key={label} style={{ position: 'absolute', left: bx * iw - 6, top: by * ih - 6, width: bw * iw + 12, height: bh * ih + 12, border: `4px solid ${k.look.hot}`, borderRadius: 10, opacity: clamp01(pop(t, a, 3.5) * 1.4), boxSizing: 'border-box' }}>
                      <div style={{ position: 'absolute', left: 4, top: 4, background: k.look.hot, color: '#FFF', fontFamily: f.mono, fontWeight: 600, fontSize: 22, padding: '3px 10px', borderRadius: 6 }}>{label}</div>
                    </div>
                  );
                })}
              </div>
              {w.result && <div style={{ marginTop: 26, fontFamily: f.mono, fontSize: 32, color: pal.fg }}>{typed(w.result, t, s1 - 6, 0.9)}</div>}
            </Abs>
          );
        },
        hits: [{ at: s1, kind: 'punch' }],
        sfx: [[s0 + 2, 'scan', 0.45]],
      };
    }
    case 'code': {
      const from = cue(w.from) - 8;
      const chars = w.lines.reduce((a, l) => a + l.length, 0);
      const doneAt = w.doneAt ? cue(w.doneAt) + 12 : from + Math.ceil(chars / 2.4) + 14;
      const longest = w.lines.reduce((a, l) => (l.length > a.length ? l : a), '');
      const fs = fitSize(longest + '00', f.mono, 500, P ? 46 : 52, box.w);
      return {
        node: (t) => {
          let budget = Math.max(0, Math.floor((t - from) * 2.4));
          return (
            <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
              <Kicker k={k} text={w.label} t={t} at={k.arrive - 20} />
              <div style={{ marginTop: 26, fontFamily: f.mono, fontSize: fs, lineHeight: 1.5, color: pal.fg }}>
                {w.lines.map((ln, i) => {
                  const take = Math.min(ln.length, Math.max(0, budget));
                  budget -= take;
                  return (
                    <div key={i} style={{ whiteSpace: 'pre', height: fs * 1.5 }}>
                      <span style={{ color: pal.muted, marginRight: fs * 0.8 }}>{String(i + 1).padStart(2, ' ')}</span>
                      {ln.slice(0, take)}
                      {take > 0 && take < ln.length ? <Caret t={t} h={fs} color={pal.hot} /> : null}
                    </div>
                  );
                })}
              </div>
              {w.done && (
                <div style={{ marginTop: 30, display: 'inline-flex', alignItems: 'center', gap: 16, fontFamily: f.ui, fontWeight: 700, fontSize: 40, color: GREEN, opacity: prog(t, doneAt, doneAt + 10), transform: `scale(${pop(t, doneAt, 4).toFixed(3)})`, transformOrigin: 'left center' }}>
                  ✓ {w.done}
                </div>
              )}
            </Abs>
          );
        },
        hits: [{ at: doneAt, kind: 'punch' }],
        sfx: [[from + 2, 'type', 0.35], ...(w.done ? ([[doneAt, 'chime', 0.3]] as Sfx[]) : [])],
      };
    }
    case 'price': {
      const cut = cue(w.cutAt);
      const bAt = w.badge ? cue(w.badge.at) : null;
      const oursSize = Math.min(...w.rows.map((r) => fitSize(r.ours, f.disp, f.dispWeight, P ? 170 : (w.rows.length > 1 ? 150 : 210), box.w * (P ? 0.9 : 0.62), f.dispTrack)));
      const offSize = Math.min(...w.rows.map((r) => fitSize(r.official, f.disp, 500, P ? 64 : 60, box.w * 0.5, -0.03)));
      return {
        node: (t) => {
          const cutP = prog(t, cut - 2, cut + 8, Easing.bezier(0.5, 0, 0.2, 1));
          return (
            <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
              <Kicker k={k} text={w.title} t={t} at={k.arrive - 24} />
              {w.rows.map((r, i) => (
                <div key={r.label} style={{ marginTop: i ? 26 : 22 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: f.ui, fontWeight: 700, fontSize: 40, color: pal.fg }}>{r.label}</span>
                    <span style={{ position: 'relative', fontFamily: f.disp, fontWeight: 500, fontSize: offSize, color: pal.muted, opacity: 1 - clamp01((t - cut) / 6) * 0.4 }}>
                      {r.official}
                      <span style={{ position: 'absolute', left: -8, right: -8, top: '52%', height: 8, borderRadius: 4, background: pal.hot, transform: `scaleX(${cutP.toFixed(3)}) rotate(-4deg)`, transformOrigin: 'left center' }} />
                    </span>
                    {r.officialSub && <span style={{ fontFamily: f.mono, fontSize: 24, color: pal.muted }}>{r.officialSub}</span>}
                  </div>
                  <div data-fit="1" style={{ fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: oursSize, letterSpacing: `${f.dispTrack}em`, lineHeight: 1.04, whiteSpace: 'nowrap' }}>
                    <Odo text={r.ours} t={t} at={cut + 2 + i * 6} color={pal.hot} ghost={pal.line} />
                  </div>
                </div>
              ))}
              {w.badge && bAt !== null && (
                <div style={{ position: 'absolute', right: P ? 0 : -40, top: P ? 40 : 0, width: 230, height: 230, borderRadius: 115, background: pal.fg, color: pal.bg.startsWith('linear') ? '#111' : pal.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `rotate(${(-12 + (1 - pop(t, bAt - 3, 4)) * 40).toFixed(1)}deg) scale(${pop(t, bAt - 3, 4).toFixed(3)})`, opacity: t >= bAt - 3 ? 1 : 0 }}>
                  <div style={{ fontFamily: f.mono, fontWeight: 600, fontSize: 22, letterSpacing: '0.24em' }}>{w.badge.top}</div>
                  <div style={{ fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: fitSize(w.badge.value, f.disp, f.dispWeight, 70, 190, f.dispTrack), letterSpacing: `${f.dispTrack}em` }}>{w.badge.value}</div>
                </div>
              )}
              <div style={{ marginTop: 28, maxWidth: box.w, fontFamily: f.mono, fontSize: P ? 20 : 18, lineHeight: 1.5, color: pal.muted }}>{w.finePrint}</div>
            </Abs>
          );
        },
        hits: [{ at: cut, kind: 'flashBrand' }, { at: cut, kind: 'shake' }, { at: cut, kind: 'punch' }, ...(bAt !== null ? [{ at: bAt, kind: 'shake' as const }, { at: bAt, kind: 'punch' as const }] : [])],
        sfx: [[cut - 3, 'slash', 0.6], [cut + 3, 'roll', 0.5], ...(bAt !== null ? ([[bAt - 4, 'stamp', 0.6]] as Sfx[]) : [])],
      };
    }
    case 'agents': {
      const go = cue(w.goAt);
      const headAt = w.headline.map((h) => cue(h.at));
      return {
        node: (t) => (
          <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
            <Big k={k} t={t} max={P ? 170 : 170} parts={w.headline.map((h, i) => ({ text: h.text, at: headAt[i], accent: h.accent }))} />
            <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: P ? 26 : 20 }}>
              {w.items.map((it, i) => {
                const st = go + 2 + i * 4;
                const fast = prog(t, st, st + 16, Easing.bezier(0.3, 0, 0.1, 1));
                const slow = 0.08 + 0.1 * prog(t, k.arrive - 30, go, lin);
                const p = slow + (1 - slow) * fast;
                const done = t >= st + 16;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, whiteSpace: 'nowrap' }}>
                    <span style={{ width: P ? 230 : 250, fontFamily: f.mono, fontWeight: 600, fontSize: 30, color: pal.fg }}>{it.name}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: f.ui, fontWeight: 600, fontSize: 30, color: pal.muted, marginBottom: 8 }}>{it.task}</div>
                      <div style={{ height: 10, borderRadius: 5, background: pal.line }}>
                        <div style={{ width: `${(p * 100).toFixed(1)}%`, height: '100%', borderRadius: 5, background: pal.hot }} />
                      </div>
                    </div>
                    <span style={{ width: 44, fontSize: 36, color: done ? GREEN : pal.muted }}>{done ? '✓' : ''}</span>
                  </div>
                );
              })}
            </div>
          </Abs>
        ),
        hits: [...(w.effect !== 'none' ? [{ at: go, kind: w.effect === 'bolt' ? ('bolt' as const) : ('whip' as const) }] : []), { at: go, kind: 'flash' }, { at: go + 1, kind: 'shake' }, ...(headAt.length > 1 ? [{ at: headAt[1], kind: 'punch' as const }] : [])],
        sfx: [[go - 8, w.effect === 'bolt' ? 'impact' : 'whip', 0.8], ...w.items.map((_, i): Sfx => [go + 18 + i * 4, 'tick', 0.3])],
      };
    }
    case 'lockup': {
      const logoAt = cue(w.logoAt);
      const dot = w.wordmark.lastIndexOf('.');
      const head = dot > 0 ? w.wordmark.slice(0, dot) : w.wordmark;
      const tail = dot > 0 ? w.wordmark.slice(dot) : '';
      const markSize = P ? 170 : 180;
      const wm = fitSize(w.wordmark, f.disp, f.dispWeight, P ? 150 : 190, k.fw - 260 - markSize, f.dispTrack);
      return {
        node: (t) => {
          const logo = t < logoAt - 4 ? 0 : pop(t, logoAt - 4, 4);
          const chips = prog(t, logoAt + 8, logoAt + 24);
          return (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, color: pal.fg, paddingBottom: P ? 220 : 120 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 36, transform: `scale(${(0.86 + 0.14 * logo).toFixed(3)})` }}>
                <Mark ctx={k} size={markSize} id={`kmk${P ? 'p' : 'l'}`} />
                <div data-fit="1" style={{ fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: wm, letterSpacing: `${f.dispTrack}em`, whiteSpace: 'nowrap' }}>
                  {head}
                  <span style={{ color: k.spec.brand.color ?? pal.hot }}>{tail}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: P ? 'column' : 'row', gap: 18, alignItems: 'center', opacity: chips }}>
                {w.chips.map((c, i) => (
                  <div key={i} style={{ whiteSpace: 'nowrap', padding: '16px 30px', borderRadius: 999, fontFamily: c.style === 'dark' ? f.mono : f.ui, fontWeight: c.style === 'dark' ? 500 : 700, fontSize: 34, background: c.style === 'dark' ? pal.fg : pal.hot, color: c.style === 'dark' ? (pal.bg.startsWith('linear') ? '#111' : pal.bg) : '#FFFFFF' }}>
                    {c.text}
                  </div>
                ))}
              </div>
              {w.cta && <div style={{ fontFamily: f.ui, fontWeight: 700, fontSize: 48, opacity: t >= logoAt + 20 ? 1 : 0, transform: `scale(${clamp01(pop(t, logoAt + 20, 5) * 1.1).toFixed(3)})` }}>{w.cta} →</div>}
              {w.finePrint && <div style={{ maxWidth: k.fw - 240, textAlign: 'center', fontFamily: f.mono, fontSize: P ? 18 : 17, lineHeight: 1.5, color: pal.muted, opacity: chips }}>{w.finePrint}</div>}
            </div>
          );
        },
        hits: [{ at: logoAt, kind: 'shake' }, { at: logoAt, kind: 'punch' }],
        sfx: [[logoAt - 3, 'impact', 0.45], ...(w.cta ? ([[logoAt + 18, 'chime', 0.4]] as Sfx[]) : [])],
      };
    }
    case 'headline': {
      const ats = w.lines.map((ln) => ln.map((x) => cue(x.at)));
      const subAt = ats[ats.length - 1][ats[ats.length - 1].length - 1] + 10;
      return {
        node: (t) => (
          <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
            {w.lines.map((ln, li) => (
              <Big key={li} k={k} t={t} max={P ? 200 : 220} parts={ln.map((x, i) => ({ text: x.text, at: ats[li][i], accent: x.accent }))} />
            ))}
            {w.sub && <div style={{ marginTop: 30, fontFamily: f.ui, fontWeight: 600, fontSize: 46, color: pal.muted, opacity: prog(t, subAt, subAt + 14) }}>{w.sub}</div>}
          </Abs>
        ),
        hits: ats.map((a) => ({ at: a[0], kind: 'punch' as const })),
      };
    }
    case 'chat': {
      const ats = w.messages.map((m) => cue(m.at));
      return {
        node: (t) => (
          <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
            <Kicker k={k} text={w.title.toUpperCase()} t={t} at={k.arrive - 20} />
            <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 22 }}>
              {w.messages.map((m, i) => {
                const ai = m.from === 'ai';
                if (t < ats[i] - (ai ? 18 : 6)) return null;
                const typing = ai && t < ats[i];
                return (
                  <div key={i} style={{ alignSelf: ai ? 'flex-start' : 'flex-end', maxWidth: '88%', padding: '22px 30px', borderRadius: 30, background: ai ? pal.fg : pal.hot, color: ai ? (pal.bg.startsWith('linear') ? '#111' : pal.bg) : '#FFFFFF', fontFamily: f.ui, fontWeight: 600, fontSize: P ? 40 : 42, lineHeight: 1.3, transform: `scale(${Math.min(1, 0.85 + 0.15 * pop(t, ats[i] - (ai ? 0 : 6), 4)).toFixed(3)})`, transformOrigin: ai ? 'left bottom' : 'right bottom' }}>
                    {typing ? '•••'.slice(0, 1 + (Math.floor(t / 6) % 3)) : ai ? typed(m.text, t, ats[i], 1.8) : m.text}
                  </div>
                );
              })}
            </div>
          </Abs>
        ),
        sfx: ats.map((a, i): Sfx => [a - (w.messages[i].from === 'ai' ? 0 : 6), 'pop', 0.45]),
      };
    }
    case 'bars': {
      const from = cue(w.from);
      const max = Math.max(...w.items.map((i) => i.value)) || 1;
      return {
        node: (t) => (
          <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
            <Kicker k={k} text={w.title.toUpperCase()} t={t} at={k.arrive - 20} />
            <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 26 }}>
              {w.items.map((it, i) => {
                const p = prog(t, from + i * 6, from + i * 6 + 28);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: f.ui, fontWeight: it.highlight ? 800 : 600, fontSize: 36, color: it.highlight ? pal.fg : pal.muted }}>
                      <span>{it.label}</span>
                      <span style={{ fontFamily: f.disp, color: it.highlight ? pal.hot : pal.fg, opacity: prog(t, from + i * 6 + 14, from + i * 6 + 24) }}>{it.display}</span>
                    </div>
                    <div style={{ marginTop: 8, height: it.highlight ? 34 : 22, borderRadius: 8, background: pal.line }}>
                      <div style={{ width: `${((it.value / max) * 100 * p).toFixed(1)}%`, height: '100%', borderRadius: 8, background: it.highlight ? pal.hot : pal.muted }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {w.finePrint && <div style={{ marginTop: 24, fontFamily: f.mono, fontSize: 18, color: pal.muted }}>{w.finePrint}</div>}
          </Abs>
        ),
        hits: [{ at: from + 30, kind: 'punch' }],
        sfx: [[from, 'roll', 0.35]],
      };
    }
    case 'checklist': {
      const ats = w.items.map((i) => cue(i.at));
      return {
        node: (t) => (
          <Abs x={box.x} y={box.y} w={box.w} h={box.h}>
            <Kicker k={k} text={w.title.toUpperCase()} t={t} at={k.arrive - 20} />
            <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {w.items.map((it, i) => {
                const on = t >= ats[i];
                const size = fitSize(it.text, f.disp, f.dispWeight, P ? 76 : 80, box.w - 110, f.dispTrack);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: on ? 1 : 0.25 }}>
                    <span style={{ width: 70, height: 70, borderRadius: 18, flex: 'none', background: on ? pal.hot : 'transparent', border: `4px solid ${on ? pal.hot : pal.line}`, color: '#FFF', fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${on ? (0.7 + 0.3 * pop(t, ats[i], 4)).toFixed(3) : 1})` }}>{on ? '✓' : ''}</span>
                    <span data-fit="1" style={{ fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: size, letterSpacing: `${f.dispTrack}em`, color: pal.fg, whiteSpace: 'nowrap' }}>{it.text}</span>
                  </div>
                );
              })}
            </div>
          </Abs>
        ),
        sfx: ats.map((a): Sfx => [a, 'tick', 0.35]),
      };
    }
  }
};
