// Text tools. Big text must be measured (Fit / fit) — width guesses are how text ends up "nabrak" the edge.
import React from 'react';
import { Easing } from 'remotion';
import { fitSize, textW } from '../engine/fit';
import { clamp01, pop, prog, typed } from '../engine/util';

export { textW };
/** largest size ≤ max (px) at which `text` fits in maxW */
export const fit = (text: string, font: string, weight: number, max: number, maxW: number, trackEm = 0) => fitSize(text, font, weight, max, maxW, trackEm);

/** one measured line; never wider than maxW. Children may replace the text (e.g. animated chars) at the same size. */
export const Fit: React.FC<{ text: string; font: string; weight: number; size: number; maxW: number; track?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ text, font, weight, size, maxW, track = 0, style, children }) => {
  const s = fitSize(text, font, weight, size, maxW, track);
  return (
    <div data-fit="1" style={{ fontFamily: font, fontWeight: weight, fontSize: s, letterSpacing: `${track}em`, whiteSpace: 'nowrap', lineHeight: 1.05, maxWidth: maxW, ...style }}>
      {children ?? text}
    </div>
  );
};

type Mode = 'rise' | 'drop' | 'blur' | 'scale' | 'slam';
/** per-glyph reveal starting at frame `at`. mode: rise (mask up), drop, blur (focus in), scale (pop), slam (overshoot + shake-free settle) */
export const Chars: React.FC<{ text: string; t: number; at: number; step?: number; mode?: Mode; style?: React.CSSProperties }> = ({ text, t, at, step = 2.2, mode = 'rise', style }) => (
  <>
    {text.split('').map((ch, i) => {
      const a = at + i * step;
      const p = prog(t, a, a + 16);
      let inner: React.CSSProperties = {};
      if (mode === 'rise') inner = { transform: `translateY(${((1 - p) * 108).toFixed(1)}%) rotate(${((1 - p) * 8).toFixed(1)}deg)` };
      if (mode === 'drop') inner = { transform: `translateY(${((p - 1) * 108).toFixed(1)}%)` };
      if (mode === 'blur') inner = { opacity: p, filter: `blur(${((1 - p) * 14).toFixed(1)}px)`, transform: `scale(${(1.25 - 0.25 * p).toFixed(3)})` };
      if (mode === 'scale') inner = { transform: `scale(${pop(t, a, 3.5).toFixed(3)})`, opacity: t >= a ? 1 : 0 };
      if (mode === 'slam') inner = { transform: `scale(${(t < a ? 2.2 : 1 + 1.2 * Math.exp(-(t - a) / 3)).toFixed(3)})`, opacity: prog(t, a - 2, a + 2) };
      const clip = mode === 'rise' || mode === 'drop';
      return (
        <span key={i} style={{ display: 'inline-block', overflow: clip ? 'hidden' : 'visible', verticalAlign: 'bottom', paddingBottom: clip ? '0.1em' : 0, marginBottom: clip ? '-0.1em' : 0 }}>
          <span style={{ display: 'inline-block', whiteSpace: 'pre', ...inner, ...style }}>{ch}</span>
        </span>
      );
    })}
  </>
);

export const Caret: React.FC<{ t: number; h: number; color: string }> = ({ t, h, color }) => (
  <span style={{ display: 'inline-block', width: Math.round(h * 0.45), height: h, background: color, marginLeft: 4, verticalAlign: 'middle', opacity: Math.sin(t / 4.5) > -0.2 ? 1 : 0 }} />
);

/** typed text from frame `at` at `cps` characters per frame, with a blinking caret while typing */
export const Typewriter: React.FC<{ text: string; t: number; at: number; cps?: number; caret?: string; caretH?: number; style?: React.CSSProperties }> = ({ text, t, at, cps = 1.2, caret, caretH = 30, style }) => {
  const s = typed(text, t, at, cps);
  return (
    <span style={{ whiteSpace: 'pre', ...style }}>
      {s}
      {caret && s.length < text.length + 6 && t < at + text.length / cps + 40 ? <Caret t={t} h={caretH} color={caret} /> : null}
    </span>
  );
};

/** slot-machine odometer: digit columns roll down and land (right → left). "?" placeholders before `at`. */
export const Odometer: React.FC<{ text: string; t: number; at: number; color?: string; ghost?: string }> = ({ text, t, at, color, ghost = 'rgba(127,127,127,0.35)' }) => {
  const chars = text.split('');
  const digits = chars.filter((c) => /\d/.test(c)).length;
  let di = 0;
  return (
    <span style={{ display: 'inline-flex', color, lineHeight: 1.1 }}>
      {chars.map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i} style={{ whiteSpace: 'pre' }}>{ch}</span>;
        const k = digits - 1 - di++;
        const end = 20 + Number(ch);
        const start = end - 10 - k * 3;
        const p = prog(t, at + k * 2.5, at + 22 + k * 2.5, Easing.bezier(0.2, 0.7, 0.2, 1));
        const pos = t < at ? -1 : start + (end - start) * p;
        return (
          <span key={i} style={{ display: 'inline-block', height: '1.1em', overflow: 'hidden', position: 'relative' }}>
            <span style={{ visibility: 'hidden' }}>0</span>
            {pos < 0 ? (
              <span style={{ position: 'absolute', left: 0, top: 0, color: ghost }}>?</span>
            ) : (
              <span style={{ position: 'absolute', left: 0, top: 0, display: 'flex', flexDirection: 'column', transform: `translateY(${(-pos * 1.1).toFixed(3)}em)` }}>
                {Array.from({ length: 30 }).map((_, j) => (
                  <span key={j} style={{ height: '1.1em' }}>
                    {j % 10}
                  </span>
                ))}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
};

/** number counting from `from` to `to` between frames start→end (eased), formatted with the locale */
export const CountUp: React.FC<{ t: number; from?: number; to: number; start: number; end: number; locale?: string; decimals?: number; prefix?: string; suffix?: string; style?: React.CSSProperties }> = ({ t, from = 0, to, start, end, locale = 'id-ID', decimals = 0, prefix = '', suffix = '', style }) => {
  const v = from + (to - from) * prog(t, start, end, Easing.bezier(0.3, 0, 0.2, 1));
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{`${prefix}${v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`}</span>;
};

/** marker swipe behind a word, drawn from `at` */
export const Highlight: React.FC<{ t: number; at: number; color: string; children: React.ReactNode; height?: string }> = ({ t, at, color, children, height = '0.42em' }) => (
  <span style={{ position: 'relative', display: 'inline-block' }}>
    <span style={{ position: 'absolute', left: '-0.08em', right: '-0.08em', bottom: '0.08em', height, background: color, transform: `scaleX(${clamp01(prog(t, at, at + 12)).toFixed(3)}) skewX(-8deg)`, transformOrigin: 'left center', zIndex: 0 }} />
    <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
  </span>
);

/** a strike line drawn across its children from `at` */
export const Strike: React.FC<{ t: number; at: number; color: string; thickness?: number; children: React.ReactNode }> = ({ t, at, color, thickness = 6, children }) => (
  <span style={{ position: 'relative', display: 'inline-block' }}>
    {children}
    <span style={{ position: 'absolute', left: -6, right: -6, top: '52%', height: thickness, borderRadius: thickness, background: color, transform: `scaleX(${prog(t, at - 2, at + 8).toFixed(3)}) rotate(-3deg)`, transformOrigin: 'left center' }} />
  </span>
);
