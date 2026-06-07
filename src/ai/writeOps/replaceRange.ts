import { WriteOp, ToolContext } from '../types';
import { z } from 'zod';

const replaceRangeArgsSchema = z.object({
  chapterId: z.string(),
  from: z.number(),
  to: z.number(),
  text: z.string(),
  expected: z.string().optional(),
});

type ReplaceRangeArgs = z.infer<typeof replaceRangeArgsSchema>;

export const replaceRangeOp: WriteOp<ReplaceRangeArgs> = {
  id: 'replace_range',
  level: 2,
  validate(args) {
    const res = replaceRangeArgsSchema.safeParse(args);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, value: res.data };
  },
  describe(args) {
    return {
      title: 'Replace range',
      preview: args.text,
      kind: 'edit',
    };
  },
  async execute(args, ctx: ToolContext) {
    if (ctx.onReplaceRange) {
      await ctx.onReplaceRange(args.chapterId, args.from, args.to, args.text, args.expected);
    }
  },
};
