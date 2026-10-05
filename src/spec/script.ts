// Code mode: the builder writes only the script (VO + brand + facts). The scene itself is bespoke code.
import { z } from 'zod';
import { VoLine } from './schema';

export const Script = z.object({
  version: z.literal(1),
  mode: z.literal('code'),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().max(80),
  language: z.string().default('id'),
  fps: z.literal(60).default(60),
  holdSec: z.number().min(0.5).max(4).default(2.2),
  brand: z.object({ name: z.string().min(1).max(24), url: z.string().min(1).max(40), mark: z.enum(['vikey', 'monogram']).default('monogram'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }),
  vo: z.object({ voiceId: z.string().optional(), tempo: z.number().min(0.9).max(1.25).default(1.12), lines: z.array(VoLine).min(2).max(30) }),
  facts: z.array(z.object({ text: z.string(), source: z.string() })).default([]),
});
export type Script = z.infer<typeof Script>;
