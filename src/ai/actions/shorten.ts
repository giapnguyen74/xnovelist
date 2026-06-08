import { Action, ToolContext, CaptureInput, ProposalResult } from '../types';
import { buildEditorPrompt } from '../prompts/buildPrompt';
import { checkNamesPreserved, checkPronounPattern } from '../checks/confidence';
import { isOffTopic } from '../checks/offtopic';

export const shorten: Action<CaptureInput> = {
  id: 'shorten',
  label: 'Shorten',
  description: 'Reduce word count to a target percentage while keeping events.',
  level: 2,
  scope: 'selection',
  params: [
    {
      name: 'target',
      label: 'Target %',
      type: 'number',
      default: 30,
    },
  ],
  allow: ['replace_range'],
  async propose(input, ctx): Promise<ProposalResult> {
    const selectionText = input.selection?.text || '';
    if (!selectionText.trim()) {
      throw new Error('Please select some text to shorten first.');
    }

    const beforeText = input.selection?.textBefore || '';
    const afterText = input.selection?.textAfter || '';
    const warnings: string[] = [];

    // Parse parameter
    const targetPercent = Number(input.params?.target ?? 30);
    const target = Math.max(20, Math.min(50, targetPercent));

    // Assembles prompt
    const { system, user } = await buildEditorPrompt(
      'shorten',
      {
        selectionText,
        beforeText,
        afterText,
        guidance: input.hint,
        params: { target },
      },
      ctx,
      warnings
    );

    // Call Model (medium temperature)
    const res = await ctx.callModel({ system, user, temperature: 0.5, thinking: 'off' });
    let text = res.text.trim();

    if (!text) {
      throw new Error('AI returned nothing — try again.');
    }

    // 1. Off-topic check
    if (isOffTopic(selectionText, text)) {
      throw new Error('AI returned an unrelated response — try again with more specific guidance, or rephrase your selection.');
    }

    // 2. Length policy: target % + 10% tolerance max
    const inputWords = selectionText.split(/\s+/).filter(Boolean).length;
    const maxWords = Math.max(3, Math.round(inputWords * ((target + 10) / 100)));
    const outputWords = text.split(/\s+/).filter(Boolean).length;
    if (outputWords > maxWords) {
      const words = text.split(/\s+/);
      text = words.slice(0, maxWords).join(' ') + ' ...';
      warnings.push(`AI returned ${outputWords} words; truncated to ${maxWords} to match your ${target}% target.`);
    }

    // 3. Names preserved check
    try {
      const rawChars = await ctx.storage.readFile(`${ctx.prefix}Characters.json`);
      const rawLocs = await ctx.storage.readFile(`${ctx.prefix}Locations.json`);
      const chars = rawChars ? JSON.parse(rawChars).characters || [] : [];
      const locs = rawLocs ? JSON.parse(rawLocs).locations || [] : [];
      
      const charNames = chars.flatMap((c: { name?: string; aliases?: string[] }) => [c.name, ...(c.aliases || [])]).filter(Boolean);
      const locNames = locs.flatMap((l: { name?: string; aliases?: string[] }) => [l.name, ...(l.aliases || [])]).filter(Boolean);

      const charWarnings = checkNamesPreserved(charNames, selectionText, text, 'character');
      const locWarnings = checkNamesPreserved(locNames, selectionText, text, 'location');
      warnings.push(...charWarnings, ...locWarnings);
    } catch {
      // ignore check error
    }

    // 4. Pronoun pattern preserved check
    const pronounWarning = checkPronounPattern(selectionText, text);
    if (pronounWarning) {
      warnings.push(pronounWarning);
    }

    return {
      type: 'proposals',
      list: [
        {
          op: 'replace_range',
          args: {
            chapterId: input.chapterId,
            from: input.selection.from,
            to: input.selection.to,
            text: text,
            expected: selectionText,
          },
        },
      ],
    };
  },
};
