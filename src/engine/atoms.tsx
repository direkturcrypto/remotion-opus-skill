// Shared UI atoms. Everything reads colours/fonts from the Look, so one widget renders in every art direction.
import React from 'react';
import { Easing } from 'remotion';
import { fitSize } from './fit';
import { grad } from './looks';
import type { Ctx } from './types';
import { clamp01, prog } from './util';

export const gradText = (ctx: Ctx): React.CSSProperties => ({ backgroundImage: grad(ctx.look), WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });

/** mask-reveal characters: each glyph rises out of a clipped line */
export const Chars: React.FC<{ text: string; t: number; at: number; step?: number; style?: React.CSSProperties }> = ({ text, t, at, step = 2.4, style }) => (
  <>
    {text.split('').map((ch, i) => {
      const p = prog(t, at + i * step, at + i * step + 16);
      return (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.1em', marginBottom: '-0.1em', paddingRight: '0.02em' }}>
          <span style={{ display: 'inline-block', whiteSpace: 'pre', transform: `translateY(${((1 - p) * 108).toFixed(1)}%) rotate(${((1 - p) * 8).toFixed(1)}deg)`, ...style }}>{ch}</span>
        </span>
      );
    })}
  </>
);

export const Caret: React.FC<{ t: number; h: number; color: string }> = ({ t, h, color }) => (
  <span style={{ display: 'inline-block', width: Math.round(h * 0.45), height: h, background: color, marginLeft: 4, verticalAlign: 'middle', opacity: Math.sin(t / 4.5) > -0.2 ? 1 : 0 }} />
);

const ICON: Record<string, React.ReactNode> = {
  ctx: <path d="M5 6h14M5 10.5h14M5 15h14M5 19.5h8" stroke="#FFF" strokeWidth={2.2} strokeLinecap="round" fill="none" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="#FFF" strokeWidth={2} fill="none" strokeLinejoin="round" />
      <circle cx={12} cy={12} r={3.2} fill="#FFF" />
    </>
  ),
  code: <path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5" stroke="#FFF" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  tag: (
    <>
      <path d="M3.5 12.5V4.5h8l9 9-8 8-9-9Z" stroke="#FFF" strokeWidth={2} fill="none" strokeLinejoin="round" />
      <circle cx={8} cy={9} r={1.8} fill="#FFF" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4V5Z" stroke="#FFF" strokeWidth={2} fill="none" strokeLinejoin="round" />,
  bars: <path d="M5 20V11M10 20V6M15 20v-7M20 20V4" stroke="#FFF" strokeWidth={2.4} strokeLinecap="round" />,
  check: <path d="M4 12.5 9.5 18 20 6.5" stroke="#FFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
};

export const Head: React.FC<{ ctx: Ctx; icon: keyof typeof ICON | string; label: string; right?: React.ReactNode; size?: number }> = ({ ctx, icon, label, right, size = 22 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: size * 2.1, height: size * 2.1, borderRadius: size * 0.55, background: grad(ctx.look, 135), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <svg width={size * 1.2} height={size * 1.2} viewBox="0 0 24 24">
        {ICON[icon] ?? ICON.tag}
      </svg>
    </div>
    <div style={{ fontFamily: ctx.f.mono, fontWeight: 500, fontSize: size, letterSpacing: '0.18em', color: ctx.look.card.muted, whiteSpace: 'nowrap' }}>{label}</div>
    <div style={{ flex: 1 }} />
    {right}
  </div>
);

export const Chip: React.FC<{ ctx: Ctx; children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ ctx, children, size = 22, style }) => (
  <div style={{ fontFamily: ctx.f.mono, fontSize: size, fontWeight: 500, color: ctx.look.card.insetFg, border: `1.5px solid ${ctx.look.card.line}`, background: ctx.look.card.inset, borderRadius: 999, padding: `${size * 0.3}px ${size * 0.75}px`, whiteSpace: 'nowrap', flex: 'none', ...style }}>{children}</div>
);

export const Card: React.FC<{ ctx: Ctx; w: number; h: number; children: React.ReactNode; pad?: number; glow?: number }> = ({ ctx, w, h, children, pad = 56, glow = 1 }) => {
  const c = ctx.look.card;
  return (
    <div data-card="1" style={{ position: 'relative', width: w, height: h, borderRadius: c.radius, background: c.bg, border: c.border, boxShadow: c.shadow, overflow: 'hidden', padding: pad, boxSizing: 'border-box', color: c.fg, fontFamily: ctx.f.ui }}>
      {c.glowA > 0 && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 92% -10%, ${ctx.look.accent[0]}${Math.round(255 * Math.min(1, c.glowA * glow)).toString(16).padStart(2, '0')}, transparent 55%)`, pointerEvents: 'none' }} />}
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>{children}</div>
    </div>
  );
};

/** fitted single line — measured, never overflows maxW */
export const Fit: React.FC<{ text: string; family: string; weight: number; size: number; maxW: number; track?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ text, family, weight, size, maxW, track = 0, style, children }) => {
  const s = fitSize(text, family, weight, size, maxW, track);
  return (
    <div data-fit="1" style={{ fontFamily: family, fontWeight: weight, fontSize: s, letterSpacing: `${track}em`, whiteSpace: 'nowrap', lineHeight: 1.08, maxWidth: maxW, ...style }}>
      {children ?? text}
    </div>
  );
};

/** slot-style odometer: digit columns roll down and land, staggered right → left. "?" placeholders before `at`. */
export const Odo: React.FC<{ text: string; t: number; at: number; color: string; ghost: string }> = ({ text, t, at, color, ghost }) => {
  const chars = text.split('');
  const digits = chars.filter((ch) => /\d/.test(ch)).length;
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

/** brand mark: the real Vikey glyph, or a monogram tile in the brand colour */
export const Mark: React.FC<{ ctx: Ctx; size: number; id: string }> = ({ ctx, size, id }) => {
  const b = ctx.spec.brand;
  if (b.mark === 'vikey')
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" style={{ flex: 'none', display: 'block' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#EF4444" />
            <stop offset="1" stopColor="#B91C1C" />
          </linearGradient>
        </defs>
        <rect width={48} height={48} rx={12} fill={`url(#${id})`} />
        <g fill="none" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 15 L23 24 L11 33" />
          <path d="M23 24 H38" />
          <path d="M31 24 V31" />
          <path d="M38 24 V30" />
        </g>
      </svg>
    );
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.25, background: b.color ?? grad(ctx.look, 135), color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ctx.f.disp, fontWeight: ctx.f.dispWeight, fontSize: size * 0.56, flex: 'none' }}>
      {b.name.slice(0, 1).toUpperCase()}
    </div>
  );
};

export const fadeUp = (t: number, at: number, dist = 24) => {
  const p = prog(t, at, at + 14);
  return { opacity: clamp01(p), transform: `translateY(${((1 - p) * dist).toFixed(1)}px)` } as React.CSSProperties;
};
