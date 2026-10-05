// Gate between the builder model and the renderer. Schema errors + semantic rules that encode what makes these
// videos good (or keeps them honest). Errors go back to the builder verbatim, so they are written as instructions.
import { LOOK_IDS, Spec, type Words } from '../src/spec/schema';
import { buildTimeline, norm } from '../src/engine/timeline';
import { departure, revealEnd } from './reveals';

const CUE_KEYS = new Set(['at', 'from', 'to', 'cutAt', 'goAt', 'logoAt', 'scanFrom', 'scanTo', 'doneAt', 'kickerAt', 'revealAt']);
const NON_VISIBLE = new Set(['at', 'from', 'to', 'cutAt', 'goAt', 'logoAt', 'scanFrom', 'scanTo', 'doneAt', 'kickerAt', 'revealAt', 'type', 'group', 'style', 'scene', 'effect', 'preset', 'path', 'voiceId', 'tts', 'slug', 'lines', 'mark', 'color', 'accent', 'hot', 'source']);

const numTokens = (s: string) => (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((x) => x.replace(/[.,]/g, ''));

const factNumbers = (facts: string) => {
  const set = new Set(numTokens(facts));
  // common spoken/compact forms
  if (/\b1\s?M\b|sejuta|1 juta|one million/i.test(facts)) set.add('1000000');
  for (const m of facts.matchAll(/(\d+(?:[.,]\d+)?)\s?(K|M|B|rb|ribu|juta)\b/gi)) {
    const n = parseFloat(m[1].replace(',', '.'));
    const mult = /k|rb|ribu/i.test(m[2]) ? 1e3 : /m|juta/i.test(m[2]) ? 1e6 : 1e9;
    set.add(String(Math.round(n * mult)));
  }
  return set;
};

const walk = (o: unknown, fn: (k: string, v: unknown, path: string) => void, p = '', key = '') => {
  if (Array.isArray(o))
    o.forEach((v, i) => {
      if (typeof v !== 'object') fn(key, v, `${p}/${i}`);
      walk(v, fn, `${p}/${i}`, key);
    });
  else if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o)) {
      fn(k, v, `${p}/${k}`);
      walk(v, fn, `${p}/${k}`, k);
    }
};

export type LintResult = { spec?: Spec; errors: string[]; warnings: string[] };

export const lintSpec = (raw: unknown, ctx: { facts: string; brief: string; recentLooks: string[]; reference?: unknown; words?: Words | null }): LintResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = Spec.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 25)) errors.push(`${i.path.join('.') || '(root)'}: ${i.message}`);
    return { errors, warnings };
  }
  const spec = parsed.data;

  // ids
  const beatIds = spec.beats.map((b) => b.id);
  if (new Set(beatIds).size !== beatIds.length) errors.push('beats: ids must be unique');
  const lineIds = spec.vo.lines.map((l) => l.id);
  if (new Set(lineIds).size !== lineIds.length) errors.push('vo.lines: ids must be unique');

  // cues must point at words that are actually spoken
  walk(spec, (k, v, p) => {
    if (!CUE_KEYS.has(k) || typeof v !== 'string' || v === 'end') return;
    const m = /^([^:+\-]+)(?::([^#+\-]+))?/.exec(v);
    if (!m) return;
    const line = spec.vo.lines.find((l) => l.id === m[1]);
    if (!line) errors.push(`${p}: cue "${v}" references VO line "${m[1]}" which does not exist (have ${lineIds.join(', ')})`);
    else if (m[2] && !norm(line.text).includes(norm(m[2]))) errors.push(`${p}: cue word "${m[2]}" is not spoken in ${line.id} ("${line.text}") — use a word from the spoken text`);
  });

  // beats in time order, enough room for the camera
  // real STT timings when the recorded VO still matches the text; otherwise estimates (and a looser tolerance)
  const w = ctx.words && spec.vo.lines.every((l) => ctx.words!.text?.[l.id] === l.text) ? ctx.words : null;
  const tl = buildTimeline(spec, w);
  const tol = w ? 8 : 20;
  const arr = spec.beats.map((b) => tl.cue(b.at));
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) errors.push(`beats[${i}] (${spec.beats[i].id}): its "at" cue comes before the previous beat — order beats by time`);
    else if (arr[i] - arr[i - 1] < 24 && !(spec.beats[i].widget.type === 'lockup')) warnings.push(`beats[${i}] (${spec.beats[i].id}) starts only ${arr[i] - arr[i - 1]} frames after the previous beat — the camera will feel rushed`);
  }

  // every reveal must land (and be readable) before the camera leaves the beat
  spec.beats.forEach((b, i) => {
    if (b.widget.type === 'lockup') return;
    const r = revealEnd(b, tl.cue);
    const dep = departure(spec, i, tl.cue, tl.total);
    const over = r.frame - dep;
    if (over > tol) errors.push(`beats[${i}] (${b.id}): ${r.key} finishes ${((over / spec.fps) * 1000).toFixed(0)} ms after the camera leaves for the next beat — the viewer can't read it. Cue it on an EARLIER word, or move the next beat's cue later (add words to the VO line)`);
    else if (over > 0) warnings.push(`beats[${i}] (${b.id}): ${r.key} lands just as the camera leaves (${over} frames tight)`);
  });

  // structure
  if (!['hero', 'headline'].includes(spec.beats[0].widget.type)) warnings.push('beats[0]: open with a hero or headline beat');
  if (spec.beats[spec.beats.length - 1].widget.type !== 'lockup') errors.push('the last beat must be a lockup (brand end card)');
  if (spec.beats[0].at !== spec.vo.lines[0].id) warnings.push(`beats[0].at should be "${spec.vo.lines[0].id}" so the first frame is never empty`);
  const hero = spec.beats.find((b) => b.widget.type === 'hero');
  if (hero && hero.widget.type === 'hero' && hero.widget.name.map((n) => n.text).join('').length > 12) errors.push('hero.name pieces total more than 12 characters — shorten the displayed name');

  // VO pacing (≈0.36 s per spoken word at tempo 1.1)
  spec.vo.lines.forEach((l, i) => {
    const n = l.text.split(/\s+/).filter(Boolean).length;
    if (n > 10) errors.push(`vo.lines[${i}].text has ${n} words — max 10 per line; split it`);
    const camel = l.text.split(/\s+/).filter((w) => /[a-z][A-Z]/.test(w));
    if (camel.length) errors.push(`vo.lines[${i}].text has CamelCase words (${camel.join(', ')}) — TTS mangles them ("MiMo" → "Mi Move"); write them as they sound ("Mimo", "Open Code")`);
    if (/\d/.test(l.text)) errors.push(`vo.lines[${i}].text contains digits — spell numbers as words for TTS ("lima puluh empat persen"); put digits in caption`);
    if (i === 0 && n > 7) warnings.push('vo.lines[0] is the hook: keep it ≤ 6 words (≈3 s)');
  });
  const voSec = tl.lastEnd / spec.fps;
  if (voSec > 17) errors.push(`estimated VO length ${voSec.toFixed(1)} s is too long for a short spot — cut words (aim 11–13 s)`);

  // brand at the end of a sentence is pronounced right; mid-sentence it gets mangled by TTS
  const brand = norm(spec.brand.name);
  spec.vo.lines.forEach((l, i) => {
    const toks = l.text.split(/\s+/);
    toks.forEach((tok, k) => {
      if (norm(tok) === brand && k < toks.length - 1 && !/[.!?,]$/.test(tok)) warnings.push(`vo.lines[${i}]: "${spec.brand.name}" mid-sentence tends to be mispronounced by TTS — put it at the end of the line`);
    });
  });

  // honesty
  const visible: string[] = [];
  walk(spec.beats, (k, v, p) => {
    if (typeof v !== 'string' || NON_VISIBLE.has(k)) return;
    if (k === 'id' && /^\/\d+\/id$/.test(p)) return; // beat id, not on screen
    visible.push(v);
  });
  spec.vo.lines.forEach((l) => visible.push(l.caption));
  const known = factNumbers(`${ctx.facts}\n${ctx.brief}`);
  const unknown = new Set<string>();
  for (const s of visible) for (const n of numTokens(s)) if (n.length > 1 && !known.has(n)) unknown.add(n);
  spec.beats.forEach((b) => {
    if (b.widget.type === 'stat' && !known.has(String(Math.round(b.widget.value)))) unknown.add(String(b.widget.value));
  });
  if (unknown.size) errors.push(`numbers not found in FACTS/brief: ${[...unknown].join(', ')} — only show numbers that the facts state (no invented prices, %, benchmarks)`);
  const all = JSON.stringify(spec).toLowerCase();
  for (const bad of ['selamanya', 'forever', 'lifetime', 'unlimited', 'tanpa batas', 'zero refusal']) if (all.includes(bad) && !`${ctx.facts}${ctx.brief}`.toLowerCase().includes(bad)) errors.push(`"${bad}" is a claim the facts don't make — remove it`);
  if (spec.beats.some((b) => b.widget.type === 'price') && !spec.beats.some((b) => b.widget.type === 'price' && b.widget.finePrint.length > 40)) errors.push('price.finePrint must name the sources, the unit and the FX basis');

  // freshness: the reference spec is a quality bar, not a template to copy
  if (ctx.reference) {
    // only creative copy counts — ids, product names, prices and fact labels are expected to repeat
    const CREATIVE = new Set(['chip', 'chips', 'caption', 'lines', 'task', 'detect', 'result', 'status', 'done', 'cta', 'text']);
    const collect = (o: unknown) => {
      const out = new Set<string>();
      walk(o, (k, v, p) => {
        if (typeof v === 'string' && v.length >= 4 && CREATIVE.has(k) && !/\/(name|accentWord)\//.test(p) && !numTokens(v).length) out.add(v);
      });
      return out;
    };
    const ref = collect((ctx.reference as { beats?: unknown }).beats);
    const same = [...collect(spec.beats)].filter((v) => ref.has(v));
    if (same.length > 4) errors.push(`${same.length} texts are copied verbatim from the reference spec (${same.slice(0, 8).map((x) => `"${x}"`).join(', ')}) — write fresh copy that fits THIS brief (new chips, code lines, tasks, detections, status line)`);
  }

  // variety across videos
  if (ctx.recentLooks.includes(spec.look.preset)) errors.push(`look.preset "${spec.look.preset}" was used in a recent video — pick one of: ${LOOK_IDS.filter((l) => !ctx.recentLooks.includes(l)).join(', ')}`);

  tl.warnings.forEach((w) => warnings.push(w));
  return { spec, errors, warnings };
};
