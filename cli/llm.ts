// OpenAI-compatible chat client for the Vikey API (https://api.vikey.ai/v1). Logs token usage per call.
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { cfg, need } from './env';

export type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type Msg = { role: 'system' | 'user' | 'assistant'; content: string | Part[] };
export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Opts = { model: string; messages: Msg[]; maxTokens?: number; temperature?: number; json?: boolean; usageFile?: string; tag: string; stream?: boolean };

/** read an SSE stream from an OpenAI-compatible endpoint; shows live progress so long reasoning never looks stuck */
async function readStream(r: Response, tag: string) {
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
  let reasoning = 0;
  let usage: Usage = {};
  let err: { message?: string; code?: string } | null = null;
  const t0 = Date.now();
  let lastPrint = 0;
  const tty = process.stdout.isTTY;
  const show = (final = false) => {
    const now = Date.now();
    if (!final && now - lastPrint < (tty ? 400 : 15000)) return;
    lastPrint = now;
    const line = `  … ${tag}: ${Math.round((now - t0) / 1000)}s, thinking ~${reasoning.toLocaleString()} chars, answer ${text.length.toLocaleString()} chars`;
    if (tty) process.stdout.write(`\r${line}\x1b[K${final ? '\n' : ''}`);
    else console.log(line);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        if (j.error) err = j.error;
        const d = j.choices?.[0]?.delta ?? {};
        if (d.content) text += d.content;
        if (d.reasoning_content) reasoning += d.reasoning_content.length;
        if (d.reasoning) reasoning += String(d.reasoning).length;
        if (j.usage) usage = j.usage;
      } catch {
        /* keep-alive or partial line */
      }
      show();
    }
  }
  show(true);
  return { text, usage, err };
}

export async function chat(o: Opts) {
  need('vikeyKey', 'Vikey API key from vikey.ai/dashboard');
  let maxTokens = o.maxTokens ?? 8000;
  let json = o.json ?? false;
  let stream = o.stream ?? process.env.LLM_STREAM !== '0';
  let lastErr = '';
  for (let attempt = 1; attempt <= 5; attempt++) {
    const body: Record<string, unknown> = { model: o.model, messages: o.messages, max_tokens: maxTokens, temperature: o.temperature ?? 0.4 };
    if (json) body.response_format = { type: 'json_object' };
    if (stream) {
      body.stream = true;
      body.stream_options = { include_usage: true };
    }
    let r: Response;
    try {
      r = await fetch(`${cfg.baseUrl}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.vikeyKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(900_000) });
    } catch (e) {
      lastErr = String(e);
      await sleep(2000 * attempt);
      continue;
    }
    let text = '';
    let usage: Usage = {};
    let error: { message?: string; code?: string } | null = null;
    const isSse = (r.headers.get('content-type') ?? '').includes('event-stream');
    if (r.ok && stream && isSse) {
      const s = await readStream(r, o.tag);
      text = s.text;
      usage = s.usage;
      error = s.err;
    } else {
      const raw = await r.text();
      let d: { choices?: { message?: { content?: string } }[]; usage?: Usage; error?: { message?: string; code?: string } };
      try {
        d = JSON.parse(raw);
      } catch {
        // some gateways answer SSE without the header — try to read it as a stream dump
        if (raw.includes('data:')) {
          for (const line of raw.split('\n')) {
            const m = /^data:\s*(\{.*\})\s*$/.exec(line.trim());
            if (!m) continue;
            try {
              const j = JSON.parse(m[1]);
              text += j.choices?.[0]?.delta?.content ?? '';
              if (j.usage) usage = j.usage;
            } catch {
              /* ignore */
            }
          }
          d = { choices: [{ message: { content: text } }], usage };
        } else {
          lastErr = `${r.status} ${raw.slice(0, 200)}`;
          await sleep(2000 * attempt);
          continue;
        }
      }
      if (d.error || !r.ok) error = d.error ?? { message: raw.slice(0, 300) };
      text = d.choices?.[0]?.message?.content ?? text;
      usage = d.usage ?? usage;
    }
    if (error || !r.ok) {
      const msg = error?.message ?? `HTTP ${r.status}`;
      lastErr = `${r.status} ${msg}`;
      if (error?.code === 'reasoning_exhausted_budget' || /max_tokens|reasoning/i.test(msg)) maxTokens = Math.min(64000, maxTokens * 2);
      else if (json && /response_format|json/i.test(msg)) json = false;
      else if (stream && /stream/i.test(msg)) stream = false;
      else if (r.status === 401 || r.status === 403) throw new Error(`Vikey auth failed (${r.status}): ${msg}`);
      else if (r.status === 404) throw new Error(`model "${o.model}" not available on ${cfg.baseUrl}: ${msg}`);
      await sleep(r.status === 429 ? 6000 * attempt : 1500 * attempt);
      continue;
    }
    if (o.usageFile) {
      mkdirSync(path.dirname(o.usageFile), { recursive: true });
      appendFileSync(o.usageFile, JSON.stringify({ ts: new Date().toISOString(), tag: o.tag, model: o.model, ...usage }) + '\n');
    }
    if (!text.trim()) {
      lastErr = 'empty answer (reasoning used the whole budget?)';
      maxTokens = Math.min(64000, maxTokens * 2);
      continue;
    }
    return { text, usage };
  }
  throw new Error(`LLM call failed after retries (${o.model}): ${lastErr}`);
}

/** pull the first JSON object out of a model reply (fences, prose, trailing commas tolerated) */
export const parseJson = <T = unknown>(text: string): T => {
  let s = text.replace(/```(?:json)?/gi, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no JSON object in model reply');
  s = s.slice(a, b + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')) as T;
  }
};
