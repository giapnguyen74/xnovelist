import { Action, ToolContext, SummarizeChapterInput, ProposalResult } from '../types';
import { buildPrompt } from '../prompts/buildPrompt';

export const summarizeChapter: Action<SummarizeChapterInput> = {
  id: 'summarize_chapter',
  label: 'Summarize chapter',
  description: 'Propose a continuity summary for the active chapter.',
  level: 1,
  scope: 'chapter',
  allow: ['append_continuity'],
  async propose(input, ctx): Promise<ProposalResult> {
    const chapterId = input.chapterId || ctx.project.activeChapterId;
    const md = (await ctx.storage.readFile(`${ctx.prefix}Artifacts/chapter-${chapterId}.md`)) || '';
    if (!md.trim()) {
      throw new Error('This chapter is empty — nothing to summarize.');
    }

    const { system, user } = buildPrompt('summarize_chapter', { prose: md }, ctx.lang);

    const res = await ctx.callModel({ system, user, temperature: 0.4 });
    const text = res.text.trim();
    if (!text) {
      throw new Error('AI returned nothing — try again.');
    }

    return {
      type: 'text',
      text: text,
      suggestedOp: {
        op: 'append_continuity',
        args: {
          chapterId,
          text: text,
        },
      },
    };
  },
};
