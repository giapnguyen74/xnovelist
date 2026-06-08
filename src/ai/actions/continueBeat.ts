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

    const res = await ctx.callModel({ system, user, temperature: 0.7, thinking: 'off' });
    const text = res.text.trim();
    if (!text) {
      throw new Error('AI returned nothing — try again.');
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
