import { WriteOp, ToolContext, StyleFieldDelta } from '../types';
import { StyleSchema, Style } from '../../storage/schemas';
import { z } from 'zod';

const styleSetArgsSchema = z.object({
  path: z.string(),
  label: z.string(),
  value: z.string(),
});

export const styleSet: WriteOp<StyleFieldDelta> = {
  id: 'style_set',
  level: 1,
  validate(args) {
    const res = styleSetArgsSchema.safeParse(args);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, value: res.data as StyleFieldDelta };
  },
  describe(args) {
    return {
      title: `Set Style: ${args.label}`,
      preview: `Set ${args.path} to "${args.value}"`,
      kind: 'edit',
    };
  },
  async execute(args, ctx) {
    let currentStyle: Style = StyleSchema.parse({ schemaVersion: 1 });
    try {
      const raw = await ctx.storage.readFile(`${ctx.prefix}Style.json`);
      if (raw) {
        currentStyle = JSON.parse(raw) as Style;
      }
    } catch {
      // ignore
    }

    const next = JSON.parse(JSON.stringify(currentStyle)) as Record<string, unknown>;
    const segs = String(args.path).split('.');
    let cur = next;
    for (let i = 0; i < segs.length - 1; i++) {
      if (!cur[segs[i]] || typeof cur[segs[i]] !== 'object') {
        cur[segs[i]] = {};
      }
      cur = cur[segs[i]] as Record<string, unknown>;
    }
    cur[segs[segs.length - 1]] = args.value;

    const parsedStyle = StyleSchema.parse(next);

    await ctx.storage.writeFile(
      `${ctx.prefix}Style.json`,
      JSON.stringify(parsedStyle, null, 2)
    );

    if (ctx.onUpdateStyle) {
      ctx.onUpdateStyle(parsedStyle);
    }
  },
};
