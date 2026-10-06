// Code mode: the director invents a concept, the builder writes the VO script, the coder (Opus) writes a bespoke
// Remotion scene with its own components, and the scene is compiled, rendered, reviewed and revised until it passes.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { buildTimeline, norm } from '../src/engine/timeline';
import { Words } from '../src/spec/schema';
import { Script } from '../src/spec/script';
import { installSfx, makeMusic, makeVo } from './audio';
import { cfg } from './env';
import { factNumbers, numTokens } from './lint';
import { askedDuration, budgetLine, targetDuration } from './target';
import { chat, parseJson, type Msg, type Part } from './llm';
import { runAgent, type AgentTool } from './agent';
import { requireBalance } from './balance';
import { PROJECTS, ROOT, mustExist, proj } from './paths';
import { diffScan, latestRound, recentFilms, type Film, type Review } from './pipeline';
import { forgetBundle, media, stills, type AspectId } from './render';
import type { CodeProps } from '../src/code/CodeSpot';

const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const log = (s: string) => console.log(s);
const files = (slug: string) => {
  const P = proj(slug);
  const sceneDir = path.join(P.dir, 'scene');
  return { ...P, script: path.join(P.dir, 'script.json'), sceneDir, scene: path.join(sceneDir, 'index.tsx'), concept: path.join(P.dir, 'concept.json'), agent: path.join(P.dir, 'agent') };
};
const HISTORY = path.join(PROJECTS, '.history.json');
const rememberCode = (slug: string, c: CodeConcept) => {
  const h: Film[] = existsSync(HISTORY) ? JSON.parse(read(HISTORY)) : [];
  const film: Film & { metaphor?: string; world?: string } = { slug, look: 'code', engine: 'code', angle: c.angle, ts: new Date().toISOString(), metaphor: c.metaphor, world: c.world };
  mkdirSync(PROJECTS, { recursive: true });
  writeFileSync(HISTORY, JSON.stringify([...h.filter((x) => x.slug !== slug), film], null, 1));
};

export type CodeConcept = { title: string; angle: string; metaphor: string; world: string; camera: string; components: string[]; typography: { display: string; text: string; mono?: string | null }; palette: Record<string, string>; beats: { says: string; shows: string }[]; hook: string; cta: string; why_different?: string };

const promptFile = (name: string) => read(path.join(ROOT, 'prompts', name));
// the full kit source goes into the system prompt (cached after the first call), so the agent never spends a costly
// step reading it
const kitSource = () =>
  ['index.ts', 'vo.tsx', 'text.tsx', 'three.tsx', 'fx.tsx', 'ui.tsx']
    .map((f) => `--- kit/${f} ---\n${read(path.join(ROOT, 'src/kit', f))}`)
    .join('\n\n');
const agentSystem = () => promptFile('agent.md').replace('{{KIT}}', `${promptFile('kit.md')}\n\n# KIT SOURCE (complete — no need to read these files)\n${kitSource()}`).replace('{{STYLES}}', promptFile('styles.md'));

// ---------------------------------------------------------------- concept
export const codeConcept = async (slug: string) => {
  const F = files(slug);
  mustExist(F.brief, `create it with \`ros new ${slug}\``);
  const films = recentFilms(slug) as (Film & { metaphor?: string; world?: string })[];
  log(`▸ concept (code mode) with ${cfg.director}`);
  const user = [
    `BRIEF:\n${read(F.brief)}`,
    `FACTS:\n${read(F.facts).trim() || '(none)'}`,
    askedDuration(slug) ? `TARGET LENGTH: ${askedDuration(slug)} s (set by the client — use it as duration_sec)` : 'TARGET LENGTH: not set — choose duration_sec for what the story needs',
    `RECENT FILMS (oldest → newest):\n${films.length ? films.map((f) => `- ${f.slug}: ${f.engine === 'code' ? `metaphor "${f.metaphor}", world "${f.world}"` : `engine ${f.engine ?? 'flythrough'}, look ${f.look}`}${f.angle ? `, angle "${f.angle}"` : ''}`).join('\n') : '(none)'}`,
    'Return the concept JSON.',
  ].join('\n\n');
  const refs = refImages(slug);
  const userContent = refs.length ? [{ type: 'text' as const, text: user }, ...refs.flatMap((r) => [{ type: 'text' as const, text: r.label }, { type: 'image_url' as const, image_url: { url: `data:image/${r.file.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(r.file).toString('base64')}` } }])] : user;
  const { text } = await chat({ model: cfg.director, messages: [{ role: 'system', content: promptFile('concept-code.md').replace('{{STYLES}}', promptFile('styles.md')) }, { role: 'user', content: userContent }], temperature: 1, usageFile: F.usage, tag: 'code-concept' });
  const c = parseJson<CodeConcept>(text);
  writeFileSync(F.concept, JSON.stringify(c, null, 1));
  rememberCode(slug, c);
  log(`  ✓ "${c.title}" — ${c.metaphor}`);
  return c;
};

// ---------------------------------------------------------------- script (VO)
export const lintScript = (raw: unknown, facts: string, brief: string, durationSec = 15) => {
  const errors: string[] = [];
  const r = Script.safeParse(raw);
  if (!r.success) return { errors: r.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`), script: null };
  const s = r.data;
  const known = factNumbers(`${facts}\n${brief}`);
  let words = 0;
  s.vo.lines.forEach((l, i) => {
    const n = l.text.split(/\s+/).filter(Boolean).length;
    words += n;
    if (n > 10) errors.push(`vo.lines[${i}].text has ${n} words — max 10`);
    if (/\d/.test(l.text)) errors.push(`vo.lines[${i}].text contains digits — spell numbers as words`);
    const camel = l.text.split(/\s+/).filter((w) => /[a-z][A-Z]/.test(w));
    if (camel.length) errors.push(`vo.lines[${i}].text has CamelCase (${camel.join(', ')}) — write as it sounds`);
    const toks = l.text.split(/\s+/);
    toks.forEach((tok, k) => {
      if (norm(tok) === norm(s.brand.name) && k < toks.length - 1 && !/[.!?,]$/.test(tok)) errors.push(`vo.lines[${i}]: put "${s.brand.name}" at the end of the line`);
    });
    for (const num of numTokens(l.caption)) if (num.length > 1 && !known.has(num)) errors.push(`vo.lines[${i}].caption shows ${num}, which is not in the facts`);
  });
  const goal = Math.round((durationSec - s.holdSec - 0.4) / 0.46);
  if (words > goal * 1.18 + 2) errors.push(`${words} spoken words — too long for ${durationSec} s (aim ≈${goal})`);
  if (words < goal * 0.6) errors.push(`${words} spoken words — too short for ${durationSec} s (aim ≈${goal})`);
  const all = JSON.stringify(s).toLowerCase();
  for (const bad of ['selamanya', 'forever', 'lifetime', 'unlimited', 'tanpa batas', 'zero refusal']) if (all.includes(bad) && !`${facts}${brief}`.toLowerCase().includes(bad)) errors.push(`"${bad}" is not supported by the facts`);
  return { errors, script: errors.length ? null : s };
};

export const codeScript = async (slug: string, feedback?: string) => {
  const F = files(slug);
  const c: CodeConcept = JSON.parse(read(F.concept));
  log(`▸ script with ${cfg.builder}`);
  const messages: Msg[] = [
    { role: 'system', content: promptFile('script.md') },
    { role: 'user', content: `BRIEF:\n${read(F.brief)}\n\nFACTS:\n${read(F.facts)}\n\nCONCEPT:\n${JSON.stringify(c, null, 1)}\n\n${budgetLine(targetDuration(slug))}${feedback ? `\n\n${feedback}` : ''}\n\nslug: "${slug}". Return the script JSON.` },
  ];
  for (let a = 1; a <= 4; a++) {
    const { text } = await chat({ model: cfg.builder, messages, json: true, usageFile: F.usage, tag: `script#${a}` });
    const raw = parseJson<Record<string, unknown>>(text);
    raw.slug = slug;
    raw.mode = 'code';
    const { errors, script } = lintScript(raw, read(F.facts), read(F.brief), targetDuration(slug));
    if (script) {
      writeFileSync(F.script, JSON.stringify(script, null, 1));
      script.vo.lines.forEach((l) => log(`  ${l.id}: ${l.caption}`));
      return script;
    }
    log(`  ✗ script #${a}: ${errors.slice(0, 4).join('; ')}`);
    messages.push({ role: 'assistant', content: JSON.stringify(raw) }, { role: 'user', content: `Fix every item and return the full JSON:\n- ${errors.join('\n- ')}` });
  }
  throw new Error('script: could not produce a valid VO script');
};

const loadScript = (slug: string) => Script.parse(JSON.parse(read(files(slug).script)));
const loadWords = (slug: string) => (existsSync(files(slug).words) ? Words.parse(JSON.parse(read(files(slug).words))) : null);

export const codeAudio = async (slug: string, force = false) => {
  const F = files(slug);
  const s = loadScript(slug);
  installSfx(F.sfx);
  if (!cfg.elevenKey) return log('  (no ELEVENLABS_API_KEY — no voice-over/music; timings are estimated)');
  if (force || s.vo.lines.some((l) => !existsSync(path.join(F.vo, `${l.id}.mp3`)))) {
    log(`▸ voice-over (${cfg.ttsModel})`);
    (await makeVo(s, F.vo, F.words)).forEach((w) => log(`  ⚠ ${w}`));
    // the real recording decides: if it overshoots the target length, shorten the script once and record again
    const target = targetDuration(slug);
    const voSec = buildTimeline(s, loadWords(slug)).lastEnd / s.fps;
    const goal = target - s.holdSec;
    if (askedDuration(slug) && voSec > goal * 1.15 && !force) {
      log(`  ⚠ VO runs ${voSec.toFixed(1)} s for a ${target} s film — shortening the script`);
      const words = s.vo.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
      await codeScript(slug, `The recorded voice-over ran ${voSec.toFixed(1)} s but the film is ${target} s (VO should be ≈${goal.toFixed(0)} s). Cut to about ${Math.round((words * goal) / voSec)} spoken words — keep the hook, the facts and the CTA.`);
      await codeAudio(slug, true);
      return;
    }
  }
  if (!existsSync(F.music)) {
    log('▸ music bed');
    const c: CodeConcept = JSON.parse(read(F.concept));
    const tl = buildTimeline(s, loadWords(slug));
    await makeMusic({}, F.music, tl.total / s.fps + 1, `${c.metaphor} — ${c.camera}. Premium modern ad score that matches this mood`);
  }
};

// ---------------------------------------------------------------- scene: write, check, revise
const timingTable = (slug: string) => {
  const s = loadScript(slug);
  const words = loadWords(slug);
  const tl = buildTimeline(s, words);
  return s.vo.lines
    .map((l) => {
      const ws = (words?.words[l.id] ?? []).map(([w, st]) => `${w}@${tl.V[l.id] + Math.round(st * s.fps)}`).join(' ');
      return `${l.id} frames ${tl.V[l.id]}–${tl.V[l.id] + tl.LEN[l.id]} | spoken: "${l.text}" | caption: "${l.caption}"${ws ? ` | word frames: ${ws}` : ''}`;
    })
    .join('\n') + `\ntotal frames: ${tl.total} (60 fps; the last ${Math.round(s.holdSec * 60)} frames are the brand hold)`;
};

const CSSY = /(px|em\b|rem|deg|vh|vw|rgba?\(|hsla?\(|#[0-9a-f]{3,8}\b|translate|rotate|scale\(|blur\(|cubic|gradient|^\s*[MmLlCcQqAaZz][\s\d.,-]|url\(|var\(--|ms\b|^\d+(\.\d+)?%$|^-?\d+(\.\d+)?$)/i;

const sceneFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: false })
    .map(String)
    .filter((f) => /\.(tsx?|jsx?)$/.test(f))
    .map((f) => path.join(dir, f));
};

export const checkScene = (slug: string) => {
  const F = files(slug);
  const errors: string[] = [];
  const all = sceneFiles(F.sceneDir);
  if (!existsSync(F.scene)) return ['scene/index.tsx does not exist yet'];
  const known = factNumbers(`${read(F.facts)}\n${read(F.brief)}\n${read(F.script)}`);
  let usesCue = false;
  for (const file of all) {
    const rel = path.relative(F.sceneDir, file);
    const src = read(file);
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    const visit = (n: ts.Node) => {
      if (ts.isImportDeclaration(n)) {
        const mod = (n.moduleSpecifier as ts.StringLiteral).text;
        const local = mod.startsWith('.') && path.resolve(path.dirname(file), mod).startsWith(F.sceneDir);
        if (!['react', 'remotion', '@kit'].includes(mod) && !local) errors.push(`${rel}: import from "${mod}" is not allowed (react, remotion, @kit, or ./ files inside scene/)`);
      }
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) errors.push(`${rel}: dynamic import() is not allowed`);
      if (ts.isPropertyAccessExpression(n) && n.getText() === 'Math.random') errors.push(`${rel}: Math.random is not deterministic — use seeded(n)`);
      if (ts.isIdentifier(n) && ['Date', 'fetch', 'setTimeout', 'setInterval', 'require', 'eval', 'XMLHttpRequest', 'localStorage'].includes(n.text) && !ts.isPropertyAccessExpression(n.parent)) errors.push(`${rel}: "${n.text}" is not allowed in a scene`);
      if (ts.isCallExpression(n) && n.expression.getText().endsWith('cue')) usesCue = true;
      let txt: string | null = null;
      if (ts.isJsxText(n)) txt = n.getText();
      else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) txt = n.text;
      else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) txt = n.text;
      // only text a viewer can read counts: skip style/geometry props and non-text JSX attributes (viewBox, d, fill…)
      const VISIBLE_ATTR = /^(text|label|title|caption|value|body|app|alt|placeholder|children|name|heading|subtitle|kicker|badge|cta)$/;
      const styleProp =
        (ts.isStringLiteral(n) && ts.isPropertyAssignment(n.parent) && /^(fontFamily|font|transform|transformOrigin|filter|background|backgroundImage|color|fill|stroke|d|points|viewBox|fontWeight|clipPath|boxShadow|mixBlendMode|id|key|gridTemplateColumns|transition|animation)$/.test(n.parent.name.getText())) ||
        (ts.isStringLiteral(n) && ts.isJsxAttribute(n.parent) && !VISIBLE_ATTR.test(n.parent.name.getText()));
      if (txt && txt.trim() && !CSSY.test(txt.trim()) && !styleProp && !(ts.isStringLiteral(n) && ts.isImportDeclaration(n.parent))) {
        for (const num of numTokens(txt)) if (num.length > 1 && !known.has(num) && !(Number(num) <= 12 && num.length <= 2)) errors.push(`${rel}: on-screen text "${txt.trim().slice(0, 40)}" contains ${num}, which is not in the facts`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  const entry = read(F.scene);
  if (!/export default function|export default /.test(entry)) errors.push('scene/index.tsx: missing `export default function Scene()`');
  if (!/export const fonts\s*=/.test(entry)) errors.push('scene/index.tsx: missing `export const fonts = { … }`');
  if (!usesCue) errors.push('the scene never calls cue(...) — sync beats to spoken words');

  const program = ts.createProgram(all, {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    noImplicitAny: false,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    baseUrl: ROOT,
    paths: { '@kit': [path.join(ROOT, 'src/kit/index.ts')] },
    typeRoots: [path.join(ROOT, 'node_modules/@types')],
    types: [],
    lib: ['lib.dom.d.ts', 'lib.es2022.d.ts'],
  });
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (!d.file || !path.resolve(d.file.fileName).startsWith(F.sceneDir)) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    errors.push(`${path.relative(F.sceneDir, d.file.fileName)}:${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  }
  return [...new Set(errors)].slice(0, 40);
};

const context = (slug: string) => {
  const F = files(slug);
  return [`BRIEF:\n${read(F.brief)}`, `FACTS (the only numbers/claims allowed on screen):\n${read(F.facts)}`, `CONCEPT:\n${read(F.concept)}`, `BRAND: ${JSON.stringify(loadScript(slug).brand)}`].join('\n\n');
};

/** reference screenshots the client supplied: projects/<slug>/refs/*.png|jpg — UI to remake faithfully */
const refImages = (slug: string) => {
  const dir = path.join(files(slug).dir, 'refs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .map((f) => ({ label: `REF ${f} — real product UI from the client. Remake it faithfully (layout, copy, colours) where the film shows this UI.`, file: path.join(dir, f) }));
};

const keyFrames = (slug: string) => {
  const s = loadScript(slug);
  const tl = buildTimeline(s, loadWords(slug));
  const fr = [4, ...s.vo.lines.map((l) => Math.round(tl.V[l.id] + tl.LEN[l.id] * 0.65)), tl.total - 30];
  return fr;
};

/** the agent's tools: files inside scene/, the kit (read-only), checks, timing, and rendering frames it can look at */
export const sceneTools = (slug: string, round: { n: number }): AgentTool[] => {
  const F = files(slug);
  const inside = (p: string) => {
    const full = path.resolve(F.sceneDir, String(p).replace(/^scene\//, ''));
    if (!full.startsWith(F.sceneDir + path.sep) && full !== F.sceneDir) throw new Error('path must be inside scene/');
    return full;
  };
  let dirty = true;
  const shoot = async (aspect: AspectId, frames: number[], tag: string) => {
    const errs = checkScene(slug);
    if (errs.length) return { text: `not rendered — fix these first:\n- ${errs.join('\n- ')}` };
    if (dirty) {
      forgetBundle(F.pub, F.scene);
      dirty = false;
    }
    const dir = path.join(F.agent, 'renders', `${tag}-${round.n++}`);
    try {
      const r = await stills({ publicDir: F.pub, props: codeProps(slug, true), aspect, frames, outDir: dir, prefix: aspect[0], scene: F.scene });
      return { files: r.files, qa: r.qa };
    } catch (e) {
      return { text: `render crashed: ${String(e instanceof Error ? e.message : e).split('\n').slice(0, 8).join(' ')}` };
    }
  };
  const small = (file: string, aspect: AspectId) => {
    const out = `${file}.agent.jpg`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', aspect === 'landscape' ? 'scale=960:-2' : 'scale=540:-2', '-q:v', '5', out]);
    return out;
  };
  return [
    { name: 'timing', description: 'Voice-over lines with the frame of every spoken word, total frames, fps, safe areas. Call this first.', parameters: { type: 'object', properties: {} }, run: async () => ({ text: `${timingTable(slug)}\nSafe areas — landscape 1920×1080: x100–1820, y70–940 (captions below). Portrait 1080×1920: x60–1020, y140–1600 (captions below).` }) },
    { name: 'list_files', description: 'List the files in scene/.', parameters: { type: 'object', properties: {} }, run: async () => ({ text: sceneFiles(F.sceneDir).map((f) => `${path.relative(F.dir, f)} (${read(f).split('\n').length} lines)`).join('\n') || '(empty — start with scene/index.tsx)' }) },
    {
      name: 'read_file',
      description: 'Read a file: anything in scene/, or the kit source (kit/index.ts, kit/text.tsx, kit/three.tsx, kit/fx.tsx, kit/ui.tsx, kit/vo.tsx) to see exact APIs.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      run: async (a) => {
        const p = String(a.path);
        if (p.startsWith('kit/')) return { text: read(path.join(ROOT, 'src', p)) || 'not found' };
        const full = inside(p);
        return { text: existsSync(full) ? read(full) : 'not found' };
      },
    },
    {
      name: 'write_file',
      description: 'Create or overwrite a file in scene/ (e.g. scene/index.tsx, scene/components/Receipt.tsx).',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
      run: async (a) => {
        const full = inside(String(a.path));
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, String(a.content));
        dirty = true;
        return { text: `wrote ${path.relative(F.dir, full)} (${String(a.content).split('\n').length} lines)` };
      },
    },
    {
      name: 'edit_file',
      description: 'Replace an exact string in a scene/ file (old_string must be unique unless replace_all).',
      parameters: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, required: ['path', 'old_string', 'new_string'] },
      run: async (a) => {
        const full = inside(String(a.path));
        const src = read(full);
        const old = String(a.old_string);
        const count = src.split(old).length - 1;
        if (!count) return { text: 'old_string not found — read the file and copy the exact text' };
        if (count > 1 && !a.replace_all) return { text: `old_string occurs ${count} times — add context or set replace_all` };
        writeFileSync(full, a.replace_all ? src.split(old).join(String(a.new_string)) : src.replace(old, String(a.new_string)));
        dirty = true;
        return { text: `edited ${path.relative(F.dir, full)}` };
      },
    },
    {
      name: 'delete_file',
      description: 'Delete a file in scene/.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      run: async (a) => {
        rmSync(inside(String(a.path)), { force: true });
        dirty = true;
        return { text: 'deleted' };
      },
    },
    { name: 'check', description: 'Run the scene rules (imports, determinism, facts on screen, cue usage) and the TypeScript compiler.', parameters: { type: 'object', properties: {} }, run: async () => { const e = checkScene(slug); return { text: e.length ? `${e.length} problem(s):\n- ${e.join('\n- ')}` : 'ok — no problems' }; } },
    {
      name: 'render_frames',
      description: 'Render specific frames (max 6) in one aspect and look at them. Also returns automated QA warnings (text clipped / off-frame).',
      parameters: { type: 'object', properties: { frames: { type: 'array', items: { type: 'number' } }, aspect: { type: 'string', enum: ['landscape', 'portrait'] } }, required: ['frames', 'aspect'] },
      run: async (a) => {
        const aspect = (a.aspect === 'portrait' ? 'portrait' : 'landscape') as AspectId;
        const frames = (a.frames as number[]).slice(0, 6).map((x) => Math.round(Number(x)));
        const r = await shoot(aspect, frames, 'f');
        if ('text' in r) return { text: r.text as string };
        return { text: `rendered ${aspect} frames ${frames.join(', ')}${r.qa.length ? `\nQA:\n- ${r.qa.join('\n- ')}` : '\nQA: no warnings'}`, images: r.files.map((f, i) => ({ label: `${aspect} frame ${frames[i]}`, file: small(f, aspect) })) };
      },
    },
    {
      name: 'contact_sheet',
      description: 'Render the key moments (first frame, the middle of every VO line, the final hold) as ONE tiled image for an aspect — the fastest way to judge the whole film.',
      parameters: { type: 'object', properties: { aspect: { type: 'string', enum: ['landscape', 'portrait'] } }, required: ['aspect'] },
      run: async (a) => {
        const aspect = (a.aspect === 'portrait' ? 'portrait' : 'landscape') as AspectId;
        const frames = keyFrames(slug);
        const r = await shoot(aspect, frames, 'sheet');
        if ('text' in r) return { text: r.text as string };
        const list = path.join(path.dirname(r.files[0]), 'list.txt');
        writeFileSync(list, r.files.map((f) => `file '${f}'`).join('\n'));
        const cols = aspect === 'landscape' ? 3 : 5;
        const out = path.join(path.dirname(r.files[0]), 'sheet.jpg');
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=${aspect === 'landscape' ? 640 : 300}:-2,tile=${cols}x${Math.ceil(frames.length / cols)}:padding=6:color=white`, '-frames:v', '1', '-q:v', '4', out]);
        return { text: `contact sheet ${aspect}: frames ${frames.join(', ')} (left→right, top→bottom)${r.qa.length ? `\nQA:\n- ${r.qa.join('\n- ')}` : ''}`, images: [{ label: `${aspect} contact sheet — frames ${frames.join(', ')}`, file: out }] };
      },
    },
    { name: 'finish', description: 'Call when the film is finished and you have looked at both aspects.', parameters: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] }, run: async (a) => ({ text: String(a.summary ?? 'done'), done: true }) },
  ];
};

export const writeScene = async (slug: string, maxSteps = Number(process.env.AGENT_STEPS ?? 16)) => {
  const F = files(slug);
  log(`▸ scene agent (${cfg.builder}) — builds step by step, renders and looks at its own frames`);
  mkdirSync(F.sceneDir, { recursive: true });
  const r = await runAgent({ model: cfg.builder, system: agentSystem(), task: `${context(slug)}\n\nBuild the film in scene/. Start with \`timing\`.`, taskImages: refImages(slug), tools: sceneTools(slug, { n: 1 }), dir: F.agent, usageFile: F.usage, maxSteps, tag: 'build', budgetRp: Number(process.env.AGENT_BUDGET_RP ?? 30000) });
  log(`  ${r.done ? '✓' : '⚠'} agent ${r.done ? 'finished' : 'stopped'} after ${r.steps} steps (≈Rp${Math.round(r.spent).toLocaleString('id-ID')}) — ${r.summary.slice(0, 200)}`);
  const errs = checkScene(slug);
  if (errs.length) throw new Error(`scene still has problems:\n- ${errs.join('\n- ')}`);
};

export const reviseScene = async (slug: string, issues: string[], maxSteps = Number(process.env.AGENT_REVISE_STEPS ?? 8)) => {
  const F = files(slug);
  log(`▸ scene agent revises ${issues.length} issue(s) (same session)`);
  const r = await runAgent({ model: cfg.builder, system: agentSystem(), task: `The art director reviewed rendered frames of your film with fresh eyes. Fix these (verify with renders), keep what works, then call finish:\n- ${issues.join('\n- ')}`, tools: sceneTools(slug, { n: 100 }), dir: F.agent, usageFile: F.usage, maxSteps, tag: 'revise', budgetRp: Number(process.env.AGENT_REVISE_BUDGET_RP ?? 15000) });
  log(`  ${r.done ? '✓' : '⚠'} revision ${r.done ? 'finished' : 'stopped'} after ${r.steps} steps (≈Rp${Math.round(r.spent).toLocaleString('id-ID')})`);
};

// ---------------------------------------------------------------- review
const codeProps = (slug: string, qa: boolean): CodeProps => {
  const F = files(slug);
  const script = loadScript(slug);
  return { script, words: loadWords(slug), hasVo: script.vo.lines.every((l) => existsSync(path.join(F.vo, `${l.id}.mp3`))), hasMusic: existsSync(F.music), sfx: existsSync(F.sfx), qa };
};

export const codeStills = async (slug: string, round: number) => {
  const F = files(slug);
  const s = loadScript(slug);
  const tl = buildTimeline(s, loadWords(slug));
  const hold: { frame: number; label: string }[] = [{ frame: 4, label: 'first frame (thumbnail)' }];
  s.vo.lines.forEach((l, i) => {
    const a = tl.V[l.id];
    const b = a + tl.LEN[l.id];
    hold.push({ frame: Math.round(a + (b - a) * 0.65), label: `during ${l.id} "${l.caption}"` });
    if (i < s.vo.lines.length - 1) hold.push({ frame: b + 6, label: `transition after ${l.id}` });
  });
  hold.push({ frame: tl.total - 30, label: 'final brand hold' });
  const dir = path.join(F.review, `round-${round}`);
  const tiles: { id: string; aspect: AspectId; frame: number; label: string; file: string }[] = [];
  const qa: string[] = [];
  for (const aspect of ['landscape', 'portrait'] as AspectId[]) {
    const fr = aspect === 'portrait' ? hold.filter((h) => !h.label.startsWith('transition')) : hold;
    log(`  rendering ${fr.length} ${aspect} stills…`);
    const r = await stills({ publicDir: F.pub, props: codeProps(slug, true), aspect, frames: fr.map((h) => h.frame), outDir: dir, prefix: aspect === 'landscape' ? 'L' : 'P', scene: F.scene });
    r.files.forEach((file, i) => tiles.push({ id: `${aspect === 'landscape' ? 'L' : 'P'}${i + 1}`, aspect, frame: fr[i].frame, label: fr[i].label, file }));
    qa.push(...r.qa);
  }
  for (const [pre, cols, w] of [['L', 3, 640], ['P', 5, 300]] as const) {
    const list = tiles.filter((t) => t.id.startsWith(pre)).map((t) => `file '${t.file}'`).join('\n');
    writeFileSync(path.join(dir, `${pre}.txt`), list);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, `${pre}.txt`), '-vf', `scale=${w}:-2,tile=${cols}x${Math.ceil(tiles.filter((t) => t.id.startsWith(pre)).length / cols)}:padding=6:color=white`, '-frames:v', '1', path.join(dir, `sheet-${pre}.jpg`)]);
  }
  return { tiles, qa, dir };
};

export const codeVerify = async (slug: string, round: number, tiles: Awaited<ReturnType<typeof codeStills>>['tiles'], qa: string[]): Promise<Review> => {
  const F = files(slug);
  log(`▸ verify round ${round} with ${cfg.verifier} (${tiles.length} tiles)`);
  const s = loadScript(slug);
  const parts: Part[] = [
    {
      type: 'text',
      text: [`FACTS:\n${read(F.facts)}`, `CONCEPT:\n${read(F.concept)}`, `SCRIPT:\n${s.vo.lines.map((l) => `${l.id}: "${l.caption}"`).join('\n')}`, `AUTOMATED QA WARNINGS:\n${qa.length ? qa.map((q) => `- ${q}`).join('\n') : '(none)'}`, `TILES:\n${tiles.map((t) => `${t.id}: ${t.aspect} frame ${t.frame} — ${t.label}`).join('\n')}`].join('\n\n'),
    },
  ];
  for (const t of tiles) {
    const small = `${t.file}.send.jpg`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', t.file, '-vf', t.aspect === 'landscape' ? 'scale=1280:-2' : 'scale=720:-2', '-q:v', '4', small]);
    parts.push({ type: 'text', text: `${t.id} — ${t.aspect}, frame ${t.frame}, ${t.label}` });
    parts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${readFileSync(small).toString('base64')}` } });
  }
  const system = `${promptFile('verifier.md')}\n\nCODE MODE: there is no JSON spec — the film is bespoke code built from the CONCEPT. Judge it against the concept too (is the metaphor clear? does it look crafted, not templated?). Put concrete visual instructions in \`fix\` (what to move/resize/retime/recolour/rewrite, which cue word); leave \`patch\` empty.`;
  const { text } = await chat({ model: cfg.verifier, messages: [{ role: 'system', content: system }, { role: 'user', content: parts }], temperature: 0.2, usageFile: F.usage, tag: `verify#${round}` });
  const rv = parseJson<Review>(text);
  rv.issues = rv.issues ?? [];
  const dir = path.join(F.review, `round-${round}`);
  writeFileSync(path.join(dir, 'review.json'), JSON.stringify(rv, null, 1));
  writeFileSync(path.join(dir, 'review.md'), `# Round ${round} — score ${rv.score}/10 ${rv.pass ? '✅ pass' : '❌'}\n\n${rv.summary}\n\n${rv.issues.map((i) => `- **${i.severity}** ${i.tile ?? ''}: ${i.problem}\n  - fix: ${i.fix}`).join('\n')}\n`);
  log(`  score ${rv.score}/10 ${rv.pass ? 'PASS' : 'needs work'} — ${rv.summary}`);
  rv.issues.forEach((i) => log(`   [${i.severity}] ${i.tile ?? ''} ${i.problem}`));
  return rv;
};

export const codeRender = async (slug: string, aspects: AspectId[] = ['landscape', 'portrait']) => {
  const F = files(slug);
  const s = loadScript(slug);
  const outs: string[] = [];
  for (const aspect of aspects) {
    const output = path.join(F.out, `${slug}-${aspect}.mp4`);
    log(`▸ render ${aspect} → ${path.relative(process.cwd(), output)}`);
    await media({ publicDir: F.pub, props: codeProps(slug, false), aspect, output, concurrency: cfg.concurrency, scene: F.scene });
    const spikes = diffScan(output, aspect, { beats: [], vo: s.vo, fps: s.fps, holdSec: s.holdSec } as never, loadWords(slug));
    log(spikes.length ? `  ⚠ ${spikes.length} sudden frame jump(s): ${spikes.slice(0, 6).map((x) => `f${x.frame}`).join(', ')}` : '  ✓ no unexpected frame jumps');
    outs.push(output);
  }
  return outs;
};

export const runCode = async (slug: string, opts: { rounds?: number; skipRender?: boolean } = {}) => {
  const F = files(slug);
  await requireBalance(existsSync(F.scene) ? 8000 : Number(process.env.AGENT_BUDGET_RP ?? 30000) + 6000, 'a code-mode run');
  if (!existsSync(F.concept) || !JSON.parse(read(F.concept)).metaphor) await codeConcept(slug);
  if (!existsSync(F.script)) await codeScript(slug);
  await codeAudio(slug);
  if (!existsSync(F.scene)) await writeScene(slug);
  const rounds = opts.rounds ?? cfg.maxRounds;
  const first = latestRound(slug) + 1;
  let last: Review | null = null;
  for (let r = first; r < first + rounds; r++) {
    log(`▸ review round ${r} (${r - first + 1}/${rounds})`);
    let shot: Awaited<ReturnType<typeof codeStills>>;
    try {
      shot = await codeStills(slug, r);
    } catch (e) {
      // the scene threw while rendering — the coder gets the error
      const msg = String(e instanceof Error ? e.message : e).split('\n').slice(0, 6).join(' ');
      log(`  ✗ render error: ${msg.slice(0, 200)}`);
      await reviseScene(slug, [`The scene crashed while rendering: ${msg}`]);
      continue;
    }
    last = await codeVerify(slug, r, shot.tiles, shot.qa);
    if (last.pass || r === first + rounds - 1) break;
    await reviseScene(slug, [...last.issues.filter((i) => i.severity !== 'low').map((i) => `[${i.severity}] ${i.tile ?? ''} ${i.problem} → ${i.fix}`), ...shot.qa.slice(0, 6).map((q) => `[qa] ${q}`)]);
  }
  const outs = opts.skipRender ? [] : await codeRender(slug);
  log(`\n✓ ${slug} (code mode): final review ${last ? `${last.score}/10 ${last.pass ? 'pass' : '(not passed — see review/)'}` : 'skipped'}`);
  outs.forEach((o) => log(`  ${o}`));
  return { review: last, outs };
};
