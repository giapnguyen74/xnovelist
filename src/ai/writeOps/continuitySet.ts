import { WriteOp, ToolContext } from '../types';
import { deriveSynopsis } from '../continuity';
import { z } from 'zod';

const continuitySetArgsSchema = z.object({
  chapterId: z.string(),
  /** Full markdown content that replaces the continuity document. */
  text: z.string(),
});

type ContinuitySetArgs = z.infer<typeof continuitySetArgsSchema>;

export const continuitySet: WriteOp<ContinuitySetArgs> = {
  id: 'continuity_set',
  level: 1,
  validate(args) {
    const res = continuitySetArgsSchema.safeParse(args);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, value: res.data };
  },
  describe(args) {
    const preview = deriveSynopsis(args.text, 100);
    return {
      title: 'Set Chapter Continuity',
      preview: preview || 'Replace the chapter continuity document.',
      kind: 'edit',
    };
  },
  async execute(args, ctx: ToolContext) {
    const filePath = `${ctx.prefix}Continuity/chapter-${args.chapterId}.md`;
    await ctx.storage.writeFile(filePath, args.text.trim());

    // Refresh the synopsis cache and propagate to React state
    if (ctx.onUpdateContinuity) {
      await ctx.onUpdateContinuity(args.chapterId, args.text.trim());
    }
  },
};
