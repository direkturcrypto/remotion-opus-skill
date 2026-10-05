import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECTS = process.env.ROS_PROJECTS ? path.resolve(process.env.ROS_PROJECTS) : path.join(ROOT, 'projects');
export const ASSETS = path.join(ROOT, 'assets');

export const proj = (slug: string) => {
  const dir = path.join(PROJECTS, slug);
  return {
    dir,
    brief: path.join(dir, 'brief.md'),
    facts: path.join(dir, 'facts.md'),
    spec: path.join(dir, 'spec.json'),
    words: path.join(dir, 'words.json'),
    pub: path.join(dir, 'public'),
    vo: path.join(dir, 'public', 'vo'),
    music: path.join(dir, 'public', 'music.mp3'),
    sfx: path.join(dir, 'public', 'sfx'),
    review: path.join(dir, 'review'),
    out: path.join(dir, 'out'),
    usage: path.join(dir, 'usage.jsonl'),
    log: path.join(dir, 'log.md'),
  };
};

export const mustExist = (p: string, hint: string) => {
  if (!existsSync(p)) throw new Error(`${path.relative(process.cwd(), p)} not found — ${hint}`);
};
