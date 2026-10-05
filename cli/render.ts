// Rendering via @remotion/renderer: bundle once per command, then stills / media for both aspects.
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Spec, Words } from '../src/spec/schema';
import type { SpotProps } from '../src/Spot';
import { ROOT } from './paths';

export type AspectId = 'landscape' | 'portrait';
export const COMP: Record<AspectId, string> = { landscape: 'Spot', portrait: 'SpotPortrait' };

const bundles = new Map<string, Promise<string>>();
export const getBundle = (publicDir: string) => {
  if (!bundles.has(publicDir)) bundles.set(publicDir, bundle({ entryPoint: path.join(ROOT, 'src/index.ts'), publicDir, onProgress: () => undefined }));
  return bundles.get(publicDir)!;
};

export const propsFor = (spec: Spec, words: Words | null, publicDir: string, qa = false): SpotProps => {
  const voDir = path.join(publicDir, 'vo');
  const hasVo = existsSync(voDir) && spec.vo.lines.every((l) => existsSync(path.join(voDir, `${l.id}.mp3`)));
  const sfxDir = path.join(publicDir, 'sfx');
  const sfx = existsSync(sfxDir) && readdirSync(sfxDir).some((f) => f.endsWith('.wav'));
  return { spec, words, hasVo, hasMusic: existsSync(path.join(publicDir, 'music.mp3')), sfx, qa };
};

export const stills = async (opts: { publicDir: string; props: SpotProps; aspect: AspectId; frames: number[]; outDir: string; prefix: string }) => {
  const serveUrl = await getBundle(opts.publicDir);
  const composition = await selectComposition({ serveUrl, id: COMP[opts.aspect], inputProps: opts.props });
  mkdirSync(opts.outDir, { recursive: true });
  const qa: string[] = [];
  const files: string[] = [];
  for (const frame of opts.frames) {
    const f = Math.max(0, Math.min(composition.durationInFrames - 1, Math.round(frame)));
    const output = path.join(opts.outDir, `${opts.prefix}-${String(f).padStart(4, '0')}.jpg`);
    await renderStill({
      serveUrl,
      composition,
      inputProps: opts.props,
      frame: f,
      output,
      imageFormat: 'jpeg',
      jpegQuality: 88,
      onBrowserLog: (log) => {
        if (log.text.includes('[ROS-QA]')) qa.push(log.text.replace(/^.*\[ROS-QA\]\s*/, ''));
      },
    });
    files.push(output);
  }
  return { files, qa: [...new Set(qa)], durationInFrames: composition.durationInFrames };
};

export const media = async (opts: { publicDir: string; props: SpotProps; aspect: AspectId; output: string; concurrency?: number; onProgress?: (p: number) => void }) => {
  const serveUrl = await getBundle(opts.publicDir);
  const composition = await selectComposition({ serveUrl, id: COMP[opts.aspect], inputProps: opts.props });
  mkdirSync(path.dirname(opts.output), { recursive: true });
  await renderMedia({
    serveUrl,
    composition,
    inputProps: opts.props,
    codec: 'h264',
    outputLocation: opts.output,
    concurrency: opts.concurrency ?? 4,
    onProgress: ({ progress }) => opts.onProgress?.(progress),
  });
  return { durationInFrames: composition.durationInFrames };
};
