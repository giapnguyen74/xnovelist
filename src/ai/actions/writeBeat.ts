import { Action, ToolContext, BeatInput, ProposalResult } from '../types';
import { buildEditorPrompt } from '../prompts/buildPrompt';

export const writeBeat: Action<BeatInput> = {
  id: 'write_beat',
  label: 'Write Beat',
  description: 'Generate prose for the outlined beat in place.',
  level: 3,
  scope: 'selection',
  params: [
    {
      name: 'type',
      label: 'Beat Type',
      type: 'choice',
      choices: ['action', 'reaction', 'dialogue', 'realization', 'decision', 'transition'],
      default: 'action',
    },
    {
      name: 'length',
      label: 'Target Length',
      type: 'choice',
      choices: ['200', '400', '600'],
      default: '400',
    },
  ],
  allow: ['insert_beat'],
  async propose(input, ctx: ToolContext): Promise<ProposalResult> {
    const intent = input.hint || '';
    if (!intent.trim()) {
      throw new Error('Please outline the beat intent first.');
    }

    const type = input.params?.type || 'action';
    const length = input.params?.length || '400';
    const warnings: string[] = [];

    const { system, user } = await buildEditorPrompt(
      'write_beat',
      {
        selectionText: '',
        beforeText: input.beforeText || '',
        afterText: input.afterText || '',
        guidance: intent,
        params: { type, length },
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
            mode: 'write_beat' as const,
            type: String(type),
            length: parseInt(String(length), 10),
            intent: intent,
          },
        },
      ],
    };
  },
};
