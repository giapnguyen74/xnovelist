import { Action, ToolContext, BeatInput, ProposalResult } from '../types';
import { buildEditorPrompt } from '../prompts/buildPrompt';

export const continueBeat: Action<BeatInput> = {
  id: 'continue',
  label: 'Continue',
  description: 'Seamlessly continue writing the next prose segment.',
  level: 3,
  scope: 'selection',
  params: [
    {
      name: 'length',
      label: 'Target Length',
      type: 'number',
      default: 400,
    },
  ],
  allow: ['insert_beat'],
  async propose(input, ctx: ToolContext): Promise<ProposalResult> {
    const length = input.params?.length || '400';
    const warnings: string[] = [];

    const { system, user } = await buildEditorPrompt(
      'continue',
      {
        selectionText: '',
        beforeText: input.beforeText || '',
        afterText: input.afterText || '',
        guidance: '',
        params: { length },
      },
      ctx,
      warnings
    );

    const res = await ctx.callModel({ system, user, temperature: 0.7 });
    let text = res.text.trim();
    if (!text) {
      throw new Error('AI returned nothing — try again.');
    }

    // Length policy: soft-truncate at a paragraph/sentence boundary
    const targetLength = parseInt(String(length), 10);
    const words = text.split(/\s+/).filter(Boolean);
    const maxWords = Math.round(targetLength * 1.20);

    if (words.length > maxWords) {
      const truncatedWords = words.slice(0, maxWords);
      let truncatedText = truncatedWords.join(' ');
      const lastPunctuation = Math.max(
        truncatedText.lastIndexOf('.'),
        truncatedText.lastIndexOf('?'),
        truncatedText.lastIndexOf('!')
      );
      if (lastPunctuation > truncatedText.length * 0.8) {
        truncatedText = truncatedText.slice(0, lastPunctuation + 1);
      } else {
        truncatedText += ' ...';
      }
      text = truncatedText;
      warnings.push(`Prose truncated to match length policy (~${maxWords} words).`);
    }

    return {
      type: 'proposals',
      list: [
        {
          op: 'insert_beat',
          args: {
            chapterId: input.chapterId,
            beatId: input.beatId,
            text: text,
            mode: 'continue' as const,
            length: parseInt(String(length), 10),
            intent: input.hint || '',
          },
        },
      ],
    };
  },
};
