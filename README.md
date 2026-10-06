# remotion-opus-skill

**Opus-grade launch videos for agents, at a fraction of the tokens.** An agent like Hermes that builds a Remotion
video by itself reads files, writes thousands of lines and iterates — very expensive. With this CLI the agent runs one
command; the tool makes a few small, structured API calls (creative concept → JSON spec → frame review) and a fixed,
Opus-designed engine does the rest. Output: premium 15-second promo videos, landscape 1920×1080 + portrait 1080×1920
from one timeline. Runs on the [Vikey](https://vikey.ai) OpenAI-compatible API (`https://api.vikey.ai/v1`).

Default models: `anthropic/claude-opus-5.5` for concept, spec and review. Set `BUILDER_MODEL` to
`glm/glm-5.3-flash` or `deepseek/deepseek-v4-flash` to make the spec-writing step cheaper (more lint retries).

```
brief.md + facts.md + history of recent films
      │
      ▼
 ros concept ► director (Opus 5.5) picks engine + path + look + story archetype + angle — different from recent films
      │
      ▼
 ros plan ──► builder model writes spec.json ──► linter (schema, facts, cues, pacing, variety)
      │                                   ▲                              │ errors go back to the builder
      ▼                                   └──────────────────────────────┘
 ros audio ──► ElevenLabs eleven_v4 VO (multi-take, STT-checked) + word timings, music, synthesized SFX
      │
      ▼
 ros review ─► render stills (both aspects) + DOM QA ──► Opus 5.5 looks at the frames ──► JSON verdict
      │              ▲                                                                     │ patches / builder fix
      │              └─────────────────────────────────────────────────────────────────────┘
      ▼
 ros render ─► MP4 × 2 + frame-jump scan
```

## Why the output looks like Opus made it

Cheap models are bad at motion design but fine at filling in a form. So they never write animation code here:

- **The engine is fixed and Opus-designed** (`src/engine`, `src/widgets`): a 2.5D camera that flies through a 3D
  world, arcs around cards instead of punching through them, lens depth-of-field + semantic focus that follows the
  voice-over, kinetic mask-reveal type, slot-roll odometers, eased zoom punches (never single-frame steps), measured
  text fitting (no "text nabrak"), always-on filters (no re-raster pops), captions with word highlight, and
  automatic hits/SFX. Ported from hand-built Vikey launch spots.
- **The builder only writes a JSON spec** (`src/spec/schema.ts`) with tight text limits. A linter rejects invented
  numbers (every on-screen number must be in `facts.md`), cues that aren't spoken, digits in TTS text, CamelCase
  that TTS mangles, over-long VO, reused looks, and copy lifted from the reference.
- **Opus is the art director**: it sees labelled frames from both aspects plus automated QA warnings, and returns
  JSON-Patch fixes. Only frames go to Opus, so a review round costs a few thousand tokens.
- **Three visual languages, not reskins:**
  - `flythrough` — UI cards in a 3D space, continuous dolly with arcs and depth-of-field (paths: dolly, serpentine,
    staircase)
  - `poster` — flat editorial canvas, numbered panels with ink borders + hard shadows, a route line drawn panel to
    panel, 2D whip-pans with directional blur, pull-out to the whole poster before the end card (paths: zigzag, strip)
  - `kinetic` — no cards: giant type on full-bleed colour fields; each scene holds a colour "portal" the camera zooms
    through into the next scene (paths: zoom, turns)
  × six looks (`graphite-studio`, `midnight-glass`, `paper-ink`, `aurora-soft`, `mono-lab`, `ember-noir`)
  × six story archetypes (launch, problem-solution, versus, demo, reasons, one-number).
- **A creative director step** (`ros concept`): Opus reads the brief and the history of recent films and picks a
  combination that is clearly different (it may not repeat the last engine or the last two looks). The builder must
  follow it; the linter enforces it.

## Two modes

| | spec mode (`ros run`) | code mode (`ros code`) |
| --- | --- | --- |
| what the model writes | a JSON spec for fixed engines (flythrough / poster / kinetic) | a bespoke Remotion scene with its own components |
| how | one structured call + lint loop | an agent loop like Claude Code: write files → compile → render frames and look at them → edit → finish |
| variety | 3 engines × 6 looks × 6 archetypes | anything the concept calls for (metaphors, UI remakes, worlds) |
| cost per film (Opus, Vikey) | ≈Rp8–15k | ≈Rp30–35k (agent build ≈Rp15–20k, review + revision ≈Rp12k) |
| reliability | very high | high, reviewed by Opus; quality varies more |

Code mode details:
- `ros code <slug>`: creative director concept (metaphor, world, camera, components, type, palette) → VO script →
  ElevenLabs VO (auto-shortened if it overruns the target) → **scene agent** builds `projects/<slug>/scene/`
  step by step with tools (`timing`, `write_file`, `edit_file`, `check`, `render_frames`, `contact_sheet`,
  `finish`) → Opus art-director review → the same agent session revises → render.
- The agent's session is saved after every step (`projects/<slug>/agent/session.json`, readable `log.md`).
- Budgets: `AGENT_BUDGET_RP` (build, default 30000), `AGENT_REVISE_BUDGET_RP` (15000), `AGENT_STEPS` (16).
- `@kit` (src/kit) is infrastructure + optional helpers; scenes are expected to invent their own components.

## Length

Films are as long as the story needs. Set it with `ros new <slug> --duration 30` or "30 detik" in the brief;
otherwise the creative director picks (`duration_sec` in concept.json). The word budget follows the target
(≈0.46 s per spoken word, measured on eleven_v4 Indonesian).

## Quick start

```bash
git clone https://github.com/direkturcrypto/remotion-opus-skill.git && cd remotion-opus-skill
npm install
node bin/ros.mjs init          # .env + SFX + tool check
$EDITOR .env                   # VIKEY_API_KEY (required), ELEVENLABS_API_KEY (optional, for voice + music)
node bin/ros.mjs doctor

node bin/ros.mjs example                 # reference project (hand-built MiMo-V2.6 Pro spot)
node bin/ros.mjs render mimo-example     # silent render of the reference to check your setup

node bin/ros.mjs new my-launch --brief "…"
$EDITOR projects/my-launch/facts.md      # sourced facts — the only numbers allowed on screen
node bin/ros.mjs run my-launch           # → projects/my-launch/out/my-launch-{landscape,portrait}.mp4
```

`npm link` (or `npx ros`) puts `ros` on your PATH.

## Commands

| command | what it does |
| --- | --- |
| `ros init` / `ros doctor` | setup and health check (keys, models, ffmpeg) |
| `ros new <slug> --brief "…"` | scaffold `projects/<slug>/brief.md` + `facts.md` |
| `ros concept <slug>` | director picks engine / path / look / archetype / angle → `concept.json` |
| `ros plan <slug>` | builder writes `spec.json` from the concept, retrying until the linter passes |
| `ros lint <slug>` | run the linter on a spec you edited |
| `ros audio <slug> [--only m02] [--force]` | VO (ElevenLabs `eleven_v4`, best of 3 takes by STT match) + music + SFX |
| `ros stills <slug>` / `ros verify <slug>` / `ros fix <slug>` | one review step at a time |
| `ros review <slug> [--rounds 3]` | stills → verify → fix until it passes |
| `ros render <slug> [--aspect portrait]` | final MP4s + frame-jump scan |
| `ros run <slug>` | all of the above |
| `ros usage <slug>` | tokens per model |

## Configuration (`.env`)

| key | default | |
| --- | --- | --- |
| `VIKEY_API_KEY` | — | required |
| `VIKEY_BASE_URL` | `https://api.vikey.ai/v1` | any OpenAI-compatible endpoint works |
| `BUILDER_MODEL` | `anthropic/claude-opus-5.5` | cheaper: `glm/glm-5.3-flash`, `deepseek/deepseek-v4-flash` |
| `DIRECTOR_MODEL` | = `VERIFIER_MODEL` | picks the concept |
| `VERIFIER_MODEL` | `anthropic/claude-opus-5.5` | must accept images |
| `MAX_ROUNDS` | `3` | review rounds |
| `ELEVENLABS_API_KEY` | — | voice-over + word timing + music |
| `VOICE_ID` / `TTS_MODEL` | Cahaya / `eleven_v4` | per-spec `vo.voiceId` overrides |
| `VO_TAKES` | `3` | TTS takes per line, best STT match wins |
| `LLM_STREAM` | `1` | stream completions (SSE) with a live progress line; `0` to disable |
| `LLM_MAX_TOKENS` | `64000` | sent explicitly — omitting it lets the gateway apply a small default cap |
| `AGENT_BUDGET_RP` / `AGENT_REVISE_BUDGET_RP` | `30000` / `15000` | code-mode agent stops when its spend reaches this |

## For agents

`skill/remotion-opus/SKILL.md` is a standard agent skill (Hermes / Claude Code / agentskills.io format), listed on
[skills.sh](https://skills.sh/direkturcrypto/remotion-opus-skill/skill/remotion-opus).

```bash
# Hermes
hermes skills install direkturcrypto/remotion-opus-skill/skill/remotion-opus
# Claude Code, Codex, Cursor and other agents (skills.sh)
npx skills add direkturcrypto/remotion-opus-skill
# or copy it by hand
mkdir -p ~/.hermes/skills/creative && cp -r skill/remotion-opus ~/.hermes/skills/creative/
```

Point your agent at Vikey (`base_url https://api.vikey.ai/v1`, any model), give it the repo path, and ask for a
launch video — the skill tells it to gather facts first, run the loop, and read the review reports.

## Layout

```
bin/ros.mjs            CLI launcher (tsx, no build step)
cli/                   pipeline: llm client, linter, audio, render, review loop
prompts/concept.md     the creative director's brief (engines, looks, archetypes, variety rules)
prompts/builder.md     the builder's rules + widget catalog + archetype recipes
prompts/verifier.md    Opus' review rubric and JSON output contract
src/spec/schema.ts     the spec contract (zod) — what a builder may write
src/engines/           FlyThrough, Poster, Kinetic + shared hits/audio/QA
src/kinetic/           typographic renderers for the kinetic engine
src/engine/            flythrough director (layout, camera, arcs, focus), world, timeline, looks, fonts, fit
src/widgets/           hero, stat, vision, code, price, agents, lockup, headline, chat, bars, checklist
examples/mimo-v2.6-pro reference spec + word timings from a hand-built Vikey launch spot
projects/<slug>/       your videos (gitignored)
```

## Honesty rules baked in

On-screen numbers must come from `facts.md`; price beats need fine print naming sources, unit, date and FX basis;
"forever/unlimited/zero refusal"-style claims are rejected unless the facts say so. The verifier checks the
rendered frames against the facts again.

## License

MIT
