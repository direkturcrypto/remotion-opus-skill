// Price comparison: official price gets slashed on the "cut" cue, our price slot-rolls in, a savings badge stamps.
import React from 'react';
import type { z } from 'zod';
import { Easing } from 'remotion';
import { Card, Head, Mark, Odo } from '../engine/atoms';
import { fitSize } from '../engine/fit';
import type { Ctx, WidgetOut } from '../engine/types';
import { clamp01, pop, prog } from '../engine/util';
import type { Price } from '../spec/schema';

export const price = (w: z.infer<typeof Price>, ctx: Ctx): WidgetOut => {
  const P = ctx.P;
  const [cw, ch] = P ? [960, 1100] : [1440, 800];
  const pad = 56;
  const L = ctx.look;
  const f = ctx.f;
  const cut = ctx.cue(w.cutAt);
  const bAt = w.badge ? ctx.cue(w.badge.at) : null;
  const ring = w.badge?.ring ?? (w.badge ? Math.min(1, (Number((/\d+/.exec(w.badge.value) ?? ['50'])[0]) || 50) / 100) : 0);
  const ghost = L.card.line;
  // landscape columns: label | official | ours  (+ badge on the right)
  const colL = 240;
  const colO = 340;
  const oursMaxW = P ? 600 : 470;
  const oursSize = Math.min(...w.rows.map((r) => fitSize(r.ours, f.disp, f.dispWeight, P ? 112 : 88, oursMaxW, f.dispTrack)));
  const offSize = Math.min(...w.rows.map((r) => fitSize(r.official, f.disp, 500, P ? 46 : 44, P ? 380 : colO - 20, -0.03)));
  const badgeR = P ? 128 : 130;
  const rowH = w.rows.length > 2 ? 150 : 196;

  const node = (t: number) => {
    const cutP = prog(t, cut - 2, cut + 8, Easing.bezier(0.5, 0, 0.2, 1));
    const struck = clamp01((t - cut) / 6);
    const stamp = bAt !== null ? pop(t, bAt - 3, 4) : 0;
    const ringP = bAt !== null ? prog(t, bAt, bAt + 30) : 0;
    const off = (s: string, u: string | undefined, stack: boolean) => (
      <div style={{ display: 'inline-flex', flexDirection: stack ? 'column' : 'row', alignItems: stack ? 'flex-start' : 'baseline', gap: stack ? 8 : 16, opacity: 1 - struck * 0.5 }}>
        <span style={{ position: 'relative', fontFamily: f.disp, fontWeight: 500, fontSize: offSize, letterSpacing: '-0.03em', color: struck > 0.5 ? L.card.muted : L.card.fg, whiteSpace: 'nowrap' }}>
          {s}
          <span style={{ position: 'absolute', left: -6, right: -6, top: '50%', height: 5, borderRadius: 3, background: ctx.spec.brand.color ?? '#E7010A', transform: `scaleX(${cutP.toFixed(3)})`, transformOrigin: 'left center' }} />
        </span>
        {u && <span style={{ fontFamily: f.mono, fontSize: stack ? 20 : 19, color: L.card.muted, whiteSpace: 'nowrap' }}>{u}</span>}
      </div>
    );
    const oursHead = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Mark ctx={ctx} size={P ? 36 : 34} id={`mkC${P ? 'p' : 'l'}`} />
        <span style={{ fontFamily: f.mono, fontWeight: 600, fontSize: 22, letterSpacing: '0.18em', color: L.card.fg }}>{w.oursLabel}</span>
      </div>
    );
    const offHead = <span style={{ fontFamily: f.mono, fontWeight: 500, fontSize: 22, letterSpacing: '0.18em', color: L.card.muted, whiteSpace: 'nowrap' }}>{w.officialLabel}</span>;
    return (
      <Card ctx={ctx} w={cw} h={ch} pad={pad} glow={1.2}>
        <Head ctx={ctx} icon="tag" label={w.title} right={w.idLabel ? <span style={{ fontFamily: f.mono, fontSize: P ? 20 : 22, color: L.card.muted }}>{P ? w.idLabel.split('/').pop() : w.idLabel}</span> : undefined} size={22} />
        {P ? (
          <div style={{ marginTop: 34 }}>
            {w.rows.map((r, i) => (
              <div key={r.label} style={{ paddingTop: i ? 34 : 18, paddingBottom: 34, borderTop: i ? `1.5px solid ${L.card.line}` : undefined }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <span style={{ fontFamily: f.ui, fontWeight: 600, fontSize: 40 }}>{r.label}</span>
                  {r.sub ? <span style={{ fontFamily: f.mono, fontSize: 20, color: L.card.muted }}>{r.sub}</span> : null}
                </div>
                <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
                  {offHead}
                  {off(r.official, r.officialSub, false)}
                </div>
                <div style={{ marginTop: 20 }}>{oursHead}</div>
                <div style={{ marginTop: 6, fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: oursSize, letterSpacing: `${f.dispTrack}em` }}>
                  <Odo text={r.ours} t={t} at={cut + 2 + i * 6} color={L.hot} ghost={ghost} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', height: 50 }}>
              <div style={{ width: colL }} />
              <div style={{ width: colO }}>{offHead}</div>
              <div>{oursHead}</div>
            </div>
            {w.rows.map((r, i) => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', height: rowH, borderTop: `1.5px solid ${L.card.line}`, marginTop: i ? 0 : 14 }}>
                <div style={{ width: colL }}>
                  <div style={{ fontFamily: f.ui, fontWeight: 600, fontSize: 44 }}>{r.label}</div>
                  {r.sub ? <div style={{ fontFamily: f.mono, fontSize: 20, color: L.card.muted, marginTop: 6 }}>{r.sub}</div> : null}
                </div>
                <div style={{ width: colO }}>{off(r.official, r.officialSub, true)}</div>
                <div style={{ fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: oursSize, letterSpacing: `${f.dispTrack}em`, whiteSpace: 'nowrap' }}>
                  <Odo text={r.ours} t={t} at={cut + 2 + i * 6} color={L.hot} ghost={ghost} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontFamily: f.mono, fontSize: P ? 20 : 18, lineHeight: 1.5, color: L.card.muted, maxWidth: P ? cw - pad * 2 : 1040 }}>{w.finePrint}</div>
        {w.badge && bAt !== null && (
          <div style={{ position: 'absolute', left: P ? 640 : 1085, top: P ? (w.rows.length > 1 ? 330 : 250) : 150 + (w.rows.length * rowH) / 2 - badgeR, width: badgeR * 2, height: badgeR * 2, transform: `rotate(${(-10 + (1 - stamp) * 30).toFixed(2)}deg) scale(${stamp.toFixed(3)})`, opacity: t >= bAt - 3 ? 1 : 0 }}>
            <svg width={badgeR * 2} height={badgeR * 2} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              <defs>
                <linearGradient id={`bdg${P ? 'p' : 'l'}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={L.accent[0]} />
                  <stop offset="1" stopColor={L.accent[1]} />
                </linearGradient>
              </defs>
              <circle cx={badgeR} cy={badgeR} r={badgeR} fill={`url(#bdg${P ? 'p' : 'l'})`} />
              <circle cx={badgeR} cy={badgeR} r={badgeR - 16} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={8} />
              <circle cx={badgeR} cy={badgeR} r={badgeR - 16} fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(2 * Math.PI * (badgeR - 16) * ring * ringP).toFixed(1)} 2000`} transform={`rotate(-90 ${badgeR} ${badgeR})`} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
              <div style={{ fontFamily: f.mono, fontWeight: 600, fontSize: 22, letterSpacing: '0.24em', marginBottom: 4 }}>{w.badge.top}</div>
              <div style={{ fontFamily: f.disp, fontWeight: f.dispWeight, fontSize: fitSize(w.badge.value, f.disp, f.dispWeight, 56, badgeR * 1.6, f.dispTrack), letterSpacing: `${f.dispTrack}em`, lineHeight: 1 }}>{w.badge.value}</div>
            </div>
          </div>
        )}
      </Card>
    );
  };
  return {
    layers: [{ key: 'card', dx: 0, dy: 0, w: cw, h: ch, node }],
    hits: [
      { at: cut, kind: 'flashBrand' },
      { at: cut, kind: 'shake' },
      { at: cut, kind: 'punch' },
      ...(bAt !== null ? [{ at: bAt, kind: 'shake' as const }, { at: bAt, kind: 'punch' as const }] : []),
    ],
    sfx: [[cut - 3, 'slash', 0.6], [cut + 3, 'roll', 0.5], ...(bAt !== null ? ([[bAt - 4, 'stamp', 0.6]] as [number, string, number][]) : [])],
  };
};
