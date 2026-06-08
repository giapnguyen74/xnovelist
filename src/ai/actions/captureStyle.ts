import { Action, ToolContext, CaptureInput, ProposalResult, WriteOpProposal } from '../types';
import { buildPrompt } from '../prompts/buildPrompt';
import { extractJson } from '../llm/parseJson';

const ALLOWED_PATHS = new Set([
  'rhythm.avgSentenceLengthHint',
  'rhythm.paragraphLengthHint',
  'rhythm.rhythmNotes',
  'diction.register',
  'dialogue.registerNotes',
  'narrativeRegister.interiority',
]);

export const captureStyle: Action<CaptureInput> = {
  id: 'capture_style',
  label: 'Capture style',
  description: 'Read the passage and propose Story Bible style notes.',
  level: 1,
  scope: 'selection',
  allow: ['style_set'],
  async propose(input, ctx): Promise<ProposalResult> {
    const prose = input.selection?.text || '';
    if (!prose.trim()) {
      throw new Error('Select some prose first.');
    }

    const { system, user } = buildPrompt('capture_style', { prose }, ctx.lang);

    let res = await ctx.callModel({ system, user, temperature: 0.6, thinking: 'low' });
    let parsed = extractJson<{ fields: unknown[] }>(res.text);

    if (!parsed || !Array.isArray(parsed.fields)) {
      const repair = await ctx.callModel({
        system,
        user: `${user}\n\nYour previous reply was not valid JSON in the required shape. Return ONLY the JSON object now.`,
        temperature: 0.2,
        thinking: 'low',
      });
      res = repair;
      parsed = extractJson<{ fields: unknown[] }>(repair.text);
    }

    if (!parsed || !Array.isArray(parsed.fields)) {
      throw new Error('Capture failed — the model did not return usable JSON.');
    }

    const list: WriteOpProposal[] = [];
    for (const rawItem of parsed.fields) {
      const f = rawItem as Record<string, unknown> | null;
      if (!f || typeof f.path !== 'string' || !ALLOWED_PATHS.has(f.path)) continue;
      if (typeof f.value !== 'string' || !f.value.trim()) continue;

      list.push({
        op: 'style_set',
        args: {
          path: f.path,
          label: typeof f.label === 'string' && f.label.trim() ? f.label : f.path,
          value: f.value.trim(),
        },
      });
    }

    return { type: 'proposals', list };
  },
};
