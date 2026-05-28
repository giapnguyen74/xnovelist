# Story Bible

The Story Bible is the structured reference the novelist keeps about their own work. Four files: **Characters**, **Locations**, **Style**, **Continuity**. Each is editable by hand, useful without AI, and consumable by AI when AI is enabled.

The design priority is the human's ability to add, edit, and skim the bible without friction. The AI's needs are secondary; if a schema change would help the AI but hurt the writer's experience, we don't make the change.

## Why the bible exists at all

A novel of any seriousness accumulates more facts about its world than the author can hold in working memory. Names, ages, scars, hometowns, who knows what about whom, what the kitchen smells like in chapter 1 versus chapter 14. Without a place to put these, the author either re-reads the manuscript every session (slow) or makes inconsistencies that beta readers will catch (painful).

xnovelist's bible is the place. It's editable like any other document, it's referenced by the editor (character names get underlined in the manuscript so you can click through to their profile), and — when AI is on — it's compiled into every AI prompt so the AI's output respects the world's facts.

The bible is not AI infrastructure that the author happens to be allowed to read. It's the author's infrastructure that the AI happens to be allowed to consume.

## Workspace

The Story Bible toggle in the left sidebar flips the center canvas from the editor to a tabbed bible workspace. Four tabs across the top: Characters, Locations, Style, Continuity. The user can switch back to the editor at any time without losing tab state.

Each tab has a search box (top right), a list of entries (left), and a detail editor (right). Adding an entry creates a new list item with an empty detail editor. Deleting prompts for confirmation. Changes save on blur and after a 500ms debounce.

The bible workspace shares the editor's snapshot system — bible writes take an interval snapshot every 30 minutes, and bible imports / AI captures snapshot before applying.

## Characters

`Characters.json` is the source of truth; `Characters.md` is a regenerated human-readable view used by the AI prompt assembler.

```ts
const CharacterSchema = z.object({
  id: z.string(),                               // slug; stable across renames
  name: z.string(),                             // primary display name
  aliases: z.array(z.string()).default([]),     // nicknames, formal versions, last names alone
  role: z.string().optional(),                  // "protagonist", "antagonist", "mentor", free-form
  age: z.number().int().optional(),
  appearance: z.string().optional(),            // freeform
  traits: z.array(z.string()).default([]),
  desires: z.array(z.string()).default([]),
  fears: z.array(z.string()).default([]),
  speechPatterns: z.string().optional(),        // free-form; AI Polish Dialogue consumes this
  relationships: z.array(z.object({
    with: z.string(),                           // character id
    kind: z.string(),                           // "estranged brother", "lover", "rival"
    notes: z.string().optional(),
  })).default([]),
  notes: z.string().optional(),                 // catch-all free-form
  evidence: z.array(z.object({
    chapterId: z.string(),
    quote: z.string(),
    addedAt: z.number(),
  })).default([]),
});

export const CharactersSchema = z.object({
  schemaVersion: z.literal(1),
  characters: z.array(CharacterSchema),
});
```

**Manual entry.** The user clicks "+ New character" in the Characters tab and fills in fields. None except `name` is required. The form is the entirety of the character's representation in the bible — there is no separate AI-only schema. What the user sees is what the AI sees.

**Editor integration.** Names from the Characters bible (primary name + aliases) are underlined in purple in the editor as the user types. Click an underlined name → the bible workspace opens with that character pre-selected. Hover an underlined name → a small card shows name, role, and a one-line trait preview, without leaving the editor.

**Capture flow** (AI on only). The user selects an unknown name in the editor — the highlighter shows it as not-in-bible (dotted gray underline) — and a "Add to bible →" pill appears. Clicking it runs the `capture_characters` AI tool on a small window around the name, which returns a draft character profile. The user reviews the draft in a merge modal (every field is editable; "Accept" commits to the bible), or runs "Capture characters from selection" from the Polish panel to extract multiple characters at once from a longer passage.

**Why JSON-backed instead of free-form Markdown.** Two reasons. The AI prompt assembler can filter — Polish Dialogue needs every speaker's `speechPatterns`; Rephrase doesn't need the relationships graph. With structured data we send only what's relevant. And the editor's character-highlight extension needs to scan a list of names with aliases; doing that against free-form Markdown is brittle.

## Locations

`Locations.json` is new in xnovelist (the predecessor project didn't have it). It mirrors Characters in shape but has different fields:

```ts
const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  scale: z.enum(["room", "building", "district", "city", "region", "world"]),
  descriptors: z.array(z.string()).default([]),  // sensory: "narrow", "smells of fish sauce", "single fluorescent tube"
  significance: z.string().optional(),           // why this place matters
  inhabitants: z.array(z.string()).default([]),  // character ids
  notes: z.string().optional(),
  evidence: z.array(z.object({
    chapterId: z.string(),
    quote: z.string(),
    addedAt: z.number(),
  })).default([]),
});

export const LocationsSchema = z.object({
  schemaVersion: z.literal(1),
  locations: z.array(LocationSchema),
});
```

The **`scale`** field is the design call. A `room`-scale location ("Mai's kitchen") is named when the scene begins and then referred to by pronoun; a `region`-scale location ("the Northern Highlands") is named less often, in weighted moments; a `world`-scale location ("the Republic") is named rarely, by implication. When AI is enabled, the prompt assembler uses scale to decide how a location should be referenced in the output. When AI is off, scale is still useful — the author can sort by scale in the workspace, organising small places under their parent district, district under city, city under region.

**Editor integration.** Same shape as characters but with green underlines (distinct from character purple). The location-highlight extension uses the same decoration mechanism as character-highlight, sharing the underlying word-boundary matcher.

**Capture flow.** Mirrors characters. Select an unknown place name, click "Add to bible →", review the draft, accept.

**Locations is not Worldbuilding.** xnovelist v1 does not have a separate worldbuilding bible for magic systems, factions, technologies, calendars, glossaries. Locations covers physical places only. A worldbuilding bible may ship in v2 if user research demands it; the schema would be a separate file with a separate tab, not folded into Locations.

## Style

`Style.json` is structured; `Style.md` is the regenerated human-readable view.

```ts
export const StyleSchema = z.object({
  schemaVersion: z.literal(1),

  rhythm: z.object({
    avgSentenceLengthHint: z.string().optional(),    // "short-to-medium, varied"
    paragraphLengthHint: z.string().optional(),
    rhythmNotes: z.string().optional(),
  }).default({}),

  diction: z.object({
    register: z.string().optional(),                  // "literary contemporary"
    formality: z.enum(["formal", "neutral", "casual"]).optional(),
    favoredWords: z.array(z.string()).default([]),
    avoidedWords: z.array(z.string()).default([]),
  }).default({}),

  dialogue: z.object({
    taggingConvention: z.string().optional(),         // "minimal — 'said' and 'asked' only"
    registerNotes: z.string().optional(),
    dialectMarkers: z.array(z.string()).default([]),
  }).default({}),

  narrativeRegister: z.object({
    pointOfView: z.enum(["first", "second", "third-limited", "third-omniscient"]),
    tense: z.enum(["past", "present"]),
    interiority: z.enum(["high", "medium", "low"]).default("medium"),
  }),

  sensoryPalette: z.object({
    dominantSenses: z.array(z.enum(["sight", "sound", "smell", "taste", "touch"])).default([]),
    colorNotes: z.string().optional(),
    soundNotes: z.string().optional(),
  }).default({}),

  pronounPairs: z.array(z.string()).default([]),      // multilingual support: "em/anh", "tôi/bạn"
});
```

**Manual entry.** The Style tab is form-based — each section is a card with the relevant fields rendered as inputs. No requirement to fill any of it; the AI prompt assembler skips empty sections. A novelist writing without AI may still use Style as a self-reference ("my POV is third-limited, my interiority is high, I avoid 'chuckled' and 'smirked'") — it's a contract the writer has with themselves.

**Capture flow.** The user runs Capture Style either from the editor (selecting a paragraph of their own prose and clicking "Capture style from selection") or from the Style tab (pasting an external sample into the "Capture from sample" box). Either path runs the `capture_style` AI tool, which returns a per-field delta proposal. The user accepts per field; the bible updates.

**Style is the most leveraged bible file.** Every polish action filters Style by relevance and injects only the relevant subset. Polish Dialogue uses `dialogue.*` and `pronounPairs`. Rephrase uses `narrativeRegister.*` and `diction.register`. Vivid uses `sensoryPalette.*`. A better Style file makes every other AI tool better.

## Continuity

Continuity tracks the story state *after* each chapter — what the reader knows, what's hidden, what's unresolved, what constraints carry forward. It's stored per-chapter as Markdown at `Continuity/chapter-NNN.md`. There is no JSON schema; the continuity files are free-form Markdown that follows a template by convention.

The template:

```markdown
# Continuity: Chapter <N> — <Chapter Title>

## Summary
- (Key event 1)
- (Key event 2)

## Character state
- (Character): (emotional state, current location, active secrets, what they know)

## Reader knowledge
- What the reader knows: (...)
- What is hidden from the reader: (...)

## Open threads
- (Unresolved hook 1)
- (Unresolved hook 2)

## Constraints going forward
- (e.g. Mai must remain distrustful of Minh)
```

When the user navigates to chapter N in the editor, the right panel's Continuity tab loads `Continuity/chapter-N.md` for editing (the continuity *that this chapter establishes*) and shows `Continuity/chapter-(N-1).md` as a read-only preview (the continuity *that this chapter inherits*). This is the position-dependent continuity model: chapter N's AI context is built from chapter N-1's continuity, not from a flat global file.

**Manual entry.** The user types into the chapter's continuity editor. Auto-saves on blur and on debounce. There is no requirement to fill it in; the AI gracefully degrades (best-effort mode) when preceding continuity is empty.

**AI flow (phase 2, not phase 1).** A "Generate continuity for this chapter" button appears in the tab when AI is on and the chapter is non-empty. Clicking runs `summarize_chapter` (a phase 2 tool), which proposes a continuity draft following the template. The user reviews and edits before accepting. This action is hidden in phase 1 — even with AI on, continuity is human-authored in phase 1.

**Why Markdown instead of JSON.** Continuity is paragraphs of text and bullet lists, not structured fields. Fitting it to a JSON schema would lose the writer's discretion to phrase things their way. Markdown is the right shape; the AI is good at consuming Markdown.

## How the bible feeds the AI (preview)

When an AI tool runs, the prompt assembler in `src/ai/prompts/buildPrompt.ts` includes a filtered subset of the bible. The filtering rules (full detail in `AI.md`):

- **Characters block** — only characters whose names (primary or alias) appear in the surrounding prose. Each character's `speechPatterns` is included only for Polish Dialogue.
- **Locations block** — only locations whose names appear in the surrounding prose. The `scale` field is always included for relevant locations.
- **Style block** — action-specific subset (e.g. `dialogue.*` for Polish Dialogue; `sensoryPalette.*` for Vivid).
- **Continuity block** — the preceding chapter's continuity Markdown, always included if non-empty.

The bible is never silently truncated; if the budget is over, the surrounding prose window shrinks first. This is the inverse of the common pattern and is deliberate: the bible is the small, hard-won, high-signal context.

## How the bible serves the writer without AI

A novelist who never enables AI uses the bible as a referenceable, searchable, organised version of what they'd otherwise keep in a notebook. The character names underlined in the editor let them jump from the manuscript to a character profile without breaking flow. The location scale field helps them organise their world. The Style file lets them define their voice in their own words for their own benefit. The per-chapter continuity gives them a place to track open threads so the manuscript doesn't drift.

When the user exports a JSON backup, every bible file is in there. When they import on another device, the bible comes with them. Nothing about the bible requires AI to be useful.

## Language: the bible follows the prose, not the UI

The `Project.json` document carries a `language` field (ISO 639-1) that identifies the language the novel is being written in. This is the **prose language**. It is set when the project is created (defaulting to the user's UI language as a sensible starting point), and it is editable thereafter.

The Story Bible — every character description, every location descriptor, every Style field, every Continuity entry — is in the prose language. The Markdown chapter files are in the prose language. The AI's output is in the prose language (see `AI.md`'s "Language: UI vs prose" section for the full picture).

The **UI language** is a separate setting that lives in user-level Settings (not in the project). The application chrome — labels, buttons, menus, dialogs — uses the UI language. A user with an English UI working on a Vietnamese novel sees English menus while writing Vietnamese characters and locations in the bible. The two settings move independently.

This decoupling matters most for multilingual writers (an editor working in an L2 UI on an L1 novel, or a single writer maintaining projects in different languages). The bible's contents are work-in-the-novel's-language; the UI's chrome is meet-the-user-where-they-are.
