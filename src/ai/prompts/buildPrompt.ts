import en from './packs/en.json';
import vi from './packs/vi.json';
import { Character, Location, Style } from '../../storage/schemas';
import { ToolContext } from '../types';

type Pack = typeof en;

const PACKS: Record<string, Pack> = { en, vi: vi as Pack };

export function loadPromptPack(lang: string): Pack {
  return PACKS[lang] ?? PACKS.en;
}

export interface PromptParts {
  /** The prose the tool operates on (a selection or a whole chapter). */
  prose: string;
  /** Optional context blocks appended after the action, before the prose. */
  context?: string;
}

/**
 * Assemble a {system, user} pair for a Level 1 tool. The block order follows
 * docs/AI.md §"Prompt architecture", trimmed to what Level 1 tools need:
 * system preamble · action instruction · context · prose · output reminder.
 */
export function buildPrompt(
  toolId: keyof Pack['tools'],
  parts: PromptParts,
  lang: string
): { system: string; user: string } {
  const pack = loadPromptPack(lang);
  const tool = pack.tools[toolId];
  if (!tool) throw new Error(`No prompt block for tool ${String(toolId)} in pack ${lang}`);

  const segments: string[] = [tool.action];
  if (parts.context && parts.context.trim()) {
    segments.push(parts.context.trim());
  }
  segments.push('--- TEXT ---\n' + parts.prose.trim());
  segments.push(tool.outputFormat);

  return { system: pack.system, user: segments.join('\n\n') };
}

// Helper to read Style from storage
async function getStyle(ctx: ToolContext): Promise<Style | null> {
  try {
    const str = await ctx.storage.readFile(`${ctx.prefix}Style.json`);
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
}

// Slice text to limit number of words
function getWordLimit(text: string, limit: number, direction: 'before' | 'after'): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/);
  if (words.length <= limit) return trimmed;
  if (direction === 'before') {
    return '... ' + words.slice(words.length - limit).join(' ');
  } else {
    return words.slice(0, limit).join(' ') + ' ...';
  }
}

// Formats style into a descriptive block
function formatStyleBlock(style: Style): string {
  const parts: string[] = [];
  parts.push("=== STYLE PROFILE ===");
  
  if (style.narrativeRegister) {
    const reg = style.narrativeRegister;
    parts.push(`Point of View: ${reg.pointOfView}`);
    parts.push(`Tense: ${reg.tense}`);
    parts.push(`Narrative Interiority: ${reg.interiority}`);
  }
  
  if (style.diction) {
    const dict = style.diction;
    if (dict.register) parts.push(`Diction Register: ${dict.register}`);
    if (dict.formality) parts.push(`Diction Formality: ${dict.formality}`);
    if (dict.favoredWords && dict.favoredWords.length > 0) {
      parts.push(`Favored words/phrases: ${dict.favoredWords.join(', ')}`);
    }
    if (dict.avoidedWords && dict.avoidedWords.length > 0) {
      parts.push(`Avoided words/phrases: ${dict.avoidedWords.join(', ')}`);
    }
  }
  
  if (style.rhythm && style.rhythm.rhythmNotes) {
    parts.push(`Sentence Rhythm Notes: ${style.rhythm.rhythmNotes}`);
  }
  
  if (style.dialogue && style.dialogue.registerNotes) {
    parts.push(`Dialogue Style Notes: ${style.dialogue.registerNotes}`);
  }
  
  if (style.pronounPairs && style.pronounPairs.length > 0) {
    parts.push(`Pronoun Conventions: ${style.pronounPairs.join(', ')}`);
  }
  
  return parts.join('\n');
}

// Formats Character into details block
function formatCharacterBlock(char: Character, compact = false): string {
  if (compact) {
    return `- ${char.name} (${char.role || 'No role'})`;
  }
  const parts = [];
  parts.push(`- Character: ${char.name}`);
  if (char.role) parts.push(`  Role: ${char.role}`);
  if (char.aliases && char.aliases.length > 0) parts.push(`  Aliases: ${char.aliases.join(', ')}`);
  if (char.appearance) parts.push(`  Appearance: ${char.appearance}`);
  if (char.notes) parts.push(`  Notes: ${char.notes}`);
  return parts.join('\n');
}

// Formats Location into details block
function formatLocationBlock(loc: Location, compact = false): string {
  if (compact) {
    return `- ${loc.name} (${loc.scale || 'room'})`;
  }
  const parts = [];
  parts.push(`- Location: ${loc.name}`);
  if (loc.scale) parts.push(`  Scale: ${loc.scale}`);
  if (loc.descriptors && loc.descriptors.length > 0) parts.push(`  Descriptors: ${loc.descriptors.join(', ')}`);
  if (loc.notes) parts.push(`  Notes: ${loc.notes}`);
  return parts.join('\n');
}

export async function buildEditorPrompt(
  toolId: 'fix_grammar' | 'rephrase' | 'shorten' | 'polish_dialogue' | 'vivid_detail',
  input: {
    selectionText: string;
    beforeText: string;
    afterText: string;
    guidance?: string;
    params?: Record<string, string | number>;
  },
  ctx: ToolContext,
  warnings: string[]
): Promise<{ system: string; user: string }> {
  const pack = loadPromptPack(ctx.lang);
  const tool = pack.tools[toolId];
  if (!tool) throw new Error(`No prompt block for tool ${toolId} in pack ${ctx.lang}`);

  // 1. System preamble (fixed)
  const system = pack.system;

  // 2. Action instruction (resolve dynamic params)
  let actionInstruction = tool.action;
  if (toolId === 'shorten') {
    const target = input.params?.target ?? 30;
    actionInstruction = actionInstruction.replace('{target}', String(target));
  } else if (toolId === 'vivid_detail') {
    const focus = input.params?.focus ?? 'auto';
    actionInstruction = actionInstruction.replace('{focus}', String(focus));
  }

  // 3. User guidance (optional, capped at 300 words)
  let userGuidance = '';
  if (input.guidance && input.guidance.trim()) {
    const sliced = input.guidance.trim().split(/\s+/).slice(0, 300).join(' ');
    userGuidance = `=== WRITER GUIDANCE ===\n${sliced}`;
  }

  // 4. Style block
  let styleBlock = '';
  const style = await getStyle(ctx);
  if (style) {
    styleBlock = formatStyleBlock(style);
  }

  // Scan matched names in surrounding prose + target
  const textToSearch = `${input.beforeText}\n${input.selectionText}\n${input.afterText}`.toLowerCase();

  // 5. Character block
  let charactersList: Character[] = [];
  try {
    const raw = await ctx.storage.readFile(`${ctx.prefix}Characters.json`);
    if (raw) {
      charactersList = (JSON.parse(raw).characters || []) as Character[];
    }
  } catch {
    // ignore
  }
  const matchedChars = charactersList.filter(c => {
    if (c.name && textToSearch.includes(c.name.toLowerCase())) return true;
    if (Array.isArray(c.aliases)) {
      return c.aliases.some(alias => alias && textToSearch.includes(alias.toLowerCase()));
    }
    return false;
  });

  // 6. Location block
  let locationsList: Location[] = [];
  try {
    const raw = await ctx.storage.readFile(`${ctx.prefix}Locations.json`);
    if (raw) {
      locationsList = (JSON.parse(raw).locations || []) as Location[];
    }
  } catch {
    // ignore
  }
  const matchedLocs = locationsList.filter(l => {
    if (l.name && textToSearch.includes(l.name.toLowerCase())) return true;
    if (Array.isArray(l.aliases)) {
      return l.aliases.some(alias => alias && textToSearch.includes(alias.toLowerCase()));
    }
    return false;
  });

  // 7. Continuity block
  let continuityBlock = '';
  let hasContinuity = false;
  const activeIdx = ctx.chapterOrder.indexOf(ctx.project.activeChapterId);
  if (activeIdx > 0) {
    const prevId = ctx.chapterOrder[activeIdx - 1];
    try {
      const cont = await ctx.storage.readFile(`${ctx.prefix}Continuity/chapter-${prevId}.md`);
      if (cont && cont.trim()) {
        continuityBlock = `=== PRECEDING CHAPTER CONTINUITY ===\n${cont.trim()}`;
        hasContinuity = true;
      }
    } catch {
      // ignore
    }
  }

  // 8. Surrounding prose
  // Window sizes from spec
  const windows: Record<string, { before: number; after: number }> = {
    fix_grammar: { before: 200, after: 100 },
    rephrase: { before: 300, after: 150 },
    shorten: { before: 300, after: 150 },
    vivid_detail: { before: 500, after: 200 },
    polish_dialogue: { before: 1000, after: 500 },
  };
  const windowLimits = windows[toolId] || { before: 300, after: 150 };

  const getSurroundingProseBlock = (bLimit: number, aLimit: number) => {
    const b = getWordLimit(input.beforeText, bLimit, 'before');
    const a = getWordLimit(input.afterText, aLimit, 'after');
    const blend = "Here is what comes BEFORE, the SELECTION to edit, and what comes AFTER. Rewrite **only** the SELECTION so it slots seamlessly between BEFORE and AFTER — matching tense, POV, voice, and rhythm. Do not change BEFORE or AFTER. Return only the revised SELECTION.";
    
    let block = `=== BLEND INSTRUCTION ===\n${blend}`;
    if (b) {
      block += `\n\n=== CONTEXT BEFORE ===\n${b}`;
    }
    if (a) {
      block += `\n\n=== CONTEXT AFTER ===\n${a}`;
    }
    return block;
  };

  const getEntityBlock = (compact: boolean) => {
    const charParts = matchedChars.map(c => formatCharacterBlock(c, compact));
    const locParts = matchedLocs.map(l => formatLocationBlock(l, compact));
    
    let cBlock = '';
    if (charParts.length > 0) {
      cBlock = `=== CHARACTER BIBLE ===\n${charParts.join('\n\n')}`;
    }
    
    let lBlock = '';
    if (locParts.length > 0) {
      lBlock = `=== LOCATION BIBLE ===\n${locParts.join('\n\n')}`;
    }
    
    return { cBlock, lBlock };
  };

  // Helper to assemble full user prompt
  const assemble = (surrounding: string, cont: string, entities: { cBlock: string; lBlock: string }) => {
    const segments: string[] = [actionInstruction];
    if (userGuidance) segments.push(userGuidance);
    if (styleBlock) segments.push(styleBlock);
    if (entities.cBlock) segments.push(entities.cBlock);
    if (entities.lBlock) segments.push(entities.lBlock);
    if (cont) segments.push(cont);
    segments.push(surrounding);
    segments.push(`=== TARGET SELECTION TO EDIT ===\n${input.selectionText.trim()}`);
    segments.push(tool.outputFormat);
    return segments.join('\n\n');
  };

  // Try assembling with normal parameters
  let surroundingProseText = getSurroundingProseBlock(windowLimits.before, windowLimits.after);
  let entityBlocks = getEntityBlock(false);
  let userPrompt = assemble(surroundingProseText, continuityBlock, entityBlocks);

  // Check budget (6000 tokens ceiling = ~22800 characters)
  const tokenBudget = 6000;
  const charBudget = Math.ceil(tokenBudget * 3.8);

  if (userPrompt.length > charBudget) {
    // Trimming step 1: Shrink surrounding prose to floor (100 before / 50 after)
    surroundingProseText = getSurroundingProseBlock(100, 50);
    userPrompt = assemble(surroundingProseText, continuityBlock, entityBlocks);
  }

  if (userPrompt.length > charBudget && hasContinuity) {
    // Trimming step 2: Drop continuity block and issue warning
    warnings.push("Continuity block dropped from prompt due to length limits.");
    userPrompt = assemble(surroundingProseText, '', entityBlocks);
  }

  if (userPrompt.length > charBudget) {
    // Trimming step 3: Summarize entity entries
    entityBlocks = getEntityBlock(true); // compact
    userPrompt = assemble(surroundingProseText, '', entityBlocks);
  }

  return { system, user: userPrompt };
}
