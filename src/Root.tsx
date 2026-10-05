import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import exampleSpec from '../examples/mimo-v2.6-pro/spec.json';
import exampleWords from '../examples/mimo-v2.6-pro/words.json';
import { buildTimeline } from './engine/timeline';
import { Spec, Words } from './spec/schema';
import { SpotLandscape, SpotPortrait, type SpotProps } from './Spot';

const defaults: SpotProps = { spec: Spec.parse(exampleSpec), words: Words.parse(exampleWords), hasVo: false, hasMusic: false, sfx: false };

const meta: CalculateMetadataFunction<SpotProps> = ({ props }) => {
  const spec = Spec.parse(props.spec);
  const tl = buildTimeline(spec, props.words ? Words.parse(props.words) : null);
  return { durationInFrames: tl.total, fps: spec.fps, props: { ...props, spec } };
};

export const Root: React.FC = () => (
  <>
    <Composition id="Spot" component={SpotLandscape} width={1920} height={1080} fps={60} durationInFrames={900} defaultProps={defaults} calculateMetadata={meta} />
    <Composition id="SpotPortrait" component={SpotPortrait} width={1080} height={1920} fps={60} durationInFrames={900} defaultProps={defaults} calculateMetadata={meta} />
  </>
);
