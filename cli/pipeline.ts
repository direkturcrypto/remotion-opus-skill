import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildTimeline } from '../src/engine/timeline';
import { Spec, Words } from '../src/spec/schema';
import { installSfx, makeMusic, makeVo } from './audio';
import { cfg } from './env';
import { lintSpec } from './lint';
import { chat, parseJson, type Msg, type Part } from './llm';
import { PROJECTS, ROOT, mustExist, proj } from './paths';
import { media, propsFor, stills, type AspectId } from './render';
import { departure, revealEnd } from './reveals';

const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const log = (s: string) => console.log(s);

// ---------------------------------------------------------------- project state
export const loadSpec = (slug: string) => {
  const P = proj(slug);
  mustExist(P.spec, `run \`ros plan ${slug}\` first`);
  return Spec.parse(JSON.parse(read(P.spec)));
};
export const loadWords = (slug: string) => {
  const P = proj(slug);
  return existsSync(P.words) ? Words.parse(JSON.parse(read(P.words))) : null;
};
const HISTORY = path.join(PROJECTS, '.history.json');
export const recentLooks = (slug: string) => {
  const h: { slug: string; look: string }[] = existsSync(HISTORY) ? JSON.parse(read(HISTORY)) : [];
  return h.filter((x) => x.slug !== slug).slice(-2).map((x) => x.look);
};
const remember = (slug: string, look: string) => {
  const h: { slug: string; look: string; ts: string }[] = existsSync(HISTORY) ? JSON.parse(read(HISTORY)) : [];
  mkdirSync(PROJECTS, { recursive: true });
  writeFileSync(HISTORY, JSON.stringify([...h.filter((x) => x.slug !== slug), { slug, look, ts: new Date().toISOString() }], null, 1));
};

const REFERENCE = () => JSON.parse(read(path.join(ROOT, 'examples/mimo-v2.6-pro/spec.json')));
const builderSystem = () => read(path.join(ROOT, 'prompts/builder.md')).replace('{{EXAMPLE}}', JSON.stringify(JSON.parse(read(path.join(ROOT, 'examples/mimo-v2.6-pro/spec.json')))));

// ---------------------------------------------------------------- plan: builder writes the spec
const lintLoop = async (slug: string, messages: Msg[], tag: string) => {
  const P = proj(slug);
  const facts = read(P.facts);
  const brief = read(P.brief);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { text } = await chat({ model: cfg.builder, messages, json: true, maxTokens: 16000, temperature: 0.5, usageFile: P.usage, tag: `${tag}#${attempt}` });
    let raw: Record<string, unknown>;
    try {
      raw = parseJson(text);
    } catch (e) {
      messages.push({ role: 'assistant', content: text.slice(0, 4000) }, { role: 'user', content: `That was not valid JSON (${String(e)}). Return ONLY the full spec JSON object.` });
      continue;
    }
    raw.slug = slug;
    const res = lintSpec(raw, { facts, brief, recentLooks: recentLooks(slug), reference: REFERENCE(), words: loadWords(slug) });
    if (!res.errors.length && res.spec) {
      res.warnings.forEach((w) => log(`  ⚠ ${w}`));
      return res.spec;
    }
    log(`  ✗ lint (${tag} #${attempt}): ${res.errors.length} error(s)`);
    res.errors.slice(0, 6).forEach((e) => log(`     - ${e}`));
    messages.push({ role: 'assistant', content: JSON.stringify(raw) }, { role: 'user', content: `The linter rejected the spec. Fix EVERY item and return the full corrected spec JSON only:\n- ${res.errors.join('\n- ')}` });
  }
  throw new Error(`${tag}: builder could not produce a valid spec after 5 attempts`);
};

export const plan = async (slug: string) => {
  const P = proj(slug);
  mustExist(P.brief, `create it with \`ros new ${slug}\``);
  const facts = read(P.facts);
  const recent = recentLooks(slug);
  log(`▸ plan ${slug} with ${cfg.builder}`);
  const user = [
    `BRIEF:\n${read(P.brief)}`,
    `FACTS (the ONLY allowed source of numbers and claims):\n${facts.trim() || '(none — show no numbers except those written in the brief)'}`,
    `RECENT LOOKS (do NOT use): ${recent.join(', ') || '(none)'}`,
    `slug: "${slug}"${cfg.brandName ? `\nDefault brand: name "${cfg.brandName}", url "${cfg.brandUrl}"` : ''}`,
    'Return the spec JSON.',
  ].join('\n\n');
  const spec = await lintLoop(slug, [{ role: 'system', content: builderSystem() }, { role: 'user', content: user }], 'plan');
  writeFileSync(P.spec, JSON.stringify(spec, null, 1));
  remember(slug, spec.look.preset);
  log(`  ✓ spec.json (${spec.beats.length} beats, look ${spec.look.preset}, path ${spec.path})`);
  return spec;
};

// ---------------------------------------------------------------- stills
export const latestRound = (slug: string) => {
  const dir = proj(slug).review;
  let n = 0;
  while (existsSync(path.join(dir, `round-${n + 1}`))) n++;
  return n;
};
type Tile = { id: string; aspect: AspectId; frame: number; beat: string; kind: 'open' | 'hold' | 'flight'; file: string };

export const pickFrames = (spec: Spec, words: Words | null) => {
  const tl = buildTimeline(spec, words);
  const arrive = spec.beats.map((b) => tl.cue(b.at) + 2);
  const out: { frame: number; beat: string; kind: Tile['kind'] }[] = [{ frame: 4, beat: spec.beats[0].id, kind: 'open' }];
  spec.beats.forEach((b, i) => {
    // judge the settled frame: after the last reveal has landed, before the camera leaves
    const dep = departure(spec, i, tl.cue, tl.total);
    const ready = revealEnd(b, tl.cue).frame;
    const hold = i + 1 < spec.beats.length ? Math.max(arrive[i] + 18, Math.min(dep - 2, Math.max(ready, dep - 30))) : Math.max(ready, tl.total - 24);
    out.push({ frame: hold, beat: b.id, kind: 'hold' });
    const prev = spec.beats[i - 1];
    const forward = prev && !(b.group && prev.group === b.group) && !(b.widget.type === 'lockup' && b.widget.stack);
    if (forward) out.push({ frame: arrive[i] - 14, beat: b.id, kind: 'flight' });
  });
  return out.sort((a, b) => a.frame - b.frame);
};

export const renderStills = async (slug: string, round: number) => {
  const P = proj(slug);
  const spec = loadSpec(slug);
  const words = loadWords(slug);
  const props = propsFor(spec, words, P.pub, true);
  const frames = pickFrames(spec, words);
  const dir = path.join(P.review, `round-${round}`);
  const tiles: Tile[] = [];
  const qa: string[] = [];
  for (const aspect of ['landscape', 'portrait'] as AspectId[]) {
    const fr = aspect === 'portrait' ? frames.filter((f) => f.kind !== 'flight') : frames;
    log(`  rendering ${fr.length} ${aspect} stills…`);
    const r = await stills({ publicDir: P.pub, props, aspect, frames: fr.map((f) => f.frame), outDir: dir, prefix: aspect === 'landscape' ? 'L' : 'P' });
    r.files.forEach((file, i) => tiles.push({ id: `${aspect === 'landscape' ? 'L' : 'P'}${i + 1}`, aspect, frame: fr[i].frame, beat: fr[i].beat, kind: fr[i].kind, file }));
    qa.push(...r.qa);
  }
  // contact sheets for humans
  for (const [pre, cols, w] of [['L', 3, 640], ['P', 5, 300]] as const) {
    const files = tiles.filter((t) => t.id.startsWith(pre)).map((t) => t.file);
    if (!files.length) continue;
    const list = path.join(dir, `${pre}.txt`);
    writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=${w}:-2,tile=${cols}x${Math.ceil(files.length / cols)}:padding=6:color=white`, '-frames:v', '1', path.join(dir, `sheet-${pre}.jpg`)]);
  }
  writeFileSync(path.join(dir, 'tiles.json'), JSON.stringify({ tiles, qa }, null, 1));
  return { tiles, qa, dir };
};

// ---------------------------------------------------------------- verify: Opus looks at the frames
export type Review = { score: number; pass: boolean; summary: string; issues: { tile?: string; severity: 'high' | 'med' | 'low'; problem: string; fix: string; patch?: { op: string; path: string; value?: unknown }[] }[] };

export const verify = async (slug: string, round: number, tiles: Tile[], qa: string[]): Promise<Review> => {
  const P = proj(slug);
  const spec = loadSpec(slug);
  const tl = buildTimeline(spec, loadWords(slug));
  log(`▸ verify round ${round} with ${cfg.verifier} (${tiles.length} tiles)`);
  const caps = tl.captions.map((c) => `${c.id} @${c.start}-${c.end}f: "${spec.vo.lines.find((l) => l.id === c.id)?.caption}"`).join('\n');
  const parts: Part[] = [
    {
      type: 'text',
      text: [
        `FACTS:\n${read(P.facts) || '(none)'}`,
        `SPEC:\n${JSON.stringify(spec)}`,
        `CAPTIONS (60 fps):\n${caps}`,
        `AUTOMATED QA WARNINGS:\n${qa.length ? qa.map((q) => `- ${q}`).join('\n') : '(none)'}`,
        `TILES:\n${tiles.map((t) => `${t.id}: ${t.aspect} frame ${t.frame} (${(t.frame / 60).toFixed(2)} s), beat "${t.beat}", ${t.kind}`).join('\n')}`,
      ].join('\n\n'),
    },
  ];
  for (const t of tiles) {
    const small = `${t.file}.send.jpg`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', t.file, '-vf', t.aspect === 'landscape' ? 'scale=1280:-2' : 'scale=720:-2', '-q:v', '4', small]);
    parts.push({ type: 'text', text: `${t.id} — ${t.aspect} ${t.kind}, beat "${t.beat}", frame ${t.frame}` });
    parts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${readFileSync(small).toString('base64')}` } });
  }
  const { text } = await chat({ model: cfg.verifier, messages: [{ role: 'system', content: read(path.join(ROOT, 'prompts/verifier.md')) }, { role: 'user', content: parts }], maxTokens: 12000, temperature: 0.2, usageFile: P.usage, tag: `verify#${round}` });
  const rv = parseJson<Review>(text);
  rv.issues = rv.issues ?? [];
  const dir = path.join(P.review, `round-${round}`);
  writeFileSync(path.join(dir, 'review.json'), JSON.stringify(rv, null, 1));
  writeFileSync(path.join(dir, 'review.md'), `# Round ${round} — score ${rv.score}/10 ${rv.pass ? '✅ pass' : '❌'}\n\n${rv.summary}\n\n${rv.issues.map((i) => `- **${i.severity}** ${i.tile ?? ''}: ${i.problem}\n  - fix: ${i.fix}`).join('\n')}\n`);
  log(`  score ${rv.score}/10 ${rv.pass ? 'PASS' : 'needs work'} — ${rv.summary}`);
  rv.issues.forEach((i) => log(`   [${i.severity}] ${i.tile ?? ''} ${i.problem}`));
  return rv;
};

// ---------------------------------------------------------------- fix: apply patches, else ask the builder
const applyPatch = (doc: unknown, ops: { op: string; path: string; value?: unknown }[]) => {
  const root = structuredClone(doc) as Record<string, unknown>;
  for (const op of ops) {
    const keys = op.path.split('/').slice(1).map((k) => k.replace(/~1/g, '/').replace(/~0/g, '~'));
    const last = keys.pop()!;
    let cur: unknown = root;
    for (const k of keys) {
      cur = (cur as Record<string, unknown>)[Array.isArray(cur) ? Number(k) : k];
      if (cur === undefined || cur === null) throw new Error(`path ${op.path} not found`);
    }
    if (Array.isArray(cur)) {
      const i = last === '-' ? cur.length : Number(last);
      if (op.op === 'remove') cur.splice(i, 1);
      else if (op.op === 'add') cur.splice(i, 0, op.value);
      else if (op.op === 'replace') cur[i] = op.value;
      else throw new Error(`unsupported op ${op.op}`);
    } else {
      const o = cur as Record<string, unknown>;
      if (op.op === 'remove') delete o[last];
      else if (op.op === 'add' || op.op === 'replace') o[last] = op.value;
      else throw new Error(`unsupported op ${op.op}`);
    }
  }
  return root;
};

export const fix = async (slug: string, round: number, rv: Review) => {
  const P = proj(slug);
  const facts = read(P.facts);
  const brief = read(P.brief);
  let doc: unknown = JSON.parse(read(P.spec));
  writeFileSync(path.join(P.review, `round-${round}`, 'spec.before.json'), JSON.stringify(doc, null, 1));
  const left: Review['issues'] = [];
  for (const issue of rv.issues) {
    if (issue.severity === 'low' && !issue.patch?.length) continue;
    if (issue.patch?.length) {
      try {
        const next = applyPatch(doc, issue.patch);
        const res = lintSpec(next, { facts, brief, recentLooks: recentLooks(slug), words: loadWords(slug) });
        if (!res.errors.length) {
          doc = next;
          log(`  ✓ patched: ${issue.problem.slice(0, 80)}`);
          continue;
        }
      } catch {
        /* fall through to the builder */
      }
    }
    if (issue.severity !== 'low') left.push(issue);
  }
  if (left.length) {
    log(`▸ builder revises ${left.length} issue(s) with ${cfg.builder}`);
    const user = [
      `BRIEF:\n${brief}`,
      `FACTS (the ONLY allowed source of numbers and claims):\n${facts || '(none)'}`,
      `RECENT LOOKS (do NOT use): ${recentLooks(slug).join(', ') || '(none)'}`,
      `CURRENT SPEC:\n${JSON.stringify(doc)}`,
      `The art director reviewed the rendered frames and requires these fixes:\n${left.map((i) => `- [${i.severity}] ${i.tile ?? ''} ${i.problem} → ${i.fix}`).join('\n')}`,
      'Apply every fix, change nothing else that works, and return the full corrected spec JSON only.',
    ].join('\n\n');
    doc = await lintLoop(slug, [{ role: 'system', content: builderSystem() }, { role: 'user', content: user }], `fix#${round}`);
  }
  const spec = Spec.parse(doc);
  writeFileSync(P.spec, JSON.stringify(spec, null, 1));
  remember(slug, spec.look.preset);
  return spec;
};

// ---------------------------------------------------------------- audio + render
export const prepareAudio = async (slug: string, opts: { forceVo?: boolean; only?: string[] } = {}) => {
  const P = proj(slug);
  const spec = loadSpec(slug);
  installSfx(P.sfx);
  if (!cfg.elevenKey) {
    log('  (no ELEVENLABS_API_KEY — rendering without voice-over/music; timings are estimated)');
    return;
  }
  const missing = spec.vo.lines.some((l) => !existsSync(path.join(P.vo, `${l.id}.mp3`)));
  if (missing || opts.forceVo || opts.only?.length) {
    log(`▸ voice-over (${cfg.ttsModel})`);
    const sus = await makeVo(spec, P.vo, P.words, opts.only ?? []);
    sus.forEach((s) => log(`  ⚠ ${s}`));
  }
  if (!existsSync(P.music)) {
    log('▸ music bed');
    const tl = buildTimeline(spec, loadWords(slug));
    await makeMusic(spec, P.music, tl.total / spec.fps + 1);
  }
};

export const diffScan = (file: string, aspect: AspectId, spec: Spec, words: Words | null) => {
  const tl = buildTimeline(spec, words);
  const crop = aspect === 'landscape' ? 'crop=1920:900:0:0' : 'crop=1080:1600:0:0';
  const res = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `${crop},scale=480:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`, '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const vals: number[] = [];
  for (const m of res.stdout.matchAll(/YAVG=([\d.]+)/g)) vals.push(Number(m[1]));
  // intended hits (cuts, whips, logo slams, flashes) are allowed to spike
  const intended: number[] = [];
  const walkCues = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walkCues);
    else if (o && typeof o === 'object')
      for (const [k, v] of Object.entries(o)) {
        if (['cutAt', 'goAt', 'logoAt', 'at', 'from', 'to', 'scanFrom', 'scanTo', 'doneAt', 'kickerAt', 'revealAt'].includes(k) && typeof v === 'string') intended.push(tl.cue(v), tl.cue(v) + 10, tl.cue(v) + 20);
        else walkCues(v);
      }
  };
  walkCues(spec.beats);
  const spikes: { frame: number; v: number; ratio: number }[] = [];
  for (let i = 3; i < vals.length - 2; i++) {
    const n = (vals[i - 2] + vals[i - 1] + vals[i + 1] + vals[i + 2]) / 4;
    const ratio = n > 0.05 ? vals[i] / n : vals[i] * 20;
    const frame = i + 1;
    if (vals[i] > 1.5 && ratio > 2.4 && !intended.some((c) => Math.abs(c - frame) <= 4)) spikes.push({ frame, v: vals[i], ratio });
  }
  return spikes;
};

export const renderFinal = async (slug: string, aspects: AspectId[] = ['landscape', 'portrait']) => {
  const P = proj(slug);
  const spec = loadSpec(slug);
  const words = loadWords(slug);
  const props = propsFor(spec, words, P.pub, false);
  const outs: string[] = [];
  for (const aspect of aspects) {
    const output = path.join(P.out, `${slug}-${aspect}.mp4`);
    log(`▸ render ${aspect} → ${path.relative(process.cwd(), output)}`);
    let last = -1;
    await media({ publicDir: P.pub, props, aspect, output, concurrency: cfg.concurrency, onProgress: (p) => {
      const pct = Math.floor(p * 10) * 10;
      if (pct !== last) {
        last = pct;
        process.stdout.write(`  ${pct}%${pct === 100 ? '\n' : ''}`);
      }
    } });
    const spikes = diffScan(output, aspect, spec, words);
    if (spikes.length) log(`  ⚠ ${spikes.length} unexpected frame jump(s): ${spikes.slice(0, 6).map((s) => `f${s.frame}`).join(', ')} — inspect those frames`);
    else log('  ✓ no unexpected frame jumps');
    outs.push(output);
  }
  return outs;
};

export const usageSummary = (slug: string) => {
  const P = proj(slug);
  if (!existsSync(P.usage)) return '';
  const by: Record<string, { calls: number; in: number; out: number }> = {};
  for (const line of read(P.usage).trim().split('\n')) {
    const u = JSON.parse(line);
    by[u.model] ??= { calls: 0, in: 0, out: 0 };
    by[u.model].calls++;
    by[u.model].in += u.prompt_tokens ?? 0;
    by[u.model].out += u.completion_tokens ?? 0;
  }
  return Object.entries(by).map(([m, v]) => `  ${m}: ${v.calls} calls, ${v.in.toLocaleString()} in / ${v.out.toLocaleString()} out tokens`).join('\n');
};

export const run = async (slug: string, opts: { rounds?: number; skipRender?: boolean } = {}) => {
  const P = proj(slug);
  if (!existsSync(P.spec)) await plan(slug);
  const res = lintSpec(JSON.parse(read(P.spec)), { facts: read(P.facts), brief: read(P.brief), recentLooks: [], words: loadWords(slug) });
  if (res.errors.length) throw new Error(`spec.json has lint errors:\n- ${res.errors.join('\n- ')}`);
  await prepareAudio(slug);
  const rounds = opts.rounds ?? cfg.maxRounds;
  let last: Review | null = null;
  const first = latestRound(slug) + 1; // keep earlier rounds for comparison
  for (let r = first; r < first + rounds; r++) {
    log(`▸ review round ${r} (${r - first + 1}/${rounds})`);
    const { tiles, qa } = await renderStills(slug, r);
    last = await verify(slug, r, tiles, qa);
    if (last.pass || r === first + rounds - 1) break; // never ship a fix nobody looked at
    const before = JSON.stringify(loadSpec(slug).vo.lines);
    await fix(slug, r, last);
    if (cfg.elevenKey && JSON.stringify(loadSpec(slug).vo.lines) !== before) await prepareAudio(slug, { forceVo: true });
  }
  const outs = opts.skipRender ? [] : await renderFinal(slug);
  log(`\n✓ ${slug}: final review ${last ? `${last.score}/10 ${last.pass ? 'pass' : '(not passed — remaining issues below; see review/)'}` : 'skipped'}`);
  if (last && !last.pass) last.issues.filter((i) => i.severity !== 'low').forEach((i) => log(`  [${i.severity}] ${i.tile ?? ''} ${i.problem}`));
  outs.forEach((o) => log(`  ${o}`));
  log(usageSummary(slug));
  return { review: last, outs };
};

export const exampleProject = (slug = 'mimo-example') => {
  const P = proj(slug);
  mkdirSync(P.dir, { recursive: true });
  const src = path.join(ROOT, 'examples/mimo-v2.6-pro');
  for (const f of readdirSync(src)) copyFileSync(path.join(src, f), path.join(P.dir, f));
  const spec = JSON.parse(read(P.spec));
  spec.slug = slug;
  writeFileSync(P.spec, JSON.stringify(spec, null, 1));
  remember(slug, spec.look.preset);
  return P.dir;
};
