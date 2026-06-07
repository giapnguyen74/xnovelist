import { Action, ToolContext, CheckContinuityInput, ProposalResult, ReportItem } from '../types';
import { buildPrompt } from '../prompts/buildPrompt';
import { extractJson } from '../llm/parseJson';
import { Character, Location } from '../../storage/schemas';

const SEVERITIES = ['high', 'medium', 'low'];

async function readBibleContext(ctx: ToolContext): Promise<string> {
  const parts: string[] = [];
  try {
    const c = await ctx.storage.readFile(`${ctx.prefix}Characters.json`);
    if (c) {
      const chars = (JSON.parse(c).characters || []) as Character[];
      if (chars.length) {
        parts.push(
          'CHARACTERS:\n' +
            chars
              .map((x) => `- ${x.name}${x.role ? ` (${x.role})` : ''}${x.traits?.length ? `: ${x.traits.join(', ')}` : ''}`)
              .join('\n')
        );
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const l = await ctx.storage.readFile(`${ctx.prefix}Locations.json`);
    if (l) {
      const locs = (JSON.parse(l).locations || []) as Location[];
      if (locs.length) {
        parts.push(
          'LOCATIONS:\n' +
            locs.map((x) => `- ${x.name} (${x.scale})${x.significance ? `: ${x.significance}` : ''}`).join('\n')
        );
      }
    }
  } catch {
    /* ignore */
  }
  return parts.join('\n\n');
}

export const checkContinuity: Action<CheckContinuityInput> = {
  id: 'check_continuity',
  label: 'Check continuity',
  description: 'Flag statements in the chapter that contradict the Story Bible.',
  level: 1,
  scope: 'chapter',
  allow: [], // Reports don't create side-effect write-ops
  async propose(input, ctx): Promise<ProposalResult> {
    const chapterId = input.chapterId || ctx.project.activeChapterId;
    const md = (await ctx.storage.readFile(`${ctx.prefix}Artifacts/chapter-${chapterId}.md`)) || '';
    if (!md.trim()) {
      throw new Error('This chapter is empty — nothing to check.');
    }

    const bible = await readBibleContext(ctx);

    // Resolve preceding chapter continuity
    const activeIdx = ctx.chapterOrder.indexOf(chapterId);
    let precedingContinuity = '';
    if (activeIdx > 0) {
      const prevId = ctx.chapterOrder[activeIdx - 1];
      try {
        precedingContinuity = (await ctx.storage.readFile(`${ctx.prefix}Continuity/chapter-${prevId}.md`)) || '';
      } catch {
        // ignore
      }
    }

    const contextParts: string[] = [];
    if (bible.trim()) {
      contextParts.push(`STORY BIBLE:\n${bible.trim()}`);
    }
    if (precedingContinuity.trim()) {
      contextParts.push(`PRECEDING CHAPTER'S CONTINUITY:\n${precedingContinuity.trim()}`);
    }

    if (contextParts.length === 0) {
      return { type: 'report', items: [] };
    }

    const context = contextParts.join('\n\n');
    const { system, user } = buildPrompt('check_continuity', { prose: md, context }, ctx.lang);

    let res = await ctx.callModel({ system, user, temperature: 0.3 });
    let parsed = extractJson<{ flags: unknown[] }>(res.text);

    if (!parsed || !Array.isArray(parsed.flags)) {
      const repair = await ctx.callModel({
        system,
        user: `${user}\n\nYour previous reply was not valid JSON in the required shape. Return ONLY the JSON object now.`,
        temperature: 0.2,
      });
      res = repair;
      parsed = extractJson<{ flags: unknown[] }>(repair.text);
    }

    if (!parsed || !Array.isArray(parsed.flags)) {
      throw new Error('Check failed — the model did not return usable JSON.');
    }

    const flags: ReportItem[] = [];
    for (const rawItem of parsed.flags) {
      const f = rawItem as Record<string, unknown> | null;
      if (!f || typeof f.statement !== 'string' || typeof f.conflict !== 'string') continue;
      const sev = typeof f.severity === 'string' ? f.severity : 'low';
      flags.push({
        severity: SEVERITIES.includes(sev) ? (sev as ReportItem['severity']) : 'low',
        statement: f.statement,
        conflict: f.conflict,
      });
    }

    return { type: 'report', items: flags };
  },
};
