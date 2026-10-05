// Art-direction presets. Each one changes world, card language, type and palette together, so consecutive videos
// don't look like reskins of one template. `ros plan` refuses a preset used in the last 2 projects.
import type { Spec } from '../spec/schema';
import type { FontPairId } from './fonts';

export type Look = {
  id: string;
  dark: boolean; // world is dark
  world: {
    bg: string;
    glow: string;
    glowA: number;
    floor: null | { color: string; alpha: number; dots?: boolean };
    particles: { ink: string; inkA: number; hot: string; hotA: number; n: number };
    text: string;
  };
  card: { bg: string; fg: string; muted: string; line: string; inset: string; insetFg: string; border: string; shadow: string; radius: number; glowA: number };
  lockup: { bg: string; fg: string; border: string; shadow: string; radius: number };
  fonts: FontPairId;
  accent: [string, string];
  hot: string;
  caption: { bg: string; fg: string; hot: string };
};

const PRESETS: Record<string, Look> = {
  'graphite-studio': {
    id: 'graphite-studio',
    dark: false,
    world: {
      bg: 'linear-gradient(180deg, #FBFBF9 0%, #F3F3F0 55%, #E8E8E3 100%)',
      glow: '255,106,28',
      glowA: 0.12,
      floor: { color: '#111214', alpha: 0.13 },
      particles: { ink: '#111214', inkA: 0.2, hot: '#FF4A1C', hotA: 0.55, n: 150 },
      text: '#111214',
    },
    card: { bg: '#141518', fg: '#FFFFFF', muted: '#8C8F97', line: 'rgba(255,255,255,0.09)', inset: '#0B0C0E', insetFg: '#E9EAEC', border: '1.5px solid rgba(255,255,255,0.08)', shadow: '0 60px 90px -40px rgba(17,18,20,0.55), 0 18px 36px -18px rgba(17,18,20,0.4)', radius: 44, glowA: 0.3 },
    lockup: { bg: '#FFFFFF', fg: '#111214', border: '1.5px solid #E6E6E1', shadow: '0 70px 110px -50px rgba(17,18,20,0.45), 0 20px 40px -20px rgba(17,18,20,0.18)', radius: 48 },
    fonts: 'unbounded',
    accent: ['#FF8A1F', '#E7010A'],
    hot: '#FF4A1C',
    caption: { bg: 'rgba(17,18,20,0.9)', fg: '#FFFFFF', hot: '#FF6A3D' },
  },
  'midnight-glass': {
    id: 'midnight-glass',
    dark: true,
    world: {
      bg: 'radial-gradient(120% 90% at 50% 8%, #1A2340 0%, #0A0E1A 55%, #05070D 100%)',
      glow: '91,124,255',
      glowA: 0.2,
      floor: { color: '#7C9BFF', alpha: 0.24 },
      particles: { ink: '#C9D6FF', inkA: 0.22, hot: '#67E8F9', hotA: 0.6, n: 170 },
      text: '#F4F7FF',
    },
    card: { bg: 'linear-gradient(160deg, rgba(44,56,92,0.97) 0%, rgba(16,22,40,0.97) 60%, rgba(10,14,28,0.97) 100%)', fg: '#F4F7FF', muted: '#93A0BF', line: 'rgba(255,255,255,0.10)', inset: 'rgba(4,7,15,0.55)', insetFg: '#E6ECFF', border: '1.5px solid rgba(160,190,255,0.24)', shadow: '0 50px 90px -40px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.12)', radius: 36, glowA: 0.28 },
    lockup: { bg: 'linear-gradient(160deg, rgba(52,66,108,0.98) 0%, rgba(18,24,44,0.98) 100%)', fg: '#F4F7FF', border: '1.5px solid rgba(160,190,255,0.3)', shadow: '0 70px 120px -50px rgba(0,0,0,0.8)', radius: 44 },
    fonts: 'sora',
    accent: ['#22D3EE', '#7C5CFF'],
    hot: '#67E8F9',
    caption: { bg: 'rgba(8,11,22,0.88)', fg: '#FFFFFF', hot: '#67E8F9' },
  },
  'paper-ink': {
    id: 'paper-ink',
    dark: false,
    world: {
      bg: 'linear-gradient(180deg, #F4F0E9 0%, #EBE5DB 100%)',
      glow: '231,1,10',
      glowA: 0.05,
      floor: { color: '#0B0B0B', alpha: 0.28, dots: true },
      particles: { ink: '#0B0B0B', inkA: 0.22, hot: '#E7010A', hotA: 0.5, n: 110 },
      text: '#0B0B0B',
    },
    card: { bg: '#FFFFFF', fg: '#0B0B0B', muted: '#7A746B', line: 'rgba(11,11,11,0.12)', inset: '#F4F1EC', insetFg: '#0B0B0B', border: '4px solid #0B0B0B', shadow: '16px 16px 0 #E7010A', radius: 8, glowA: 0 },
    lockup: { bg: '#FFFFFF', fg: '#0B0B0B', border: '5px solid #0B0B0B', shadow: '18px 18px 0 #0B0B0B', radius: 8 },
    fonts: 'bricolage',
    accent: ['#E7010A', '#FF6A3D'],
    hot: '#E7010A',
    caption: { bg: '#0B0B0B', fg: '#FFFFFF', hot: '#FF6A3D' },
  },
  'aurora-soft': {
    id: 'aurora-soft',
    dark: false,
    world: {
      bg: 'linear-gradient(160deg, #FFE3EC 0%, #F3E8FF 48%, #E0F2FE 100%)',
      glow: '255,122,182',
      glowA: 0.2,
      floor: null,
      particles: { ink: '#7C3AED', inkA: 0.14, hot: '#FF5FA2', hotA: 0.38, n: 120 },
      text: '#1E1B2E',
    },
    card: { bg: 'rgba(255,255,255,0.86)', fg: '#1E1B2E', muted: '#7B7590', line: 'rgba(30,27,46,0.08)', inset: 'rgba(244,240,255,0.95)', insetFg: '#1E1B2E', border: '1.5px solid rgba(255,255,255,0.95)', shadow: '0 40px 80px -30px rgba(124,58,237,0.35), 0 10px 30px -10px rgba(30,27,46,0.12)', radius: 40, glowA: 0.16 },
    lockup: { bg: '#FFFFFF', fg: '#1E1B2E', border: '1.5px solid #FFFFFF', shadow: '0 60px 110px -40px rgba(124,58,237,0.45)', radius: 48 },
    fonts: 'syne',
    accent: ['#FF5FA2', '#7C5CFF'],
    hot: '#7C3AED',
    caption: { bg: 'rgba(30,27,46,0.88)', fg: '#FFFFFF', hot: '#FF8CC6' },
  },
  'mono-lab': {
    id: 'mono-lab',
    dark: false,
    world: {
      bg: 'linear-gradient(180deg, #FFFFFF 0%, #F2F4F8 100%)',
      glow: '37,99,235',
      glowA: 0.08,
      floor: { color: '#2563EB', alpha: 0.18 },
      particles: { ink: '#0F172A', inkA: 0.15, hot: '#2563EB', hotA: 0.45, n: 130 },
      text: '#0F172A',
    },
    card: { bg: '#FFFFFF', fg: '#0F172A', muted: '#64748B', line: 'rgba(15,23,42,0.10)', inset: '#F1F5F9', insetFg: '#0F172A', border: '1.5px solid #0F172A', shadow: '0 30px 60px -30px rgba(15,23,42,0.35)', radius: 18, glowA: 0.0 },
    lockup: { bg: '#0F172A', fg: '#FFFFFF', border: '1.5px solid #0F172A', shadow: '0 50px 90px -40px rgba(15,23,42,0.6)', radius: 22 },
    fonts: 'space',
    accent: ['#2563EB', '#06B6D4'],
    hot: '#2563EB',
    caption: { bg: '#0F172A', fg: '#FFFFFF', hot: '#38BDF8' },
  },
  'ember-noir': {
    id: 'ember-noir',
    dark: true,
    world: {
      bg: 'radial-gradient(110% 80% at 50% 100%, #2A1206 0%, #0B0A09 55%, #060606 100%)',
      glow: '255,106,0',
      glowA: 0.22,
      floor: { color: '#FF7A1A', alpha: 0.22 },
      particles: { ink: '#FFE2C2', inkA: 0.18, hot: '#FFB800', hotA: 0.6, n: 160 },
      text: '#FFF4E8',
    },
    card: { bg: '#121110', fg: '#FFF4E8', muted: '#A08F7E', line: 'rgba(255,200,150,0.10)', inset: '#0A0908', insetFg: '#FFE9D2', border: '1.5px solid rgba(255,140,40,0.28)', shadow: '0 50px 90px -40px rgba(0,0,0,0.85)', radius: 28, glowA: 0.32 },
    lockup: { bg: '#FFF4E8', fg: '#121110', border: '1.5px solid #FFF4E8', shadow: '0 60px 120px -50px rgba(255,106,0,0.45)', radius: 32 },
    fonts: 'archivo',
    accent: ['#FFB800', '#FF3D00'],
    hot: '#FFB800',
    caption: { bg: 'rgba(18,17,16,0.9)', fg: '#FFF4E8', hot: '#FFB800' },
  },
};

export const resolveLook = (l: Spec['look']): Look => {
  const base = PRESETS[l.preset];
  return { ...base, accent: l.accent ?? base.accent, hot: l.hot ?? base.hot };
};

export const grad = (look: Look, deg = 100) => `linear-gradient(${deg}deg, ${look.accent[0]} 0%, ${look.accent[1]} 100%)`;
export const GREEN = '#22C55E';
