// Code-mode wrapper: loads the scene's fonts, gives it the VO clock (useVO), and adds captions, audio and the QA
// probe around it. The scene (`@scene` → projects/<slug>/scene.tsx) is bespoke code written per film.
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from 'remotion';
import * as SceneModule from '@scene';
import { ASPECTS } from '../engine/director';
import type { Look } from '../engine/looks';
import { buildTimeline } from '../engine/timeline';
import type { Aspect } from '../engine/types';
import { Captions } from '../engine/world';
import { AudioBed } from '../engines/shared';
import { loadFonts, type FontRequest } from '../kit/fonts';
import { VOProvider, type VO } from '../kit/vo';
import type { Words } from '../spec/schema';
import type { Script } from '../spec/script';

export type CodeProps = { script: Script; words: Words | null; hasVo: boolean; hasMusic: boolean; sfx: boolean; qa?: boolean };

type SceneMod = {
  default: React.FC;
  fonts?: FontRequest;
  background?: string;
  captionStyle?: { bg?: string; fg?: string; hot?: string; font?: string };
  sfx?: (vo: VO) => [number, string, number][];
};
const M = SceneModule as unknown as SceneMod;
const Scene = M.default;

const Inner: React.FC<CodeProps & { aspect: Aspect }> = ({ script, words, hasVo, hasMusic, sfx, qa, aspect }) => {
  const t = useCurrentFrame();
  const A = ASPECTS[aspect];
  const P = aspect === 'portrait';
  const tl = useMemo(() => buildTimeline(script, words), [script, words]);
  const vo: VO = useMemo(() => {
    const lines = script.vo.lines.map((l) => ({ id: l.id, text: l.text, caption: l.caption, start: tl.V[l.id], end: tl.V[l.id] + tl.LEN[l.id] }));
    return {
      fps: script.fps,
      W: A.W,
      H: A.H,
      P,
      aspect,
      total: tl.total,
      cue: tl.cue,
      lines,
      line: (id: string) => lines.find((l) => l.id === id) ?? lines[0],
      brand: script.brand,
      safe: P ? { top: 140, bottom: 1600, left: 60, right: 1020 } : { top: 70, bottom: 940, left: 100, right: 1820 },
    };
  }, [script, tl, A, P, aspect]);
  const list = useMemo(() => {
    try {
      return M.sfx ? M.sfx(vo) : [];
    } catch {
      return [];
    }
  }, [vo]);
  const cs = M.captionStyle ?? {};
  const capLook = { caption: { bg: cs.bg ?? 'rgba(12,12,14,0.88)', fg: cs.fg ?? '#FFFFFF', hot: cs.hot ?? '#FF6A3D' } } as unknown as Look;

  // QA: fitted text that is clipped or runs off the frame; read by `ros stills`
  useLayoutEffect(() => {
    if (!qa) return;
    document.querySelectorAll('[data-fit]').forEach((el) => {
      const h = el as HTMLElement;
      const r = h.getBoundingClientRect();
      const op = Number(getComputedStyle(h).opacity);
      if (op < 0.5 || r.width < 4) return;
      const txt = (h.textContent ?? '').slice(0, 40);
      if (r.left < -2 || r.right > A.W + 2) console.warn(`[ROS-QA] frame ${t} ${aspect}: text "${txt}" runs off the frame`);
      if (h.scrollWidth > h.clientWidth + 2) console.warn(`[ROS-QA] frame ${t} ${aspect}: text "${txt}" is clipped by its box`);
    });
  });

  return (
    <AbsoluteFill style={{ background: M.background ?? '#000', overflow: 'hidden' }}>
      <VOProvider value={vo}>
        <Scene />
      </VOProvider>
      <Captions A={A} tl={tl} look={capLook} ui={cs.font ?? 'Inter, Helvetica, sans-serif'} t={t} />
      {/* AudioBed only reads vo.lines ids from the spec */}
      <AudioBed spec={script as never} tl={tl} total={tl.total} hasVo={hasVo} hasMusic={hasMusic} sfx={sfx} list={list} />
    </AbsoluteFill>
  );
};

const Gate: React.FC<CodeProps & { aspect: Aspect }> = (p) => {
  const [ok, setOk] = useState(false);
  const [handle] = useState(() => delayRender('scene fonts'));
  useEffect(() => {
    loadFonts({ Inter: ['500', '600'], ...(M.fonts ?? {}) }).then(() => {
      setOk(true);
      continueRender(handle);
    });
  }, [handle]);
  return ok ? <Inner {...p} /> : null;
};

export const CodeLandscape: React.FC<CodeProps> = (p) => <Gate {...p} aspect="landscape" />;
export const CodePortrait: React.FC<CodeProps> = (p) => <Gate {...p} aspect="portrait" />;
