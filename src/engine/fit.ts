// Real text measurement. Estimating width from character count is how cards end up with text "nabrak" the edge —
// wide display faces run 30–40 % wider than a 0.56em guess. Every big line of text goes through fitSize().
let ctx: CanvasRenderingContext2D | null = null;
const memo = new Map<string, number>();

export const textW = (text: string, family: string, weight: number, size: number, trackEm = 0) => {
  const key = `${family}|${weight}|${size}|${trackEm}|${text}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx!.font = `${weight} ${size}px "${family}"`;
  const w = ctx!.measureText(text).width + trackEm * size * Math.max(0, text.length - 1);
  memo.set(key, w);
  return w;
};

/** largest font size ≤ max that keeps `text` within maxW (never below min) */
export const fitSize = (text: string, family: string, weight: number, max: number, maxW: number, trackEm = 0, min = max * 0.45) => {
  const w = textW(text, family, weight, max, trackEm);
  if (w <= maxW) return max;
  return Math.max(min, Math.floor(max * (maxW / w) * 0.98));
};
