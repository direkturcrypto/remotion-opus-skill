// The video spec: the ONLY thing a builder model writes. The engine (src/engine, src/widgets) owns every
// motion/layout decision, so a cheap model can't make it look cheap. Text limits here are deliberately tight —
// they are the first guardrail against overflowing cards.
import { z } from 'zod';

// A cue points at a moment in the voice-over:
//   "m01"            start of line m01
//   "m01:baru"       first spoken word in m01 containing "baru" (case/punctuation-insensitive)
//   "m01:baru#2"     second match
//   "m01:baru+0.3"   0.3 s after that word starts (also -0.2)
//   "end"            end of the last VO line
export const Cue = z
  .string()
  .regex(/^(end|[a-z0-9_]+(:[^#+\-\s]+(#\d+)?)?)([+-]\d+(\.\d+)?)?$/i, 'cue must look like "m01", "m01:word", "m01:word#2", "m01:word+0.3" or "end"');
export type Cue = z.infer<typeof Cue>;

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex colour like #E7010A');
const short = (n: number) => z.string().min(1).max(n);

export const LOOK_IDS = ['graphite-studio', 'midnight-glass', 'paper-ink', 'aurora-soft', 'mono-lab', 'ember-noir'] as const;
export const PATH_IDS = ['dolly', 'serpentine', 'staircase'] as const;

const Timed = z.object({ text: short(14), at: Cue, accent: z.boolean().optional() });

export const Hero = z.object({
  type: z.literal('hero'),
  badge: short(14).describe('pill, e.g. "MODEL BARU"'),
  kicker: short(16).optional().describe('provider / category in caps, e.g. "XIAOMI"'),
  kickerAt: Cue.optional(),
  name: z.array(Timed).min(1).max(5).describe('name pieces revealed on cues; total ≤ 12 chars'),
  accentWord: Timed.optional().describe('gradient word after the name, e.g. "Pro"'),
  id: short(30).optional().describe('typed id chip, e.g. "xiaomi/mimo-v2.6-pro"'),
  status: short(32).optional(),
});

export const Stat = z.object({
  type: z.literal('stat'),
  label: short(14),
  chip: short(14).optional(),
  value: z.number().nonnegative(),
  prefix: short(4).optional(),
  suffix: short(6).optional(),
  caption: short(42),
  from: Cue,
  to: Cue,
  chips: z.array(short(12)).max(3).optional().describe('small mono chips that sink into the bar'),
});

export const Vision = z.object({
  type: z.literal('vision'),
  label: short(14),
  chip: short(16).optional(),
  scene: z.enum(['dashboard', 'document']).default('dashboard'),
  scanFrom: Cue,
  scanTo: Cue,
  detect: z.array(short(10)).min(1).max(3),
  result: short(26).optional(),
});

export const Code = z.object({
  type: z.literal('code'),
  label: short(14),
  chip: short(16).optional(),
  lines: z.array(z.string().max(34)).min(4).max(6),
  from: Cue,
  done: short(24).optional(),
  doneAt: Cue.optional(),
});

export const Price = z.object({
  type: z.literal('price'),
  title: short(26),
  idLabel: short(30).optional(),
  officialLabel: short(14),
  oursLabel: short(12),
  rows: z
    .array(
      z.object({
        label: short(10),
        sub: z.string().max(12).optional(),
        official: short(11),
        officialSub: z.string().max(9).optional(),
        ours: short(9),
      }),
    )
    .min(1)
    .max(3),
  cutAt: Cue,
  badge: z.object({ top: short(8), value: short(5), at: Cue, ring: z.number().min(0).max(1).optional() }).optional(),
  finePrint: z.string().max(220),
});

export const Agents = z.object({
  type: z.literal('agents'),
  headline: z.array(Timed).min(1).max(3),
  items: z.array(z.object({ name: short(12), task: short(26) })).min(2).max(4),
  meta: short(28).optional(),
  goAt: Cue,
  effect: z.enum(['whip', 'bolt', 'none']).default('whip'),
});

export const Lockup = z.object({
  type: z.literal('lockup'),
  wordmark: short(16).describe('"vikey.ai" — text after the last dot is accented'),
  chips: z.array(z.object({ text: short(30), style: z.enum(['dark', 'accent']) })).max(2).default([]),
  cta: short(22).optional(),
  finePrint: z.string().max(220).optional(),
  logoAt: Cue,
  stack: z.boolean().default(false).describe('appear in place over the previous beat instead of flying to a new station'),
});

export const Headline = z.object({
  type: z.literal('headline'),
  lines: z.array(z.array(Timed).min(1).max(4)).min(1).max(2),
  sub: z.string().max(48).optional(),
});

export const Chat = z.object({
  type: z.literal('chat'),
  title: short(20),
  messages: z.array(z.object({ from: z.enum(['user', 'ai']), text: z.string().min(1).max(90), at: Cue })).min(1).max(4),
});

export const Bars = z.object({
  type: z.literal('bars'),
  title: short(30),
  unit: z.string().max(8).optional(),
  items: z.array(z.object({ label: short(16), value: z.number(), display: short(10), highlight: z.boolean().optional() })).min(2).max(5),
  from: Cue,
  finePrint: z.string().max(160).optional(),
});

export const Checklist = z.object({
  type: z.literal('checklist'),
  title: short(24),
  items: z.array(z.object({ text: short(34), at: Cue })).min(2).max(5),
});

export const Widget = z.discriminatedUnion('type', [Hero, Stat, Vision, Code, Price, Agents, Lockup, Headline, Chat, Bars, Checklist]);
export type Widget = z.infer<typeof Widget>;

export const Beat = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  at: Cue.describe('the moment the camera must be settled on this beat'),
  group: z.string().optional().describe('consecutive beats with the same group sit side by side at one station'),
  widget: Widget,
  camera: z
    .object({
      zoom: z.number().min(0.6).max(1.6).optional().describe('>1 = further away'),
      open: z.enum(['closeup']).optional().describe('first beat only: start on a close-up of the badge'),
      revealAt: Cue.optional().describe('closeup: when to pull back to the full card'),
      moves: z
        .array(z.object({ at: Cue, zoom: z.number().min(0.8).max(1.1).optional().describe('multiplier on the beat framing: 0.94 = 6% closer'), dx: z.number().min(-300).max(300).optional(), dy: z.number().min(-300).max(300).optional() }))
        .max(3)
        .optional()
        .describe('push-ins on key words (e.g. toward a price badge); 14 frames after the cue'),
    })
    .optional(),
  punches: z.array(Cue).max(4).optional(),
});
export type Beat = z.infer<typeof Beat>;

export const VoLine = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  text: z.string().min(1).max(90).describe('what is SPOKEN, spelled for TTS (numbers as words, "Mimo" not "MiMo")'),
  tts: z.string().max(140).optional().describe('text sent to TTS incl. audio tags like [excited]; defaults to text'),
  caption: z.string().min(1).max(70).describe('what is SHOWN, with proper spelling/digits'),
});

export const Spec = z.object({
  version: z.literal(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().max(80),
  language: z.string().default('id'),
  fps: z.literal(60).default(60),
  holdSec: z.number().min(0.5).max(4).default(2.2),
  brand: z.object({ name: short(24), url: short(40), mark: z.enum(['vikey', 'monogram']).default('monogram'), color: Hex.optional() }),
  look: z.object({ preset: z.enum(LOOK_IDS), accent: z.tuple([Hex, Hex]).optional(), hot: Hex.optional() }),
  path: z.enum(PATH_IDS).default('dolly'),
  vo: z.object({
    voiceId: z.string().optional(),
    tempo: z.number().min(0.9).max(1.25).default(1.1),
    lines: z.array(VoLine).min(1).max(8),
  }),
  beats: z.array(Beat).min(2).max(9),
  facts: z.array(z.object({ text: z.string(), source: z.string() })).default([]),
});
export type Spec = z.infer<typeof Spec>;

// words.json written by `ros vo` (ElevenLabs STT). Without it the engine estimates timings from the text.
export const Words = z.object({
  dur: z.record(z.number()),
  words: z.record(z.array(z.tuple([z.string(), z.number(), z.number()]))),
  text: z.record(z.string()).optional().describe('the spoken text each line was recorded from (stale-check)'),
});
export type Words = z.infer<typeof Words>;
