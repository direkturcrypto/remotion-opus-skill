// Default @scene (Studio / before a scene is written): the script's captions as plain kinetic type.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Chars, Fit, useVO } from '../kit';

export const fonts = { 'Inter Tight': ['700'] };
export const background = '#0E0F12';

export default function Scene() {
  const t = useCurrentFrame();
  const { lines, W, P } = useVO();
  const cur = [...lines].reverse().find((l) => t >= l.start - 4) ?? lines[0];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
      <Fit text={cur.caption} font="Inter Tight" weight={700} size={P ? 90 : 110} maxW={W - 160}>
        <Chars text={cur.caption} t={t} at={cur.start} step={1} />
      </Fit>
    </AbsoluteFill>
  );
}
