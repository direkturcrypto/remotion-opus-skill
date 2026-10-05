import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LOOK_IDS } from '../src/spec/schema';
import { ensureSfxAssets } from './audio';
import { cfg } from './env';
import { lintSpec } from './lint';
import { ROOT, proj } from './paths';
import { checkScene, codeRender, runCode, writeScene } from './code';
import { setDuration } from './target';
import { concept, exampleProject, fix, latestRound, loadSpec, loadWords, plan, prepareAudio, recentFor, renderFinal, renderStills, run, usageSummary, verify, type Review } from './pipeline';
import type { AspectId } from './render';

const HELP = `ros — Opus-grade Remotion launch videos from cheap models (Vikey API)

  ros init                      create .env, synthesize SFX, check tools
  ros doctor                    check keys, models, ffmpeg
  ros new <slug> [--brief "…"] [--duration 30]   scaffold projects/<slug>/ (length optional: else the director picks)
  ros concept <slug>            director (${cfg.director}) picks engine/look/story, different from recent films
  ros plan <slug>               builder model (${cfg.builder}) writes spec.json from the concept
  ros lint <slug>               validate spec.json (schema + facts + cues + pacing)
  ros audio <slug> [--only m02] voice-over + music (ElevenLabs) + SFX
  ros stills <slug>             render review frames → projects/<slug>/review/round-N/
  ros verify <slug>             verifier (${cfg.verifier}) reviews the latest frames
  ros review <slug> [--rounds 3] stills → verify → fix, until it passes
  ros render <slug> [--aspect landscape|portrait]
  ros run <slug>                everything: plan → audio → review loop → render (spec mode: fixed engines)
  ros code <slug>               CODE MODE: concept → script → audio → Opus writes a bespoke scene → review → render
  ros code-scene|code-check|code-render <slug>   code-mode steps
  ros example                   copy the reference MiMo spec into projects/mimo-example
  ros usage <slug>              token usage per model
`;

const args = process.argv.slice(2);
const cmd = args[0];
const slug = args[1] && !args[1].startsWith('--') ? args[1] : '';
const flag = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] ?? 'true' : undefined;
};
const needSlug = () => {
  if (!slug) throw new Error(`usage: ros ${cmd} <slug>`);
  return slug;
};


const main = async () => {
  switch (cmd) {
    case 'init': {
      const env = path.join(ROOT, '.env');
      if (!existsSync(env)) {
        copyFileSync(path.join(ROOT, '.env.example'), env);
        console.log('✓ created .env — put your VIKEY_API_KEY in it');
      } else console.log('• .env exists');
      console.log(`✓ SFX ready in ${path.relative(process.cwd(), ensureSfxAssets())}`);
      for (const bin of ['ffmpeg', 'ffprobe']) {
        try {
          execFileSync(bin, ['-version'], { stdio: 'ignore' });
          console.log(`✓ ${bin}`);
        } catch {
          console.log(`✗ ${bin} not found — install it (brew install ffmpeg / apt install ffmpeg)`);
        }
      }
      return;
    }
    case 'doctor': {
      console.log(`node ${process.version}`);
      console.log(`VIKEY_BASE_URL ${cfg.baseUrl}`);
      console.log(`VIKEY_API_KEY ${cfg.vikeyKey ? 'set' : 'MISSING'}`);
      console.log(`ELEVENLABS_API_KEY ${cfg.elevenKey ? 'set' : 'not set (videos render without voice-over/music)'}`);
      if (cfg.vikeyKey) {
        const r = await fetch(`${cfg.baseUrl}/models`, { headers: { Authorization: `Bearer ${cfg.vikeyKey}` } });
        const d = (await r.json()) as { data?: { id: string }[] };
        const ids = new Set((d.data ?? []).map((m) => m.id));
        for (const [role, m] of [['builder', cfg.builder], ['verifier', cfg.verifier]]) console.log(`${role} ${m}: ${ids.has(m) ? '✓ available' : '✗ not in /models'}`);
      }
      return;
    }
    case 'new': {
      const s = needSlug();
      if (!/^[a-z0-9-]+$/.test(s)) throw new Error('slug: lowercase letters, digits and dashes only');
      const P = proj(s);
      mkdirSync(P.dir, { recursive: true });
      if (!existsSync(P.brief)) writeFileSync(P.brief, `${flag('brief') ?? '<what is launching, who it is for, the one message, the CTA, language (id/en)>'}\n\nBrand: ${cfg.brandName || '<name>'} (${cfg.brandUrl || '<url>'})\nLength: optional — \"<N> detik\" (or ros new --duration N); leave it out and the director picks\nFormat: landscape + portrait\n`);
      if (!existsSync(P.facts)) writeFileSync(P.facts, '# Facts (every number on screen must appear here, with its source and date)\n\n- <fact> — source: <url>, read <date>\n');
      if (flag('duration')) setDuration(s, Number(flag('duration')));
      console.log(`✓ ${path.relative(process.cwd(), P.dir)}/brief.md + facts.md — fill them in, then \`ros run ${s}\` (or \`ros code ${s}\`)${flag('duration') ? ` · target ${flag('duration')} s` : ' · length: director decides (or --duration N)'}`);
      return;
    }
    case 'concept':
      await concept(needSlug());
      return;
    case 'plan':
      await plan(needSlug());
      return;
    case 'lint': {
      const P = proj(needSlug());
      const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
      const conceptPath = P.concept;
      const res = lintSpec(JSON.parse(read(P.spec)), { facts: read(P.facts), brief: read(P.brief), recent: recentFor(slug), concept: existsSync(conceptPath) ? JSON.parse(read(conceptPath)) : null, words: loadWords(slug) });
      res.errors.forEach((e) => console.log(`✗ ${e}`));
      res.warnings.forEach((w) => console.log(`⚠ ${w}`));
      if (!res.errors.length) console.log('✓ spec is valid');
      process.exitCode = res.errors.length ? 1 : 0;
      return;
    }
    case 'audio':
      await prepareAudio(needSlug(), { forceVo: flag('force') !== undefined, only: flag('only')?.split(',') });
      return;
    case 'stills': {
      const r = await renderStills(needSlug(), latestRound(slug) + 1);
      console.log(`✓ ${r.tiles.length} tiles in ${path.relative(process.cwd(), r.dir)}${r.qa.length ? `\nQA:\n- ${r.qa.join('\n- ')}` : ''}`);
      return;
    }
    case 'verify': {
      const n = latestRound(needSlug());
      if (!n) throw new Error('run `ros stills` first');
      const { tiles, qa } = JSON.parse(readFileSync(path.join(proj(slug).review, `round-${n}`, 'tiles.json'), 'utf8'));
      await verify(slug, n, tiles, qa);
      return;
    }
    case 'fix': {
      const n = latestRound(needSlug());
      const rv: Review = JSON.parse(readFileSync(path.join(proj(slug).review, `round-${n}`, 'review.json'), 'utf8'));
      await fix(slug, n, rv);
      return;
    }
    case 'review': {
      const rounds = Number(flag('rounds') ?? cfg.maxRounds);
      await run(needSlug(), { rounds, skipRender: true });
      return;
    }
    case 'render': {
      const a = flag('aspect') as AspectId | undefined;
      await renderFinal(needSlug(), a ? [a] : undefined);
      return;
    }
    case 'run':
      if (flag('mode') === 'code') await runCode(needSlug(), { rounds: flag('rounds') ? Number(flag('rounds')) : undefined });
      else await run(needSlug(), { rounds: flag('rounds') ? Number(flag('rounds')) : undefined });
      return;
    case 'code':
      await runCode(needSlug(), { rounds: flag('rounds') ? Number(flag('rounds')) : undefined, skipRender: flag('no-render') !== undefined });
      return;
    case 'code-scene':
      await writeScene(needSlug());
      return;
    case 'code-check': {
      const e = checkScene(needSlug());
      e.forEach((x) => console.log(`✗ ${x}`));
      if (!e.length) console.log('✓ scene passes the checks');
      return;
    }
    case 'code-render':
      await codeRender(needSlug(), flag('aspect') ? [flag('aspect') as AspectId] : undefined);
      return;
    case 'example':
      console.log(`✓ ${exampleProject(slug || 'mimo-example')} — try \`ros render ${slug || 'mimo-example'}\``);
      return;
    case 'usage':
      console.log(usageSummary(needSlug()) || 'no usage logged yet');
      return;
    case 'looks':
      console.log(LOOK_IDS.join('\n'));
      return;
    case 'spec':
      console.log(JSON.stringify(loadSpec(needSlug()), null, 1));
      return;
    default:
      console.log(HELP);
  }
};

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
