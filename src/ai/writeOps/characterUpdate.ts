import { WriteOp, ToolContext } from '../types';
import { Character } from '../../storage/schemas';
import { z } from 'zod';

const evidenceSchema = z.object({
  chapterId: z.string(),
  quote: z.string(),
  addedAt: z.number(),
});

const characterUpdateArgsSchema = z.object({
  id: z.string(),
  name: z.string(),
  changes: z.object({
    aliases: z.array(z.string()).optional(),
    role: z.string().optional(),
    traits: z.array(z.string()).optional(),
    desires: z.array(z.string()).optional(),
    fears: z.array(z.string()).optional(),
    speechPatterns: z.string().optional(),
    notes: z.string().optional(),
    evidence: z.array(evidenceSchema).optional(),
  }),
});

type CharacterUpdateArgs = z.infer<typeof characterUpdateArgsSchema>;

const union = (a: string[] = [], b: string[] = []) => Array.from(new Set([...a, ...b]));

export const characterUpdate: WriteOp<CharacterUpdateArgs> = {
  id: 'character_update',
  level: 1,
  validate(args) {
    const res = characterUpdateArgsSchema.safeParse(args);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, value: res.data as CharacterUpdateArgs };
  },
  describe(args) {
    const changes = args.changes;
    const items: string[] = [];
    if (changes.role) items.push(`Role: ${changes.role}`);
    if (changes.traits?.length) items.push(`Traits: +${changes.traits.join(', ')}`);
    if (changes.aliases?.length) items.push(`Aliases: +${changes.aliases.join(', ')}`);
    return {
      title: `Update Character: ${args.name}`,
      preview: items.join(' · ') || 'Update character fields.',
      kind: 'update',
    };
  },
  async execute(args, ctx) {
    let list: Character[] = [];
    try {
      const raw = await ctx.storage.readFile(`${ctx.prefix}Characters.json`);
      if (raw) {
        list = (JSON.parse(raw).characters || []) as Character[];
      }
    } catch {
      // ignore
    }

    const { id, changes } = args;
    list = list.map((c) => {
      if (c.id !== id) return c;
      return {
        ...c,
        aliases: union(c.aliases, changes.aliases),
        role: c.role || changes.role,
        traits: union(c.traits, changes.traits),
        desires: union(c.desires, changes.desires),
        fears: union(c.fears, changes.fears),
        speechPatterns: c.speechPatterns || changes.speechPatterns,
        notes: c.notes || changes.notes,
        evidence: [...(c.evidence || []), ...(changes.evidence || [])],
      };
    });

    await ctx.storage.writeFile(
      `${ctx.prefix}Characters.json`,
      JSON.stringify({ schemaVersion: 1, characters: list })
    );

    if (ctx.onUpdateCharacters) {
      ctx.onUpdateCharacters(list);
    }
  },
};
