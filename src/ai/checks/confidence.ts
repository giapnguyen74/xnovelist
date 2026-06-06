/**
 * Local, no-LLM confidence checks for prose proposals (Level 2+). Built here so
 * the Level 2 polish tools can consume them when they land. Each check returns a
 * warning string or null.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appears(name: string, text: string): boolean {
  if (!name.trim()) return false;
  const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i');
  return re.test(text);
}

/** Every named entity present in the input must also be present in the output. */
export function checkNamesPreserved(
  names: string[],
  input: string,
  output: string,
  kind: 'character' | 'location'
): string[] {
  const warnings: string[] = [];
  for (const name of names) {
    if (appears(name, input) && !appears(name, output)) {
      warnings.push(`AI output drops a ${kind} name: ${name}.`);
    }
  }
  return warnings;
}

const PRONOUNS = ['he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them', 'their', 'i', 'me', 'my'];

function dominantPronoun(text: string): string | null {
  const counts: Record<string, number> = {};
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  for (const w of words) if (PRONOUNS.includes(w)) counts[w] = (counts[w] || 0) + 1;
  let best: string | null = null;
  let max = 0;
  for (const [p, c] of Object.entries(counts)) {
    if (c > max) {
      max = c;
      best = p;
    }
  }
  return best;
}

/** Flag if the dominant pronoun set shifts between input and output. */
export function checkPronounPattern(input: string, output: string): string | null {
  const a = dominantPronoun(input);
  const b = dominantPronoun(output);
  if (a && b && a !== b) return 'AI output changes the dominant pronoun set.';
  return null;
}
