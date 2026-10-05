import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// code mode: @scene is the per-film scene (the CLI points it at projects/<slug>/scene.tsx), @kit the helper kit
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), '@scene': `${process.cwd()}/src/code/placeholder.tsx`, '@kit': `${process.cwd()}/src/kit/index.ts` } },
}));
