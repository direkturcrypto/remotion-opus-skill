// SFX are synthesized with ffmpeg (no licensing questions, identical on every machine). Music + VO use ElevenLabs
// when ELEVENLABS_API_KEY is set; without it the video renders with captions + SFX only.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Spec } from '../src/spec/schema';
import { cfg, need } from './env';
import { ASSETS } from './paths';

const SFX: Record<string, { d: number; expr: string; af?: string }> = {
  pop: { d: 0.2, expr: '0.8*sin(2*PI*(520*t-1400*t*t))*exp(-t*28)' },
  tick: { d: 0.07, expr: '0.6*sin(2*PI*2600*t)*exp(-t*110)' },
  type: { d: 0.8, expr: '0.55*(random(0)*2-1)*exp(-mod(t,0.068)*170)*lt(t,0.72)', af: 'highpass=f=1400' },
  impact: { d: 1.0, expr: '(0.9*sin(2*PI*52*t)+0.45*sin(2*PI*104*t))*exp(-t*5)+0.55*(random(0)*2-1)*exp(-t*38)', af: 'lowpass=f=3200' },
  stamp: { d: 0.45, expr: '0.9*sin(2*PI*90*t)*exp(-t*14)+0.7*(random(0)*2-1)*exp(-t*60)', af: 'lowpass=f=4200' },
  whoosh: { d: 0.6, expr: '0.9*(random(0)*2-1)*pow(sin(PI*t/0.6),2)', af: 'highpass=f=450,lowpass=f=4200' },
  fly: { d: 0.95, expr: '0.9*(random(0)*2-1)*pow(sin(PI*t/0.95),3)+0.18*sin(2*PI*(180*t+320*t*t))*pow(sin(PI*t/0.95),2)', af: 'highpass=f=260,lowpass=f=5200' },
  roll: { d: 0.9, expr: '0.5*sin(2*PI*3000*t)*exp(-mod(t,0.045)*140)*(1-t/0.9)' },
  scan: { d: 0.8, expr: '0.35*sin(2*PI*(900*t+900*t*t))*(0.6+0.4*sin(2*PI*14*t))*sin(PI*t/0.8)' },
  slash: { d: 0.35, expr: '(random(0)*2-1)*exp(-t*9)*sin(PI*min(t/0.05,1)/2)', af: 'highpass=f=2400' },
  whip: { d: 0.6, expr: '0.55*(random(0)*2-1)*lt(t,0.32)*pow(t/0.32,3)+1.0*(random(0)*2-1)*gte(t,0.32)*exp(-(t-0.32)*90)', af: 'highpass=f=700' },
  chime: { d: 1.2, expr: '0.3*(sin(2*PI*880*t)+0.7*sin(2*PI*1320*t)+0.5*sin(2*PI*1760*t))*exp(-t*3.5)' },
};

export const ensureSfxAssets = () => {
  const dir = path.join(ASSETS, 'sfx');
  mkdirSync(dir, { recursive: true });
  for (const [name, s] of Object.entries(SFX)) {
    const out = path.join(dir, `${name}.wav`);
    if (existsSync(out)) continue;
    const af = [s.af, 'alimiter=limit=0.89'].filter(Boolean).join(',');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `aevalsrc='${s.expr}':s=48000:d=${s.d}`, '-af', af, '-ac', '1', out]);
  }
  return dir;
};

export const installSfx = (pubSfx: string) => {
  const src = ensureSfxAssets();
  mkdirSync(pubSfx, { recursive: true });
  for (const f of readdirSync(src)) copyFileSync(path.join(src, f), path.join(pubSfx, f));
};

const LOOK_MOOD: Record<string, string> = {
  'graphite-studio': 'clean premium tech launch, crisp punchy kick, glossy plucky synth hook, warm sub bass',
  'midnight-glass': 'sleek futuristic night-drive synthwave, airy pads, tight drums, shimmering arps',
  'paper-ink': 'playful confident editorial pop beat, claps, bouncy bass, bright piano stabs',
  'aurora-soft': 'dreamy upbeat future-pop, soft sidechained pads, bright bells, light drums',
  'mono-lab': 'minimal precise electronic, clicky percussion, clean bass pulse, tech lab feeling',
  'ember-noir': 'bold cinematic trap-tech hybrid, deep 808, hard claps, dark brass stabs',
};

export const makeMusic = async (spec: Spec, out: string, seconds: number) => {
  need('elevenKey', 'ElevenLabs music');
  const prompt = `${LOOK_MOOD[spec.look.preset] ?? LOOK_MOOD['graphite-studio']}. Instrumental only, about 126 BPM, starts immediately on the beat, a short filter riser near the middle then a bigger drop, confident ending hit about 2 seconds before the end with a short tail. Fast modern ad pacing that sits under a voice-over, no vocals.`;
  const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': cfg.elevenKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ model_id: 'music_v1', music_length_ms: Math.round(seconds * 1000), prompt }) });
  if (!r.ok) throw new Error(`music ${r.status}: ${(await r.text()).slice(0, 300)}`);
  mkdirSync(path.dirname(out), { recursive: true });
  const tmp = `${out}.raw.mp3`;
  writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
  normalize(tmp, out, -12);
};

const loudness = (file: string, af = '') => {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `${af ? af + ',' : ''}loudnorm=print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  return Number(/"input_i"\s*:\s*"(-?[\d.]+)"/.exec(res)?.[1] ?? -16);
};
const normalize = (src: string, out: string, target: number, tempo = 1) => {
  const pre = tempo !== 1 ? `atempo=${tempo}` : '';
  const gain = (target - loudness(src, pre)).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-af', `${pre ? pre + ',' : ''}volume=${gain}dB,alimiter=limit=-1.5dB`, '-b:a', '192k', out]);
};
export const duration = (file: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

/** TTS each line → tempo + loudness → STT word timings. Returns lines whose transcript misses the brand/odd words. */
export const makeVo = async (spec: Spec, voDir: string, wordsFile: string, only: string[] = []) => {
  need('elevenKey', 'voice-over');
  const raw = path.join(voDir, 'raw');
  mkdirSync(raw, { recursive: true });
  const voice = spec.vo.voiceId ?? cfg.voice;
  const words: { dur: Record<string, number>; words: Record<string, [string, number, number][]>; text?: Record<string, string> } = existsSync(wordsFile) ? JSON.parse(readFileSync(wordsFile, 'utf8')) : { dur: {}, words: {} };
  words.text ??= {};
  const suspicious: string[] = [];
  const NUMW = /^(nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|belas|puluh|ratus|seratus|ribu|seribu|juta|sejuta|miliar|koma|persen|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|teen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|point|percent)$/;
  const n = (x: string) => x.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  const brand = n(spec.brand.name);
  /** fraction of spoken words (≥3 letters, not number words) that STT heard back; brand must be heard */
  const score = (expected: string, heard: string) => {
    const want = expected.split(/\s+/).map(n).filter((w) => w.length >= 3 && !NUMW.test(w));
    const got = heard.split(/\s+/).map(n).filter(Boolean);
    const hit = want.filter((w) => got.some((g) => g === w || (g.length >= 3 && (g.startsWith(w) || w.startsWith(g)))));
    const brandOk = !n(expected).includes(brand) || got.some((g) => g.startsWith(brand.slice(0, 4)) || g === brand);
    return { ratio: want.length ? hit.length / want.length : 1, brandOk, missed: want.filter((w) => !hit.includes(w)) };
  };
  const takes = Number(process.env.VO_TAKES ?? 3);
  for (const l of spec.vo.lines) {
    if (only.length && !only.includes(l.id)) continue;
    let best: { file: string; ratio: number; brandOk: boolean; text: string; words: [string, number, number][]; dur: number; missed: string[] } | null = null;
    for (let take = 1; take <= takes; take++) {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, { method: 'POST', headers: { 'xi-api-key': cfg.elevenKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: l.tts ?? l.text, model_id: cfg.ttsModel, language_code: spec.language, voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true } }) });
      if (!r.ok) throw new Error(`TTS ${l.id} ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const rf = path.join(raw, `${l.id}.take${take}.mp3`);
      writeFileSync(rf, Buffer.from(await r.arrayBuffer()));
      const out = path.join(raw, `${l.id}.take${take}.norm.mp3`);
      normalize(rf, out, -14, spec.vo.tempo);
      const fd = new FormData();
      fd.append('model_id', 'scribe_v1');
      fd.append('language_code', spec.language);
      fd.append('file', new Blob([readFileSync(out)]), `${l.id}.mp3`);
      const st = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': cfg.elevenKey }, body: fd });
      if (!st.ok) throw new Error(`STT ${l.id} ${st.status}: ${(await st.text()).slice(0, 200)}`);
      const j = (await st.json()) as { text: string; words: { type: string; text: string; start: number; end: number }[] };
      const sc = score(l.text, j.text);
      const cand = { file: out, ...sc, text: j.text, words: j.words.filter((w) => w.type === 'word').map((w) => [w.text, Math.round(w.start * 100) / 100, Math.round(w.end * 100) / 100] as [string, number, number]), dur: duration(out) };
      if (!best || Number(cand.brandOk) * 2 + cand.ratio > Number(best.brandOk) * 2 + best.ratio) best = cand;
      console.log(`  ${l.id} take ${take}: ${(sc.ratio * 100).toFixed(0)}% heard${sc.brandOk ? '' : ', brand MISSING'}  ← "${j.text}"`);
      if (sc.brandOk && sc.ratio >= 0.9) break;
    }
    copyFileSync(best!.file, path.join(voDir, `${l.id}.mp3`));
    words.dur[l.id] = best!.dur;
    words.words[l.id] = best!.words;
    words.text[l.id] = l.text;
    if (!best!.brandOk || best!.ratio < 0.9) suspicious.push(`${l.id}: best of ${takes} takes still misheard (${best!.missed.join(', ') || 'brand'}; STT "${best!.text}") — rewrite the line (spell words as they sound, brand at the end) or re-run \`ros audio <slug> --only ${l.id} --force\``);
  }
  writeFileSync(wordsFile, JSON.stringify(words, null, 1));
  return suspicious;
};
