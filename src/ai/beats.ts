/**
 * Deterministically strips any beat anchor tokens (e.g. :::beat{ID}) from text.
 * Used to prevent the model from seeing or echoing beat tokens in prompt context
 * and ensuring word counts and token estimations are accurate.
 */
export function stripBeatTokens(text: string): string {
  if (!text) return '';
  // Match :::beat{ID} token patterns.
  return text.replace(/:::beat\{[^}]+\}/g, '');
}
