/**
 * Cheap off-topic detector: Jaccard similarity over token bigrams. Below the
 * threshold the output is treated as unrelated to the input. Local, no LLM.
 * Consumed by Level 2+ tools; built here so it's ready when they land.
 */

function bigrams(text: string): Set<string> {
  const tokens = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  const set = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    set.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return set;
}

export function jaccardBigram(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function isOffTopic(input: string, output: string, threshold = 0.15): boolean {
  return jaccardBigram(input, output) < threshold;
}
