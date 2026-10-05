// A small Claude-Code-style agent loop over the Vikey (OpenAI-compatible) API: the model works step by step with
// tools — write files, compile, render frames and LOOK at them, edit — until it calls finish. The session is saved
// after every step, so a crash or a new review round resumes the same conversation instead of starting over.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chat, type Msg, type Part, type ToolSpec } from './llm';

export type ToolResult = { text: string; images?: { label: string; file: string }[]; done?: boolean };
export type AgentTool = { name: string; description: string; parameters: Record<string, unknown>; run: (args: Record<string, unknown>) => Promise<ToolResult> };

const KEEP_IMAGE_MESSAGES = 2;

/** older renders are replaced by a placeholder so the context doesn't balloon with pictures */
const pruneImages = (messages: Msg[]) => {
  const withImages = messages.map((m, i) => (Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url') ? i : -1)).filter((i) => i >= 0);
  for (const i of withImages.slice(0, -KEEP_IMAGE_MESSAGES)) {
    const parts = messages[i].content as Part[];
    messages[i].content = parts.map((p) => (p.type === 'image_url' ? ({ type: 'text', text: '[earlier render removed to save context — render again if you need it]' } as Part) : p));
  }
};

const short = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s).replace(/\n/g, ' ');

// Rp per 1M tokens (vikey.ai/pricing, read 5 Oct 2026). Unknown models are not budgeted.
const PRICE: Record<string, { in: number; out: number; cached: number }> = {
  'anthropic/claude-opus-5.5': { in: 36000, out: 144000, cached: 3600 },
  'anthropic/claude-sonnet-5.5': { in: 18000, out: 72000, cached: 3600 },
};
export const costRp = (model: string, u: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }) => {
  const p = PRICE[model];
  if (!p) return 0;
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  return ((((u.prompt_tokens ?? 0) - cached) * p.in + cached * p.cached + (u.completion_tokens ?? 0) * p.out) / 1e6);
};

export const runAgent = async (o: { model: string; system: string; task: string; tools: AgentTool[]; dir: string; usageFile: string; maxSteps: number; tag: string; budgetRp?: number }) => {
  mkdirSync(o.dir, { recursive: true });
  const sessionFile = path.join(o.dir, 'session.json');
  const logFile = path.join(o.dir, 'log.md');
  const messages: Msg[] = existsSync(sessionFile) ? JSON.parse(readFileSync(sessionFile, 'utf8')) : [{ role: 'system', content: o.system }];
  messages.push({ role: 'user', content: o.task });
  appendFileSync(logFile, `\n## ${o.tag} — ${new Date().toISOString()}\n\n${short(o.task, 400)}\n\n`);
  const specs: ToolSpec[] = o.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  let nudges = 0;
  let spent = 0;
  for (let step = 1; step <= o.maxSteps; step++) {
    if (o.budgetRp && spent >= o.budgetRp) {
      console.log(`  ${o.tag}: budget Rp${o.budgetRp.toLocaleString('id-ID')} reached (spent ≈Rp${Math.round(spent).toLocaleString('id-ID')}) — stopping here, session saved`);
      return { done: false, summary: 'budget reached', steps: step - 1, spent };
    }
    pruneImages(messages);
    const { text, toolCalls, usage } = await chat({ model: o.model, messages, tools: specs, temperature: 0.6, usageFile: o.usageFile, tag: `${o.tag} ${step}` });
    spent += costRp(o.model, usage);
    messages.push({ role: 'assistant', content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
    if (text.trim()) {
      console.log(`  ${o.tag} ${step}: ${short(text, 140)}`);
      appendFileSync(logFile, `**${step}** ${text.trim()}\n\n`);
    }
    if (!toolCalls.length) {
      if (++nudges > 2) break;
      messages.push({ role: 'user', content: 'Keep going with the tools. When the film is done and you have looked at rendered frames of both aspects, call `finish`.' });
      writeFileSync(sessionFile, JSON.stringify(messages));
      continue;
    }
    const images: Part[] = [];
    let done: string | null = null;
    for (const c of toolCalls) {
      const tool = o.tools.find((t) => t.name === c.function.name);
      let res: ToolResult;
      try {
        const args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
        res = tool ? await tool.run(args) : { text: `unknown tool "${c.function.name}"` };
      } catch (e) {
        res = { text: `tool error: ${e instanceof Error ? e.message : String(e)}` };
      }
      console.log(`  ${o.tag} ${step} ▸ ${c.function.name}: ${short(res.text, 120)}`);
      appendFileSync(logFile, `- \`${c.function.name}\` ${short(c.function.arguments, 200)} → ${short(res.text, 300)}\n`);
      messages.push({ role: 'tool', tool_call_id: c.id, content: res.text });
      for (const img of res.images ?? []) {
        images.push({ type: 'text', text: img.label });
        images.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${readFileSync(img.file).toString('base64')}` } });
      }
      if (res.done) done = res.text;
    }
    if (images.length) messages.push({ role: 'user', content: [{ type: 'text', text: 'Frames rendered by your last tool call:' }, ...images] });
    writeFileSync(sessionFile, JSON.stringify(messages));
    if (done) return { done: true, summary: done, steps: step, spent };
  }
  return { done: false, summary: 'step budget reached', steps: o.maxSteps, spent };
};
