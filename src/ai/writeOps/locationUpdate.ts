import { WriteOp, ToolContext } from '../types';
import { Location } from '../../storage/schemas';
import { z } from 'zod';

const locationUpdateArgsSchema = z.object({
  id: z.string(),
  name: z.string(),
  changes: z.object({
    aliases: z.array(z.string()).optional(),
    descriptors: z.array(z.string()).optional(),
    significance: z.string().optional(),
    notes: z.string().optional(),
  }),
});

type LocationUpdateArgs = z.infer<typeof locationUpdateArgsSchema>;

const union = (a: string[] = [], b: string[] = []) => Array.from(new Set([...a, ...b]));

export const locationUpdate: WriteOp<LocationUpdateArgs> = {
  id: 'location_update',
  level: 1,
  validate(args) {
    const res = locationUpdateArgsSchema.safeParse(args);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, value: res.data as LocationUpdateArgs };
  },
  describe(args) {
    const changes = args.changes;
    const items: string[] = [];
    if (changes.significance) items.push(`Significance: ${changes.significance}`);
    if (changes.descriptors?.length) items.push(`Descriptors: +${changes.descriptors.join(', ')}`);
    if (changes.aliases?.length) items.push(`Aliases: +${changes.aliases.join(', ')}`);
    return {
      title: `Update Location: ${args.name}`,
      preview: items.join(' · ') || 'Update location fields.',
      kind: 'update',
    };
  },
  async execute(args, ctx: ToolContext) {
    let list: Location[] = [];
    try {
      const raw = await ctx.storage.readFile(`${ctx.prefix}Locations.json`);
      if (raw) {
        list = (JSON.parse(raw).locations || []) as Location[];
      }
    } catch {
      // ignore
    }

    const { id, changes } = args;
    list = list.map((l) => {
      if (l.id !== id) return l;
      return {
        ...l,
        aliases: union(l.aliases, changes.aliases),
        descriptors: union(l.descriptors, changes.descriptors),
        significance: l.significance || changes.significance,
        notes: l.notes || changes.notes,
      };
    });

    await ctx.storage.writeFile(
      `${ctx.prefix}Locations.json`,
      JSON.stringify({ schemaVersion: 1, locations: list })
    );

    if (ctx.onUpdateLocations) {
      ctx.onUpdateLocations(list);
    }
  },
};
