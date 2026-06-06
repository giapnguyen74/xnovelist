import en from './packs/en.json';
import vi from './packs/vi.json';

type Pack = typeof en;

const PACKS: Record<string, Pack> = { en, vi: vi as Pack };

export function loadPromptPack(lang: string): Pack {
  return PACKS[lang] ?? PACKS.en;
}

export interface PromptParts {
  /** The prose the tool operates on (a selection or a whole chapter). */
  prose: string;
  /** Optional context blocks appended after the action, before the prose. */
  context?: string;
}

/**
 * Assemble a {system, user} pair for a Level 1 tool. The block order follows
 * docs/AI.md §"Prompt architecture", trimmed to what Level 1 tools need:
 * system preamble · action instruction · context · prose · output reminder.
 */
export function buildPrompt(
  toolId: keyof Pack['tools'],
  parts: PromptParts,
  lang: string
): { system: string; user: string } {
  const pack = loadPromptPack(lang);
  const tool = pack.tools[toolId];
  if (!tool) throw new Error(`No prompt block for tool ${String(toolId)} in pack ${lang}`);

  const segments: string[] = [tool.action];
  if (parts.context && parts.context.trim()) {
    segments.push(parts.context.trim());
  }
  segments.push('--- TEXT ---\n' + parts.prose.trim());
  segments.push(tool.outputFormat);

  return { system: pack.system, user: segments.join('\n\n') };
}
