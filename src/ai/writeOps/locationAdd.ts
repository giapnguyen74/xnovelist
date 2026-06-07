import { WriteOp, ToolContext } from '../types';
import { LocationSchema, Location } from '../../storage/schemas';
import { z } from 'zod';

const locationAddArgsSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()).optional(),
  scale: z.enum(['room', 'building', 'district', 'city', 'region', 'world']).default('room'),
  descriptors: z.array(z.string()).optional(),
  significance: z.string().optional(),
  notes: z.string().optional(),
});

type LocationAddArgs = z.infer<typeof locationAddArgsSchema>;

export const locationAdd: WriteOp<LocationAddArgs> = {
  id: 'location_add',
  level: 1,
  validate(args) {
    const res = locationAddArgsSchema.safeParse(args);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, value: res.data };
  },
  describe(args) {
    return {
      title: `Add Location: ${args.name}`,
      preview: [
        args.scale ? `Scale: ${args.scale}` : '',
        args.significance ? `Significance: ${args.significance}` : '',
        args.descriptors?.length ? `Descriptors: ${args.descriptors.join(', ')}` : '',
      ].filter(Boolean).join(' · ') || 'No details provided.',
      kind: 'addition',
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

    const uid = `loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newLoc = LocationSchema.parse({
      id: uid,
      name: args.name.trim(),
      aliases: args.aliases || [],
      scale: args.scale || 'room',
      descriptors: args.descriptors || [],
      significance: args.significance || '',
      inhabitants: [],
      notes: args.notes || '',
      evidence: [],
    });

    list.push(newLoc);

    await ctx.storage.writeFile(
      `${ctx.prefix}Locations.json`,
      JSON.stringify({ schemaVersion: 1, locations: list })
    );

    if (ctx.onUpdateLocations) {
      ctx.onUpdateLocations(list);
    }
  },
};
