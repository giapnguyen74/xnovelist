import { Action, SummarizeChapterInput, ProposalResult } from '../types';
import { buildPrompt } from '../prompts/buildPrompt';
import { stripBeatTokens } from '../beats';

export const summarizeChapter: Action<SummarizeChapterInput> = {
  id: 'summarize_chapter',
  label: 'Summarize chapter',
  description: 'Propose a continuity summary for the active chapter.',
  level: 1,
  scope: 'chapter',
  allow: ['continuity_set'],
  async propose(input, ctx): Promise<ProposalResult> {
    const chapterId = input.chapterId || ctx.project.activeChapterId;
    const rawMd = (await ctx.storage.readFile(`${ctx.prefix}Artifacts/chapter-${chapterId}.md`)) || '';
    const md = stripBeatTokens(rawMd);
    if (!md.trim()) {
      throw new Error('This chapter is empty — nothing to summarize.');
    }

    // Resolve preceding chapter continuity
    const activeIdx = ctx.chapterOrder.indexOf(chapterId);
    const chapterN = activeIdx + 1;
    const chapter = ctx.project.chapters.find((c) => c.id === chapterId);
    const title = chapter ? chapter.title : '';

    let precedingContinuity = '';
    if (activeIdx > 0) {
      const prevId = ctx.chapterOrder[activeIdx - 1];
      try {
        precedingContinuity = (await ctx.storage.readFile(`${ctx.prefix}Continuity/chapter-${prevId}.md`)) || '';
      } catch {
        // ignore
      }
    }

    const contextParts: string[] = [
      `ACTIVE CHAPTER: Chapter ${chapterN} — ${title}`,
    ];
    if (precedingContinuity.trim()) {
      contextParts.push(`PRECEDING CHAPTER'S CONTINUITY:\n${precedingContinuity.trim()}`);
    }

    const { system, user } = buildPrompt(
      'summarize_chapter',
      { prose: md, context: contextParts.join('\n\n') },
      ctx.lang
    );

    const res = await ctx.callModel({ system, user, temperature: 0.4, thinking: 'medium' });
    const text = res.text.trim();
    if (!text) {
      throw new Error('AI returned nothing — try again.');
    }

    return {
      type: 'text',
      text: text,
      suggestedOp: {
        op: 'continuity_set',
        args: {
          chapterId,
          text: text,
        },
      },
    };
  },
};
