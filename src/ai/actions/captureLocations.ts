import { Action, ToolContext, CaptureInput, ProposalResult, WriteOpProposal, LocationDraft } from '../types';
import { buildPrompt } from '../prompts/buildPrompt';
import { extractJson } from '../llm/parseJson';
import { Location } from '../../storage/schemas';

const SCALES = ['room', 'building', 'district', 'city', 'region', 'world'];

async function readBible(ctx: ToolContext): Promise<Location[]> {
  try {
    const raw = await ctx.storage.readFile(`${ctx.prefix}Locations.json`);
    if (!raw) return [];
    return (JSON.parse(raw).locations || []) as Location[];
  } catch {
    return [];
  }
}

export const captureLocations: Action<CaptureInput> = {
  id: 'capture_locations',
  label: 'Capture locations',
  description: 'Pull locations named in the passage into the Story Bible.',
  level: 1,
  scope: 'selection',
  allow: ['location_add', 'location_update'],
  async propose(input, ctx): Promise<ProposalResult> {
    const prose = input.selection?.text || '';
    if (!prose.trim()) {
      throw new Error('Select some prose first.');
    }

    const existing = await readBible(ctx);
    const context = existing.length
      ? `Locations already in the bible (do not duplicate, propose updates instead): ${existing
          .map((l) => l.name)
          .join(', ')}.`
      : undefined;

    const { system, user } = buildPrompt('capture_locations', { prose, context }, ctx.lang);

    let res = await ctx.callModel({ system, user, temperature: 0.6 });
    let parsed = extractJson<{ locations: unknown[] }>(res.text);

    if (!parsed || !Array.isArray(parsed.locations)) {
      const repair = await ctx.callModel({
        system,
        user: `${user}\n\nYour previous reply was not valid JSON in the required shape. Return ONLY the JSON object now.`,
        temperature: 0.2,
      });
      res = repair;
      parsed = extractJson<{ locations: unknown[] }>(repair.text);
    }

    if (!parsed || !Array.isArray(parsed.locations)) {
      throw new Error('Capture failed — the model did not return usable JSON.');
    }

    const existingByName = new Map(existing.map((l) => [l.name.toLowerCase(), l]));
    const list: WriteOpProposal[] = [];

    const quote = prose;
    const addedAt = Date.now();
    const evidenceItem = quote.trim() ? [{ chapterId: input.chapterId, quote, addedAt }] : [];

    for (const rawItem of parsed.locations) {
      const l = rawItem as Record<string, unknown> | null;
      if (!l || typeof l.name !== 'string' || !l.name.trim()) continue;
      
      const scaleStr = typeof l.scale === 'string' ? l.scale : 'room';
      const scale = SCALES.includes(scaleStr) ? scaleStr : 'room';
      const draft: LocationDraft & { evidence: typeof evidenceItem } = {
        name: l.name.trim(),
        aliases: Array.isArray(l.aliases) ? l.aliases.filter((x): x is string => typeof x === 'string') : [],
        scale: scale as Location['scale'],
        descriptors: Array.isArray(l.descriptors) ? l.descriptors.filter((x): x is string => typeof x === 'string') : [],
        significance: typeof l.significance === 'string' ? l.significance : undefined,
        notes: typeof l.notes === 'string' ? l.notes : undefined,
        evidence: evidenceItem,
      };

      const match = existingByName.get(draft.name.toLowerCase());
      if (match) {
        list.push({
          op: 'location_update',
          args: { id: match.id, name: match.name, changes: draft },
        });
      } else {
        list.push({
          op: 'location_add',
          args: draft,
        });
      }
    }

    return { type: 'proposals', list };
  },
};
