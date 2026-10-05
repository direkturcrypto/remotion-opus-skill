// The voice-over is the clock. A scene asks `useVO()` for the frame of any spoken word: `cue('m02:gambar')`.
import React, { createContext, useContext } from 'react';

export type Brand = { name: string; url: string; mark: 'vikey' | 'monogram'; color?: string };
export type VoLineInfo = { id: string; text: string; caption: string; start: number; end: number };
export type VO = {
  fps: number;
  W: number;
  H: number;
  /** portrait (1080×1920) when true, landscape (1920×1080) when false */
  P: boolean;
  aspect: 'landscape' | 'portrait';
  /** total frames of the film (VO + hold) */
  total: number;
  /** frame where a spoken word starts: "m01", "m01:word", "m01:word#2", "m01:word+0.3", "end" */
  cue: (c: string) => number;
  lines: VoLineInfo[];
  line: (id: string) => VoLineInfo;
  brand: Brand;
  /** keep key content inside this box; the bottom band is where captions sit */
  safe: { top: number; bottom: number; left: number; right: number };
};

export const VOContext = createContext<VO | null>(null);
export const useVO = (): VO => {
  const v = useContext(VOContext);
  if (!v) throw new Error('useVO() must be used inside the code-mode wrapper');
  return v;
};
export const VOProvider: React.FC<{ value: VO; children: React.ReactNode }> = ({ value, children }) => <VOContext.Provider value={value}>{children}</VOContext.Provider>;
