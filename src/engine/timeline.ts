// Voice-over is the clock. Line starts come from measured audio durations (words.json from `ros vo`); every visual
// event is a cue into a spoken word, so a re-take only shifts things, it never breaks them.
import type { Words } from '../spec/schema';

export type Timeline = {
  fps: number;
  V: Record<string, number>; // line start frame
  LEN: Record<string, number>; // line length in frames
  total: number;
  lastEnd: number;
  cue: (c: string) => number;
  voActive: (t: number) => boolean;
  captions: { id: string; start: number; end: number; words: { text: string; at: number }[] }[];
  warnings: string[];
};

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');

/** without STT: spread words over an estimated duration (≈0.34 s/word for id/en at tempo 1.1) */
export type TLInput = { fps: number; holdSec: number; vo: { lines: { id: string; text: string; caption: string }[] } };

export const estimateWords = (spec: TLInput): Words => {
  const dur: Record<string, number> = {};
  const words: Record<string, [string, number, number][]> = {};
  for (const l of spec.vo.lines) {
    const toks = l.text.split(/\s+/).filter(Boolean);
    const d = Math.max(1.2, toks.length * 0.42 + 0.5);
    const chars = toks.reduce((a, w) => a + w.length + 1, 0);
    let acc = 0;
    words[l.id] = toks.map((w) => {
      const s = 0.12 + (acc / chars) * (d - 0.35);
      acc += w.length + 1;
      const e = 0.12 + (acc / chars) * (d - 0.35);
      return [w, Math.round(s * 100) / 100, Math.round(e * 100) / 100];
    });
    dur[l.id] = d;
  }
  return { dur, words };
};

export const buildTimeline = (spec: TLInput, w: Words | null): Timeline => {
  const fps = spec.fps;
  const words = w ?? estimateWords(spec);
  const warnings: string[] = [];
  const ids = spec.vo.lines.map((l) => l.id);
  const V: Record<string, number> = {};
  const LEN: Record<string, number> = {};
  let at = 12;
  ids.forEach((id, i) => {
    V[id] = at;
    LEN[id] = Math.round((words.dur[id] ?? 2) * fps);
    // a breath before the last line (usually the CTA) lets the previous beat land
    at += LEN[id] + (i === ids.length - 2 ? 14 : 3);
  });
  const lastId = ids[ids.length - 1];
  const lastEnd = V[lastId] + LEN[lastId];
  const total = Math.round(lastEnd + spec.holdSec * fps);

  const spoken = (id: string) => spec.vo.lines.find((l) => l.id === id)?.text ?? '';

  const spokenToks = (id: string) => spoken(id).split(/\s+/).map(norm).filter(Boolean);
  const alignCache = new Map<string, number[]>();
  /** start time (s) of every spoken token, anchored on tokens STT heard the same way */
  const align = (id: string): number[] => {
    if (alignCache.has(id)) return alignCache.get(id)!;
    const sp = spokenToks(id);
    const st = words.words[id] ?? [];
    const stn = st.map(([w]) => norm(w));
    const same = (a: string, b: string) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));
    const anchors: [number, number][] = [];
    let j0 = 0;
    sp.forEach((tk, i) => {
      for (let j = j0; j < Math.min(st.length, j0 + 4); j++)
        if (same(tk, stn[j])) {
          anchors.push([i, j]);
          j0 = j + 1;
          return;
        }
    });
    const lineEnd = (words.dur[id] ?? 2) - 0.2;
    const out = sp.map((_, i) => {
      const hit = anchors.find(([a]) => a === i);
      if (hit) return st[hit[1]][1];
      const prev = [...anchors].reverse().find(([a]) => a < i);
      const next = anchors.find(([a]) => a > i);
      const i0 = prev ? prev[0] : -1;
      const i1 = next ? next[0] : sp.length;
      // the unmatched STT tokens between the two anchors carry these spoken tokens
      const jA = prev ? prev[1] + 1 : 0;
      const t0 = jA < st.length && (!next || jA < next[1]) ? st[jA][1] : prev ? st[prev[1]][2] : 0.1;
      const t1 = next ? st[next[1]][1] : lineEnd;
      return t0 + ((i - i0 - 1) / Math.max(1, i1 - i0 - 1)) * Math.max(0, t1 - t0);
    });
    alignCache.set(id, out);
    return out;
  };

  const cue = (c: string): number => {
    const m = /^([^:+\-]+)(?::([^#+\-]+)(?:#(\d+))?)?([+-]\d+(?:\.\d+)?)?$/.exec(c.trim());
    if (!m) {
      warnings.push(`bad cue "${c}"`);
      return 0;
    }
    const [, id, word, nth, off] = m;
    const offF = off ? Math.round(Number(off) * fps) : 0;
    if (id === 'end') return lastEnd + offF;
    if (V[id] === undefined) {
      warnings.push(`cue "${c}": no VO line "${id}"`);
      return offF;
    }
    if (!word) return V[id] + offF;
    const want = norm(word);
    // cues name SPOKEN words; the alignment maps them onto STT timing even when STT wrote "54" for "lima puluh empat"
    const toks = spokenToks(id);
    const exact = toks.map((tk, i) => [tk, i] as const).filter(([tk]) => tk === want);
    const pre = toks.map((tk, i) => [tk, i] as const).filter(([tk]) => tk.startsWith(want));
    const sub = toks.map((tk, i) => [tk, i] as const).filter(([tk]) => tk.includes(want));
    const k = Math.max(0, Number(nth ?? 1) - 1);
    const hits = exact.length > k ? exact : pre.length > k ? pre : sub;
    if (hits[k]) return V[id] + Math.round(align(id)[hits[k][1]] * fps) + offF;
    warnings.push(`cue "${c}": word not found in line ${id}`);
    return V[id] + offF;
  };

  const captions = spec.vo.lines.map((l, i) => {
    const capWords = l.caption.split(/\s+/).filter(Boolean);
    const stt = words.words[l.id] ?? [];
    const sttN = stt.map(([s]) => norm(s));
    const totalChars = l.caption.length;
    let ci = 0;
    let si = 0;
    const out = capWords.map((cw) => {
      const frac = ci / Math.max(1, totalChars);
      ci += cw.length + 1;
      const n = norm(cw);
      // exact-ish match within the next few STT tokens
      for (let k = si; k < Math.min(stt.length, si + 4); k++) {
        if (n && (sttN[k] === n || sttN[k].startsWith(n) || n.startsWith(sttN[k]))) {
          si = k + 1;
          return { text: cw, at: V[l.id] + Math.round(stt[k][1] * fps) };
        }
      }
      return { text: cw, at: V[l.id] + Math.round(frac * LEN[l.id] * 0.9) };
    });
    // keep monotonic
    for (let k = 1; k < out.length; k++) out[k].at = Math.max(out[k].at, out[k - 1].at + 2);
    const next = spec.vo.lines[i + 1];
    return { id: l.id, start: V[l.id] - 4, end: next ? V[next.id] - 4 : V[l.id] + LEN[l.id] + 16, words: out };
  });

  return {
    fps,
    V,
    LEN,
    total,
    lastEnd,
    cue,
    voActive: (t) => ids.some((id) => t >= V[id] && t < V[id] + LEN[id]),
    captions,
    warnings,
  };
};
