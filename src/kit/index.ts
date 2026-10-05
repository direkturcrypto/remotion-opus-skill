// @kit — what a code-mode scene may import besides react and remotion. Infrastructure + optional helpers.
// Scenes are expected to invent their own components; nothing here is a template.
export { clamp01, outE, inOut, flyE, lin, prog, pop, hitEnv, seeded, kf, typed, type KP } from '../engine/util';
export { useVO, type VO, type Brand, type VoLineInfo } from './vo';
export { Fit, fit, textW, Chars, Caret, Typewriter, Odometer, CountUp, Highlight, Strike } from './text';
export { camAt, project3D, Billboard3D, Particles3D, Floor3D, focusWeight, type Vec3, type Cam3, type CamKey } from './three';
export { useHits, Grain, Burst, Whip, Confetti, type Hit } from './fx';
export { Mark, Phone, Window, Cursor, Notification } from './ui';
export { FONT_NAMES, type FontRequest } from './fonts';

/** frames → seconds helpers */
export const sec = (frames: number, fps = 60) => frames / fps;
export const frames = (seconds: number, fps = 60) => Math.round(seconds * fps);
