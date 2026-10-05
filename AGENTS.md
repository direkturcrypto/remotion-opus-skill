# Agent instructions

This repo is a CLI (`node bin/ros.mjs`) that turns a brief + sourced facts into launch videos. If you were asked
to *make a video*, follow `skill/remotion-opus/SKILL.md` — do not write Remotion code.

If you were asked to *change the tool*:
- The spec contract is `src/spec/schema.ts`; keep `prompts/builder.md` (catalog + limits) and `cli/lint.ts` in sync
  with it.
- Engine changes (`src/engine`, `src/widgets`) affect every video. After any change run:
  `npx tsc --noEmit -p .`, `node bin/ros.mjs example`, `node bin/ros.mjs stills mimo-example`, look at
  `projects/mimo-example/review/round-*/sheet-*.jpg`, then `node bin/ros.mjs render mimo-example` and make sure the
  frame-jump scan is clean.
- Never toggle CSS filters on/off per frame, never step a transform in one frame (ease over ≥5 frames), and measure
  text with `fitSize` instead of estimating widths.
- Never commit `.env`, `projects/`, `out/`, `node_modules/`.
