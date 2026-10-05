import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildTimeline } from '../src/engine/timeline';
import { ARCHETYPE_IDS, ENGINE_IDS, ENGINE_PATHS, LOOK_IDS, Spec, Words } from '../src/spec/schema';
import { installSfx, makeMusic, makeVo } from './audio';
import { cfg } from './env';
import { lintSpec, type Recent } from './lint';
import { askedDuration, budgetLine, targetDuration } from './target';
import { chat, parseJson, type Msg, type Part } from './llm';
import { PROJECTS, ROOT, mustExist, proj } from './paths';
import { media, propsFor, stills, type AspectId } from './render';
import { departure, revealEnd } from '../src/engine/reveals';

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
export type Film = { slug: string; look: string; engine?: string; path?: string; archetype?: string; angle?: string; ts?: string };
const history = (): Film[] => (existsSync(HISTORY) ? JSON.parse(read(HISTORY)) : []);
/** the films made before this one (most recent last) */
export const recentFilms = (slug: string, n = 4) => history().filter((x) => x.slug !== slug).slice(-n);
export const recentFor = (slug: string): Recent => {
  const r = recentFilms(slug);
  return { looks: r.slice(-2).map((x) => x.look), engine: r[r.length - 1]?.engine, archetype: r[r.length - 1]?.archetype };
};
/** kept for callers that only need the looks */
export const recentLooks = (slug: string) => recentFor(slug).looks;
const remember = (slug: string, spec: { look: { preset: string }; engine?: string; path?: string; archetype?: string }, angle?: string) => {
  mkdirSync(PROJECTS, { recursive: true });
  const prev = history().find((x) => x.slug === slug);
  const film: Film = { slug, look: spec.look.preset, engine: spec.engine, path: spec.path, archetype: spec.archetype, angle: angle ?? prev?.angle, ts: new Date().toISOString() };
  writeFileSync(HISTORY, JSON.stringify([...history().filter((x) => x.slug !== slug), film], null, 1));
};
const loadConcept = (slug: string): Concept | null => (existsSync(proj(slug).concept) ? JSON.parse(read(proj(slug).concept)) : null);

const REFERENCE = () => JSON.parse(read(path.join(ROOT, 'examples/mimo-v2.6-pro/spec.json')));
const builderSystem = () => read(path.join(ROOT, 'prompts/builder.md'));

// ---------------------------------------------------------------- plan: builder writes the spec
const lintLoop = async (slug: string, messages: Msg[], tag: string) => {
  const P = proj(slug);
  const facts = read(P.facts);
  const brief = read(P.brief);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { text } = await chat({ model: cfg.builder, messages, json: true, temperature: 0.5, usageFile: P.usage, tag: `${tag}#${attempt}` });
    let raw: Record<string, unknown>;
    try {
      raw = parseJson(text);
    } catch (e) {
      messages.push({ role: 'assistant', content: text.slice(0, 4000) }, { role: 'user', content: `That was not valid JSON (${String(e)}). Return ONLY the full spec JSON object.` });
      continue;
    }
    raw.slug = slug;
    mkdirSync(path.join(P.dir, 'attempts'), { recursive: true });
    writeFileSync(path.join(P.dir, 'attempts', `${tag.replace(/[^a-z0-9#-]/gi, '_')}-${attempt}.json`), JSON.stringify(raw, null, 1));
    const res = lintSpec(raw, { facts, brief, recent: recentFor(slug), concept: loadConcept(slug), reference: REFERENCE(), words: loadWords(slug), durationSec: targetDuration(slug) });
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

// ---------------------------------------------------------------- concept: the creative director picks the film
export type Concept = { engine: string; path: string; look: { preset: string; accent?: [string, string]; hot?: string }; archetype: string; angle: string; hook: string; cta: string; beats: { widget: string; says: string; shows: string }[]; why_different?: string };

const checkConcept = (c: Concept, recent: Recent): string[] => {
  const e: string[] = [];
  if (!(ENGINE_IDS as readonly string[]).includes(c.engine)) e.push(`engine must be one of ${ENGINE_IDS.join(', ')}`);
  else if (!(ENGINE_PATHS[c.engine as (typeof ENGINE_IDS)[number]] as readonly string[]).includes(c.path)) e.push(`path "${c.path}" is not valid for ${c.engine} (use ${ENGINE_PATHS[c.engine as (typeof ENGINE_IDS)[number]].join(' or ')})`);
  if (!(LOOK_IDS as readonly string[]).includes(c.look?.preset)) e.push(`look.preset must be one of ${LOOK_IDS.join(', ')}`);
  if (!(ARCHETYPE_IDS as readonly string[]).includes(c.archetype)) e.push(`archetype must be one of ${ARCHETYPE_IDS.join(', ')}`);
  if (recent.engine && c.engine === recent.engine) e.push(`engine "${c.engine}" was used by the most recent film — pick another`);
  if (recent.looks.includes(c.look?.preset)) e.push(`look "${c.look?.preset}" was used in the last two films — pick another`);
  if (!Array.isArray(c.beats) || c.beats.length < 4) e.push('beats: give 4–8 beats');
  return e;
};

export const concept = async (slug: string) => {
  const P = proj(slug);
  mustExist(P.brief, `create it with \`ros new ${slug}\``);
  const recent = recentFor(slug);
  log(`▸ concept ${slug} with ${cfg.director}`);
  const films = recentFilms(slug);
  const user = [
    `BRIEF:\n${read(P.brief)}`,
    `FACTS:\n${read(P.facts).trim() || '(none)'}`,
    askedDuration(slug) ? `TARGET LENGTH: ${askedDuration(slug)} s (set by the client — use it as duration_sec)` : 'TARGET LENGTH: not set — choose duration_sec for what the story needs',
    `RECENT FILMS (oldest → newest):\n${films.length ? films.map((f) => `- ${f.slug}: engine ${f.engine ?? 'flythrough'}, path ${f.path ?? 'dolly'}, look ${f.look}, archetype ${f.archetype ?? 'launch'}${f.angle ? `, angle "${f.angle}"` : ''}`).join('\n') : '(none — this is the first film)'}`,
    'Return the concept JSON.',
  ].join('\n\n');
  const messages: Msg[] = [{ role: 'system', content: read(path.join(ROOT, 'prompts/concept.md')) }, { role: 'user', content: user }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { text } = await chat({ model: cfg.director, messages, temperature: 0.9, usageFile: P.usage, tag: `concept#${attempt}` });
    let c: Concept;
    try {
      c = parseJson<Concept>(text);
    } catch (e) {
      messages.push({ role: 'assistant', content: text.slice(0, 3000) }, { role: 'user', content: `Not valid JSON (${String(e)}). Return only the concept JSON.` });
      continue;
    }
    const errs = checkConcept(c, recent);
    if (!errs.length) {
      writeFileSync(P.concept, JSON.stringify(c, null, 1));
      log(`  ✓ ${c.engine}/${c.path} · ${c.look.preset} · ${c.archetype} — ${c.angle}`);
      return c;
    }
    log(`  ✗ concept #${attempt}: ${errs.join('; ')}`);
    messages.push({ role: 'assistant', content: JSON.stringify(c) }, { role: 'user', content: `Fix and return the full concept JSON:\n- ${errs.join('\n- ')}` });
  }
  throw new Error('concept: the director could not produce a valid concept');
};

export const plan = async (slug: string) => {
  const P = proj(slug);
  mustExist(P.brief, `create it with \`ros new ${slug}\``);
  const facts = read(P.facts);
  const c = loadConcept(slug) ?? (await concept(slug));
  log(`▸ plan ${slug} with ${cfg.builder}`);
  const user = [
    `BRIEF:\n${read(P.brief)}`,
    `FACTS (the ONLY allowed source of numbers and claims):\n${facts.trim() || '(none — show no numbers except those written in the brief)'}`,
    `CONCEPT (from the creative director — follow engine, path, look, archetype exactly; follow the beat outline, hook and CTA):\n${JSON.stringify(c, null, 1)}`,
    budgetLine(targetDuration(slug)),
    `slug: "${slug}"${cfg.brandName ? `\nDefault brand: name "${cfg.brandName}", url "${cfg.brandUrl}"` : ''}`,
    'Return the spec JSON.',
  ].join('\n\n');
  const spec = await lintLoop(slug, [{ role: 'system', content: builderSystem() }, { role: 'user', content: user }], 'plan');
  writeFileSync(P.spec, JSON.stringify(spec, null, 1));
  remember(slug, spec, c.angle);
  log(`  ✓ spec.json (${spec.beats.length} beats, ${spec.engine}/${spec.path}, look ${spec.look.preset}, ${spec.archetype})`);
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
    // the moment that matters: just after the last reveal lands (the camera may leave or pull out soon after)
    const hold = i + 1 < spec.beats.length ? Math.max(arrive[i] + 18, Math.min(dep - 2, ready + 12)) : Math.max(ready, tl.total - 24);
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
  const { text } = await chat({ model: cfg.verifier, messages: [{ role: 'system', content: read(path.join(ROOT, 'prompts/verifier.md')) }, { role: 'user', content: parts }], temperature: 0.2, usageFile: P.usage, tag: `verify#${round}` });
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
        const res = lintSpec(next, { facts, brief, recent: recentFor(slug), concept: loadConcept(slug), words: loadWords(slug), durationSec: targetDuration(slug) });
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
      `CONCEPT (keep engine, path, look, archetype):\n${JSON.stringify(loadConcept(slug) ?? {})}`,
      budgetLine(targetDuration(slug)),
      `CURRENT SPEC:\n${JSON.stringify(doc)}`,
      `The art director reviewed the rendered frames and requires these fixes:\n${left.map((i) => `- [${i.severity}] ${i.tile ?? ''} ${i.problem} → ${i.fix}`).join('\n')}`,
      'Apply every fix, change nothing else that works, and return the full corrected spec JSON only.',
    ].join('\n\n');
    doc = await lintLoop(slug, [{ role: 'system', content: builderSystem() }, { role: 'user', content: user }], `fix#${round}`);
  }
  const spec = Spec.parse(doc);
  writeFileSync(P.spec, JSON.stringify(spec, null, 1));
  remember(slug, spec);
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
  // values can be in scientific notation (9.2e-06) on static frames — parse the whole token
  for (const m of res.stdout.matchAll(/YAVG=([-\d.eE+]+)/g)) vals.push(Number(m[1]));
  // intended changes (cue hits, counters, odometers, typing, scans) are allowed to spike
  const ranges: [number, number][] = [];
  const cueKeys = ['cutAt', 'goAt', 'logoAt', 'at', 'from', 'to', 'scanFrom', 'scanTo', 'doneAt', 'kickerAt', 'revealAt'];
  const walkCues = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walkCues);
    else if (o && typeof o === 'object')
      for (const [k, v] of Object.entries(o)) {
        if (cueKeys.includes(k) && typeof v === 'string') ranges.push([tl.cue(v) - 4, tl.cue(v) + 22]);
        else walkCues(v);
      }
  };
  walkCues(spec.beats);
  for (const b of spec.beats) {
    const w = b.widget;
    if (w.type === 'stat') ranges.push([tl.cue(w.from) - 4, tl.cue(w.to) + 16]);
    if (w.type === 'price') ranges.push([tl.cue(w.cutAt) - 4, tl.cue(w.cutAt) + 60]);
    if (w.type === 'vision') ranges.push([tl.cue(w.scanFrom) - 4, tl.cue(w.scanTo) + 34]);
    if (w.type === 'code') ranges.push([tl.cue(w.from) - 10, (w.doneAt ? tl.cue(w.doneAt) : tl.cue(w.from) + w.lines.join('').length / 2.2) + 24]);
    if (w.type === 'bars') ranges.push([tl.cue(w.from) - 4, tl.cue(w.from) + 40 + w.items.length * 6]);
    if (w.type === 'chat') w.messages.forEach((m) => ranges.push([tl.cue(m.at) - 20, tl.cue(m.at) + m.text.length / 1.8 + 14]));
    if (w.type === 'hero' && w.id) ranges.push([tl.cue(w.name[0].at) - 8, tl.cue(w.accentWord?.at ?? w.name[w.name.length - 1].at) + 16]);
  }
  const intended = (f: number) => ranges.some(([a, b]) => f >= a && f <= b);
  const spikes: { frame: number; v: number; ratio: number }[] = [];
  for (let i = 3; i < vals.length - 2; i++) {
    const n = (vals[i - 2] + vals[i - 1] + vals[i + 1] + vals[i + 2]) / 4;
    const ratio = n > 0.05 ? vals[i] / n : vals[i] * 20;
    const frame = i + 1;
    if (vals[i] > 1.5 && ratio > 2.4 && !intended(frame)) spikes.push({ frame, v: vals[i], ratio });
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
  const res = lintSpec(JSON.parse(read(P.spec)), { facts: read(P.facts), brief: read(P.brief), recent: { looks: [] }, words: loadWords(slug), durationSec: targetDuration(slug) });
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
  remember(slug, spec);
  return P.dir;
};
