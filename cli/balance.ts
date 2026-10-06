// Vikey reserves max_tokens × output price up front. A request that asks for an absurd reservation is refused before
// anything runs, and the refusal states the available balance — a free balance check.
import { cfg } from './env';

export const getBalance = async (): Promise<number | null> => {
  if (!cfg.vikeyKey) return null;
  try {
    const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.vikeyKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.verifier, max_tokens: 50_000_000, messages: [{ role: 'user', content: 'hi' }] }),
      signal: AbortSignal.timeout(30_000),
    });
    const t = await r.text();
    const m = /Available:\s*Rp\s*([\d.,]+)/i.exec(t);
    return m ? Number(m[1].replace(/,/g, '')) : null;
  } catch {
    return null;
  }
};

/** refuse to start a run the balance can't finish (each Opus request also needs ≈Rp9–10k reserved up front) */
export const requireBalance = async (neededRp: number, what: string) => {
  const b = await getBalance();
  if (b === null) return;
  const reserve = 11000;
  if (b < neededRp + reserve) throw new Error(`Vikey balance Rp${Math.round(b).toLocaleString('id-ID')} is too low for ${what} (≈Rp${neededRp.toLocaleString('id-ID')} + Rp${reserve.toLocaleString('id-ID')} reserve for the up-front hold). Top up first.`);
  console.log(`  balance Rp${Math.round(b).toLocaleString('id-ID')} — ok for ${what}`);
};
