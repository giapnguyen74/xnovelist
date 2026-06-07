import { WriteOp, ToolContext } from '../types';
import { z } from 'zod';

const appendContinuityArgsSchema = z.object({
  chapterId: z.string(),
  text: z.string(),
});

type AppendContinuityArgs = z.infer<typeof appendContinuityArgsSchema>;

export const appendContinuity: WriteOp<AppendContinuityArgs> = {
  id: 'append_continuity',
  level: 1,
  validate(args) {
    const res = appendContinuityArgsSchema.safeParse(args);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, value: res.data as AppendContinuityArgs };
  },
  describe(args) {
    return {
      title: 'Append Continuity Note',
      preview: args.text.length > 120 ? `${args.text.slice(0, 117)}...` : args.text,
      kind: 'edit',
    };
  },
  async execute(args, ctx: ToolContext) {
    const filePath = `${ctx.prefix}Continuity/chapter-${args.chapterId}.md`;
    let existing = '';
    try {
      existing = (await ctx.storage.readFile(filePath)) || '';
    } catch {
      // ignore — file may not exist yet
    }

    const merged = existing.trim()
      ? `${existing.trim()}\n\n${args.text.trim()}`
      : args.text.trim();

    await ctx.storage.writeFile(filePath, merged);

    // Refresh synopsis cache on the page side via onUpdateContinuity.
    if (ctx.onUpdateContinuity) {
      await ctx.onUpdateContinuity(args.chapterId, merged);
    }
  },
};
