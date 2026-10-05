import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths';

for (const f of [path.join(process.cwd(), '.env'), path.join(ROOT, '.env')]) {
  if (existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {
      /* malformed .env — doctor reports missing keys */
    }
  }
}

export const cfg = {
  vikeyKey: process.env.VIKEY_API_KEY ?? '',
  baseUrl: (process.env.VIKEY_BASE_URL ?? 'https://api.vikey.ai/v1').replace(/\/$/, ''),
  builder: process.env.BUILDER_MODEL ?? 'anthropic/claude-opus-5.5',
  director: process.env.DIRECTOR_MODEL ?? process.env.VERIFIER_MODEL ?? 'anthropic/claude-opus-5.5',
  verifier: process.env.VERIFIER_MODEL ?? 'anthropic/claude-opus-5.5',
  elevenKey: process.env.ELEVENLABS_API_KEY ?? '',
  voice: process.env.VOICE_ID ?? 'iWydkXKoiVtvdn4vLKp9',
  ttsModel: process.env.TTS_MODEL ?? 'eleven_v4',
  maxRounds: Number(process.env.MAX_ROUNDS ?? 3),
  concurrency: Number(process.env.RENDER_CONCURRENCY ?? 4),
  brandName: process.env.BRAND_NAME ?? '',
  brandUrl: process.env.BRAND_URL ?? '',
};

export const need = (k: keyof typeof cfg, why: string) => {
  if (!cfg[k]) throw new Error(`${String(k)} is empty — set it in .env (${why})`);
};
