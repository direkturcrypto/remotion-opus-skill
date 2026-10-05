import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import exampleSpec from '../examples/mimo-v2.6-pro/spec.json';
import exampleWords from '../examples/mimo-v2.6-pro/words.json';
import { buildTimeline } from './engine/timeline';
import { Spec, Words } from './spec/schema';
import { SpotLandscape, SpotPortrait, type SpotProps } from './Spot';
import { CodeLandscape, CodePortrait, type CodeProps } from './code/CodeSpot';
import { Script } from './spec/script';

const defaults: SpotProps = { spec: Spec.parse(exampleSpec), words: Words.parse(exampleWords), hasVo: false, hasMusic: false, sfx: false };

const meta: CalculateMetadataFunction<SpotProps> = ({ props }) => {
  const spec = Spec.parse(props.spec);
  const tl = buildTimeline(spec, props.words ? Words.parse(props.words) : null);
  return { durationInFrames: tl.total, fps: spec.fps, props: { ...props, spec } };
};

const exampleScript = Script.parse({ ...exampleSpec, mode: 'code', beats: undefined, look: undefined, engine: undefined, archetype: undefined, path: undefined });
const codeDefaults: CodeProps = { script: exampleScript, words: Words.parse(exampleWords), hasVo: false, hasMusic: false, sfx: false };
const codeMeta: CalculateMetadataFunction<CodeProps> = ({ props }) => {
  const script = Script.parse(props.script);
  const tl = buildTimeline(script, props.words ? Words.parse(props.words) : null);
  return { durationInFrames: tl.total, fps: script.fps, props: { ...props, script } };
};

export const Root: React.FC = () => (
  <>
    <Composition id="CodeSpot" component={CodeLandscape} width={1920} height={1080} fps={60} durationInFrames={900} defaultProps={codeDefaults} calculateMetadata={codeMeta} />
    <Composition id="CodeSpotPortrait" component={CodePortrait} width={1080} height={1920} fps={60} durationInFrames={900} defaultProps={codeDefaults} calculateMetadata={codeMeta} />
    <Composition id="Spot" component={SpotLandscape} width={1920} height={1080} fps={60} durationInFrames={900} defaultProps={defaults} calculateMetadata={meta} />
    <Composition id="SpotPortrait" component={SpotPortrait} width={1080} height={1920} fps={60} durationInFrames={900} defaultProps={defaults} calculateMetadata={meta} />
  </>
);
