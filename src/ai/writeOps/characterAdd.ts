import { WriteOp, ToolContext } from '../types';
import { CharacterSchema, Character } from '../../storage/schemas';
import { z } from 'zod';

const characterAddArgsSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()).optional(),
  role: z.string().optional(),
  traits: z.array(z.string()).optional(),
  desires: z.array(z.string()).optional(),
  fears: z.array(z.string()).optional(),
  speechPatterns: z.string().optional(),
  notes: z.string().optional(),
});

type CharacterAddArgs = z.infer<typeof characterAddArgsSchema>;

export const characterAdd: WriteOp<CharacterAddArgs> = {
  id: 'character_add',
  level: 1,
  validate(args) {
    const res = characterAddArgsSchema.safeParse(args);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, value: res.data };
  },
  describe(args) {
    return {
      title: `Add Character: ${args.name}`,
      preview: [
        args.role ? `Role: ${args.role}` : '',
        args.traits?.length ? `Traits: ${args.traits.join(', ')}` : '',
        args.aliases?.length ? `Aliases: ${args.aliases.join(', ')}` : '',
      ].filter(Boolean).join(' · ') || 'No details provided.',
      kind: 'addition',
    };
  },
  async execute(args, ctx: ToolContext) {
    let list: Character[] = [];
    try {
      const raw = await ctx.storage.readFile(`${ctx.prefix}Characters.json`);
      if (raw) {
        list = (JSON.parse(raw).characters || []) as Character[];
      }
    } catch {
      // ignore
    }

    const uid = `char-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newChar = CharacterSchema.parse({
      id: uid,
      name: args.name.trim(),
      aliases: args.aliases || [],
      role: args.role || '',
      traits: args.traits || [],
      desires: args.desires || [],
      fears: args.fears || [],
      speechPatterns: args.speechPatterns || '',
      relationships: [],
      notes: args.notes || '',
      evidence: [],
    });

    list.push(newChar);

    await ctx.storage.writeFile(
      `${ctx.prefix}Characters.json`,
      JSON.stringify({ schemaVersion: 1, characters: list })
    );

    if (ctx.onUpdateCharacters) {
      ctx.onUpdateCharacters(list);
    }
  },
};
