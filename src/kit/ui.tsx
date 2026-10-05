// Optional UI-motion frames: a phone, desktop/browser windows, a cursor, a notification banner, the brand mark.
// They are shells — what goes inside (chat, dashboard, editor, game HUD…) is for the scene to invent.
import React from 'react';
import { pop, prog } from '../engine/util';
import { useVO } from './vo';

/** brand mark: the Vikey glyph, or a monogram tile in the brand colour */
export const Mark: React.FC<{ size: number; id?: string }> = ({ size, id = 'kitMark' }) => {
  const { brand } = useVO();
  if (brand.mark === 'vikey')
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
    <div style={{ width: size, height: size, borderRadius: size * 0.25, background: brand.color ?? '#111', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.56, flex: 'none' }}>
      {brand.name.slice(0, 1).toUpperCase()}
    </div>
  );
};

/** modern phone body (rounded, dynamic island, status bar). `w` is the outer width; the screen is w-24 wide. */
export const Phone: React.FC<{ w?: number; dark?: boolean; time?: string; children?: React.ReactNode; screenBg?: string; style?: React.CSSProperties }> = ({ w = 430, dark = true, time = '9:41', children, screenBg, style }) => {
  const h = w * 2.07;
  const bezel = 12;
  const fg = dark ? '#FFFFFF' : '#0B0B0B';
  return (
    <div style={{ position: 'relative', width: w, height: h, borderRadius: w * 0.16, background: '#0D0D0F', boxShadow: '0 40px 90px -30px rgba(0,0,0,0.55), inset 0 0 0 2px #2A2A2E', padding: bezel, boxSizing: 'border-box', ...style }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: w * 0.135, overflow: 'hidden', background: screenBg ?? (dark ? '#000' : '#F2F2F7') }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: w * 0.12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${w * 0.08}px`, color: fg, fontFamily: '-apple-system, Helvetica, sans-serif', fontWeight: 600, fontSize: w * 0.04, zIndex: 5 }}>
          <span>{time}</span>
          <span style={{ letterSpacing: 2 }}>▮▮▮ ◔</span>
        </div>
        <div style={{ position: 'absolute', top: w * 0.025, left: '50%', width: w * 0.3, height: w * 0.075, marginLeft: -w * 0.15, borderRadius: 999, background: '#000', zIndex: 6 }} />
        <div style={{ position: 'absolute', inset: 0, paddingTop: w * 0.12 }}>{children}</div>
      </div>
    </div>
  );
};

/** desktop window chrome: macOS (traffic lights), Windows 11, or a browser with tab + address bar */
export const Window: React.FC<{ kind?: 'mac' | 'win' | 'browser'; w: number; h: number; title?: string; url?: string; dark?: boolean; children?: React.ReactNode; style?: React.CSSProperties }> = ({ kind = 'mac', w, h, title = '', url = '', dark = false, children, style }) => {
  const bar = kind === 'browser' ? 86 : 44;
  const bg = dark ? '#1E1F22' : '#F6F6F7';
  const fg = dark ? '#E8E8EA' : '#1B1B1F';
  const line = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <div data-card="1" style={{ position: 'relative', width: w, height: h, borderRadius: kind === 'win' ? 10 : 14, overflow: 'hidden', background: dark ? '#141517' : '#FFFFFF', boxShadow: '0 40px 90px -40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.12)', fontFamily: '-apple-system, "Segoe UI", Helvetica, sans-serif', ...style }}>
      <div style={{ height: bar, background: bg, borderBottom: `1px solid ${line}`, display: 'flex', flexDirection: 'column', color: fg }}>
        <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
          {kind !== 'win' && ['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
          {kind === 'browser' ? (
            <div style={{ marginLeft: 14, padding: '7px 16px', borderRadius: '10px 10px 0 0', background: dark ? '#2A2B2F' : '#FFFFFF', fontSize: 15, maxWidth: 260, overflow: 'hidden', whiteSpace: 'nowrap' }}>{title}</div>
          ) : (
            <div style={{ flex: 1, textAlign: kind === 'mac' ? 'center' : 'left', fontSize: 15, fontWeight: 600, opacity: 0.8, marginRight: kind === 'mac' ? 60 : 0 }}>{title}</div>
          )}
          {kind === 'win' && (
            <div style={{ display: 'flex', gap: 26, fontSize: 16, opacity: 0.7 }}>
              <span>—</span>
              <span>▢</span>
              <span>✕</span>
            </div>
          )}
        </div>
        {kind === 'browser' && (
          <div style={{ height: 42, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 12 }}>
            <span style={{ opacity: 0.5, fontSize: 16 }}>‹ ›</span>
            <div style={{ flex: 1, height: 30, borderRadius: 15, background: dark ? '#2A2B2F' : '#EFEFF1', display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: 15, opacity: 0.85 }}>{url}</div>
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: bar, bottom: 0, color: fg }}>{children}</div>
    </div>
  );
};

/** mouse cursor at (x, y); `clicks` are frames that trigger a press + ripple */
export const Cursor: React.FC<{ t: number; x: number; y: number; clicks?: number[]; color?: string; scale?: number }> = ({ t, x, y, clicks = [], color = '#111', scale = 1 }) => {
  const last = clicks.filter((c) => t >= c).pop();
  const press = last !== undefined ? Math.max(0, 1 - (t - last) / 6) : 0;
  const ripple = last !== undefined && t - last < 18 ? prog(t, last, last + 18) : -1;
  return (
    <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
      {ripple >= 0 && <div style={{ position: 'absolute', left: -30 * ripple - 6, top: -30 * ripple - 6, width: 12 + 60 * ripple, height: 12 + 60 * ripple, borderRadius: '50%', border: `3px solid ${color}`, opacity: 1 - ripple }} />}
      <svg width={30 * scale} height={40 * scale} viewBox="0 0 30 40" style={{ transform: `scale(${1 - press * 0.12})`, transformOrigin: '0 0', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>
        <path d="M2 2 L2 31 L9.5 24 L14.5 36 L19.5 34 L14.5 22.5 L25 22.5 Z" fill="#FFFFFF" stroke="#111" strokeWidth={2.2} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** a notification banner that springs in at `at` (iOS-like) */
export const Notification: React.FC<{ t: number; at: number; app: string; title: string; body: string; w?: number; icon?: React.ReactNode; dark?: boolean }> = ({ t, at, app, title, body, w = 900, icon, dark = false }) => {
  if (t < at - 2) return null;
  const p = pop(t, at, 5);
  return (
    <div style={{ width: w, borderRadius: 34, padding: '24px 28px', background: dark ? 'rgba(40,40,44,0.92)' : 'rgba(250,250,252,0.94)', boxShadow: '0 30px 60px -30px rgba(0,0,0,0.45)', display: 'flex', gap: 20, alignItems: 'center', transform: `translateY(${((1 - Math.min(1, p)) * -80).toFixed(1)}px) scale(${(0.92 + 0.08 * p).toFixed(3)})`, opacity: Math.min(1, p * 1.5), fontFamily: '-apple-system, Helvetica, sans-serif', color: dark ? '#FFF' : '#111' }}>
      <div style={{ width: 76, height: 76, borderRadius: 18, overflow: 'hidden', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E5E5EA' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 24, opacity: 0.6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{app}</div>
        <div style={{ fontSize: 32, fontWeight: 700, marginTop: 2 }}>{title}</div>
        <div style={{ fontSize: 30, opacity: 0.85, marginTop: 2 }}>{body}</div>
      </div>
    </div>
  );
};
