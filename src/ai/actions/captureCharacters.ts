import { Action, ToolContext, CaptureInput, ProposalResult, WriteOpProposal, CharacterDraft } from '../types';
import { buildPrompt } from '../prompts/buildPrompt';
import { extractJson } from '../llm/parseJson';
import { Character } from '../../storage/schemas';

async function readBibleNames(ctx: ToolContext): Promise<Character[]> {
  try {
    const raw = await ctx.storage.readFile(`${ctx.prefix}Characters.json`);
    if (!raw) return [];
    return (JSON.parse(raw).characters || []) as Character[];
  } catch {
    return [];
  }
}

export const captureCharacters: Action<CaptureInput> = {
  id: 'capture_characters',
  label: 'Capture characters',
  description: 'Pull characters named in the passage into the Story Bible.',
  level: 1,
  scope: 'selection',
  allow: ['character_add', 'character_update'],
  async propose(input, ctx): Promise<ProposalResult> {
    const prose = input.selection?.text || '';
    if (!prose.trim()) {
      throw new Error('Select some prose first.');
    }

    const existing = await readBibleNames(ctx);
    const context = existing.length
      ? `Characters already in the bible (do not duplicate, propose updates instead): ${existing
          .map((c) => c.name)
          .join(', ')}.`
      : undefined;

    const { system, user } = buildPrompt('capture_characters', { prose, context }, ctx.lang);

    let res = await ctx.callModel({ system, user, temperature: 0.6 });
    let parsed = extractJson<{ characters: unknown[] }>(res.text);

    if (!parsed || !Array.isArray(parsed.characters)) {
      const repair = await ctx.callModel({
        system,
        user: `${user}\n\nYour previous reply was not valid JSON in the required shape. Return ONLY the JSON object now.`,
        temperature: 0.2,
      });
      res = repair;
      parsed = extractJson<{ characters: unknown[] }>(repair.text);
    }

    if (!parsed || !Array.isArray(parsed.characters)) {
      throw new Error('Capture failed — the model did not return usable JSON.');
    }

    const existingByName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
    const list: WriteOpProposal[] = [];

    const quote = prose;
    const addedAt = Date.now();
    const evidenceItem = quote.trim() ? [{ chapterId: input.chapterId, quote, addedAt }] : [];

    for (const rawItem of parsed.characters) {
      const c = rawItem as Record<string, unknown> | null;
      if (!c || typeof c.name !== 'string' || !c.name.trim()) continue;
      
      const draft: CharacterDraft & { evidence: typeof evidenceItem } = {
        name: c.name.trim(),
        aliases: Array.isArray(c.aliases) ? c.aliases.filter((x): x is string => typeof x === 'string') : [],
        role: typeof c.role === 'string' ? c.role : undefined,
        traits: Array.isArray(c.traits) ? c.traits.filter((x): x is string => typeof x === 'string') : [],
        desires: Array.isArray(c.desires) ? c.desires.filter((x): x is string => typeof x === 'string') : [],
        fears: Array.isArray(c.fears) ? c.fears.filter((x): x is string => typeof x === 'string') : [],
        speechPatterns: typeof c.speechPatterns === 'string' ? c.speechPatterns : undefined,
        notes: typeof c.notes === 'string' ? c.notes : undefined,
        evidence: evidenceItem,
      };

      const match = existingByName.get(draft.name.toLowerCase());
      if (match) {
        list.push({
          op: 'character_update',
          args: { id: match.id, name: match.name, changes: draft },
        });
      } else {
        list.push({
          op: 'character_add',
          args: draft,
        });
      }
    }

    return { type: 'proposals', list };
  },
};
