// Film length: what the human asked for (`ros new --duration`, or "30 detik" in the brief), else the director's pick.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { proj } from './paths';

const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const projectFile = (slug: string) => path.join(proj(slug).dir, 'project.json');

export const setDuration = (slug: string, sec: number) => {
  const cur = existsSync(projectFile(slug)) ? JSON.parse(read(projectFile(slug))) : {};
  writeFileSync(projectFile(slug), JSON.stringify({ ...cur, duration: sec }, null, 1));
};

/** seconds the human asked for, or null if they left it to the director */
export const askedDuration = (slug: string): number | null => {
  const pj = existsSync(projectFile(slug)) ? JSON.parse(read(projectFile(slug))) : {};
  if (pj.duration) return Number(pj.duration);
  const m = /(\d{1,3})\s*(?:detik|seconds?|secs?|dtk|s)\b/i.exec(read(proj(slug).brief));
  return m ? Number(m[1]) : null;
};

/** the length to build for: asked → director's concept → 15 s */
export const targetDuration = (slug: string): number => {
  const asked = askedDuration(slug);
  if (asked) return asked;
  const c = existsSync(proj(slug).concept) ? JSON.parse(read(proj(slug).concept)) : null;
  return Number(c?.duration_sec) || 15;
};

/** the budget line we hand to the writers */
export const budgetLine = (sec: number, hold = 2.2) => {
  // measured on eleven_v4 Indonesian at tempo 1.12: ≈0.47 s per spoken word including the pauses between lines
  const words = Math.round((sec - hold - 0.4) / 0.46);
  const lines = Math.max(3, Math.round(words / 7.5));
  return `TARGET LENGTH: ${sec} s → about ${words} spoken words in about ${lines} VO lines (≤ 10 words each), then a ${hold} s brand hold.`;
};
