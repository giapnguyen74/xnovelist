import { Action, ToolContext, CaptureInput, ProposalResult } from '../types';
import { buildEditorPrompt } from '../prompts/buildPrompt';
import { checkNamesPreserved, checkPronounPattern } from '../checks/confidence';
import { isOffTopic } from '../checks/offtopic';

export const fixGrammar: Action<CaptureInput> = {
  id: 'fix_grammar',
  label: 'Fix Grammar',
  description: 'Correct spelling, grammar, and punctuation errors in place.',
  level: 2,
  scope: 'selection',
  allow: ['replace_range'],
  async propose(input, ctx): Promise<ProposalResult> {
    const selectionText = input.selection?.text || '';
    if (!selectionText.trim()) {
      throw new Error('Please select some text to fix first.');
    }

    const beforeText = input.selection?.textBefore || '';
    const afterText = input.selection?.textAfter || '';
    const warnings: string[] = [];

    // Assembles prompt
    const { system, user } = await buildEditorPrompt(
      'fix_grammar',
      {
        selectionText,
        beforeText,
        afterText,
        guidance: input.hint,
        params: input.params,
      },
      ctx,
      warnings
    );

    // Call Model (low temperature for grammar fixing)
    const res = await ctx.callModel({ system, user, temperature: 0.2 });
    let text = res.text.trim();

    if (!text) {
      throw new Error('AI returned nothing — try again.');
    }

    // 1. Off-topic check
    if (isOffTopic(selectionText, text)) {
      throw new Error('AI returned an unrelated response — try again with more specific guidance, or rephrase your selection.');
    }

    // 2. Length policy: ±5%
    const inputWords = selectionText.split(/\s+/).filter(Boolean).length;
    const maxWords = Math.max(5, Math.round(inputWords * 1.05));
    const outputWords = text.split(/\s+/).filter(Boolean).length;
    if (outputWords > maxWords) {
      const words = text.split(/\s+/);
      text = words.slice(0, maxWords).join(' ') + ' ...';
      warnings.push(`AI returned ${outputWords} words; truncated to ${maxWords} to match length policy.`);
    }

    // 3. Names preserved check
    try {
      const rawChars = await ctx.storage.readFile(`${ctx.prefix}Characters.json`);
      const rawLocs = await ctx.storage.readFile(`${ctx.prefix}Locations.json`);
      const chars = rawChars ? JSON.parse(rawChars).characters || [] : [];
      const locs = rawLocs ? JSON.parse(rawLocs).locations || [] : [];
      
      const charNames = chars.flatMap((c: any) => [c.name, ...(c.aliases || [])]).filter(Boolean);
      const locNames = locs.flatMap((l: any) => [l.name, ...(l.aliases || [])]).filter(Boolean);

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
