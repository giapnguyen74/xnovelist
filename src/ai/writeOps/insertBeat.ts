import { WriteOp, ToolContext } from '../types';
import { z } from 'zod';

const insertBeatArgsSchema = z.object({
  chapterId: z.string(),
  beatId: z.string(),
  text: z.string(),
  mode: z.enum(['write_beat', 'continue']),
  type: z.string().optional(),
  length: z.number().optional(),
  intent: z.string().optional(),
});

type InsertBeatArgs = z.infer<typeof insertBeatArgsSchema>;

export const insertBeatOp: WriteOp<InsertBeatArgs> = {
  id: 'insert_beat',
  level: 3,
  validate(args) {
    const res = insertBeatArgsSchema.safeParse(args);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, value: res.data };
  },
  describe(args) {
    return {
      title: 'Insert beat',
      preview: args.text,
      kind: 'edit',
    };
  },
  async execute(args, ctx: ToolContext) {
    if (ctx.onInsertBeat) {
      await ctx.onInsertBeat(args.chapterId, args.beatId, args.text, {
        mode: args.mode,
        type: args.type,
        length: args.length,
        intent: args.intent,
      });
    }
  },
};
