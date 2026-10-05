// When is a beat "readable"? Each cue starts an animation that needs time to land (an odometer rolls ~40 frames,
// a pop ~8). Used by the linter (the camera must not leave before the viewer can read it) and by the review frame
// picker (Opus must judge the settled frame, not a mid-roll one).
import type { Beat, Spec } from '../spec/schema';

const SETTLE: Record<string, number> = { cutAt: 46, goAt: 30, to: 16, scanTo: 18, doneAt: 22, from: 10, scanFrom: 10, logoAt: 30, kickerAt: 10, at: 10 };

export const revealEnd = (beat: Beat, cue: (c: string) => number): { frame: number; key: string } => {
  let best = { frame: cue(beat.at), key: 'at' };
  const visit = (o: unknown, key = '') => {
    if (Array.isArray(o)) o.forEach((v) => visit(v, key));
    else if (o && typeof o === 'object')
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string' && k in SETTLE && /^[a-z0-9_]+(:|$)/i.test(v)) {
          let f = cue(v) + SETTLE[k];
          if (k === 'at' && key === 'badge') f = cue(v) + 30;
          if (k === 'at' && key === 'messages') f = cue(v) + 24;
          if (f > best.frame) best = { frame: f, key: `${key ? key + '.' : ''}${k} "${v}"` };
        } else visit(v, k);
      }
  };
  visit(beat.widget);
  if (beat.widget.type === 'bars') best = { frame: Math.max(best.frame, cue(beat.widget.from) + 30 + beat.widget.items.length * 6), key: 'bars.from' };
  if (beat.widget.type === 'chat') {
    for (const m of beat.widget.messages) if (m.from === 'ai') best = { frame: Math.max(best.frame, cue(m.at) + Math.ceil(m.text.length / 1.8) + 12), key: `ai message "${m.text.slice(0, 20)}…"` };
  }
  return best;
};

/** frame the camera starts leaving beat i (or the stacked successor takes over) */
export const departure = (spec: Spec, i: number, cue: (c: string) => number, total: number) => {
  const next = spec.beats[i + 1];
  if (!next) return total;
  const b = spec.beats[i];
  if (next.widget.type === 'lockup' && next.widget.stack) return cue(next.at) - 4;
  const same = !!b.group && b.group === next.group;
  return cue(next.at) + 2 - (same ? 18 : 28);
};
