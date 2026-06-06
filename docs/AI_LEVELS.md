# AI Levels

This document defines the AI **levels** in xnovelist: what each level is, how much it helps the writer, and which tools it unlocks. It is the source of truth for the `level` field in `WorkspaceAIConfig` (`src/storage/aiConfig.ts`), which ranges `0–5`.

`AI.md` specifies *how* a tool runs (prompt assembly, confidence checks, failure model, privacy). This document specifies *what* the writer is opting into when they set a level, and *which* tools belong to each.

## The organizing principle

Every level answers one question: **how far does the AI reach into your prose?**

That is the only axis. We do not rank levels by "trust earned over time," and we do not gate a higher level behind hours logged at a lower one. The writer picks the level that matches the kind of help they want, and changes it whenever they like. A level is a ceiling on AI reach, not a graduation.

Read top to bottom, the ladder is one sentence per level:

- **L0** — the AI is off.
- **L1** — the AI *reads* your book.
- **L2** — the AI *edits the words you wrote*.
- **L3** — the AI *writes a passage you outlined*.
- **L4** — the AI *drafts a scene you described*.
- **L5** — the AI *works across the whole manuscript*.

## The one line that matters: L2 → L3

The boundary between Level 2 and Level 3 is the real consent line in the product.

- **At L2 and below, the AI never originates a sentence.** It reads your prose (L1) or rewrites prose you already wrote and highlighted (L2). Every word it touches was your word first.
- **At L3 and above, the AI generates new prose** — always inside a slot you defined and always behind an explicit Accept, but the words on the page did not exist until the AI wrote them.

A novelist who is skeptical of AI-written prose can live permanently at L1 or L2 and get a complete, honest assistant that never puts words in their characters' mouths. That is a first-class destination, not a way station.

## Levels are cumulative

Each level includes every tool below it. Setting the workspace to L3 gives you L1's capture tools, L2's polish tools, and L3's beat tool. Setting it back to L1 hides everything above L1 immediately and makes no further generation calls.

L0 is the master off switch: AI surfaces are hidden and no outbound LLM request is ever made (see "The master toggle" in `AI.md`).

## The ladder

| Level | Name | What the AI is | How much it helps | Whose words reach the page | Tools added at this level |
|------:|------|----------------|-------------------|----------------------------|---------------------------|
| **0** | **Off** | Nothing | None — a pure manual writing environment | 100% yours | *(none; AI surfaces hidden)* |
| **1** | **Reader** | A reader/archivist that studies your draft but never writes prose | Understands and organizes your work; builds the Story Bible from prose you already wrote | Nothing — output goes to the Bible or to read-only reports | `capture_characters`, `capture_locations`, `capture_style`, `summarize_chapter`, `check_continuity` |
| **2** | **Editor** | A line editor working only on text you highlighted | Improves prose you already wrote; never originates a sentence | Your words, refined — every change shown as a diff you accept or reject | `fix_grammar`, `rephrase`, `shorten`, `polish_dialogue`, `vivid_detail` |
| **3** | **Co-writer** | A writer that fills a slot you outlined | Generates prose for a beat card you authored (type, intent, target length) | AI prose, inside a container you defined and explicitly Apply | `write_beat` |
| **4** | **Drafter** | A drafter working at scene scale | Turns a scene description into a multi-beat draft, continuity-aware | A full scene draft awaiting your revision | `plan_scene`, `draft_scene`, `revise_scene` |
| **5** | **Agent** | A bounded multi-step agent working project-wide | Manuscript-scale sweeps and multi-candidate generation | Drafts and reports; bounded depth, audit-logged run trace | `audit_continuity`, multi-candidate `draft_scene`, orchestrated workflows |

---

## Level 0 — Off

**What it presents.** No AI surfaces. The Polish panel, the Story Bible capture affordances, the Capture Style button, and every beat/scene affordance are hidden. This is the default on a fresh install.

**How much it helps.** Zero, by design. The writer gets the complete AI-free product: editor, outline, Story Bible, snapshots with diff, find/replace, distraction-free mode, DOCX export.

**Network.** No outbound request to any LLM endpoint is ever made.

**Tools.** None.

## Level 1 — Reader (analysis & capture)

**What it presents.** Capture affordances on the Story Bible and Style tabs, a "Summarize chapter" action that proposes a continuity card, and a read-only continuity scan. Output never lands in the manuscript — it lands in the Bible (as a per-row review) or in a report panel.

**How much it helps.** This is the highest-reliability, lowest-risk AI help in fiction: the AI reads what you wrote and organizes it. It extracts characters, locations, and style signals into the Bible, summarizes a chapter, and flags continuity contradictions. It does not write prose.

**Whose words reach the page.** None. Nothing the AI produces here is inserted into the manuscript.

**Tools.**

| Tool                 | UI label            | Temp | Output target                          |
|----------------------|---------------------|------|----------------------------------------|
| `capture_characters` | Capture characters  | 0.6  | `Characters.json` merge                |
| `capture_locations`  | Capture locations   | 0.6  | `Locations.json` merge                 |
| `capture_style`      | Capture style       | 0.6  | `Style.json` merge                     |
| `summarize_chapter`  | Summarize chapter   | 0.4  | Continuity draft → Continuity tab      |
| `check_continuity`   | Check continuity    | 0.3  | Read-only report (no edits)            |

The three capture tools share one contract. They take a selection (a paragraph or more) and a target bible, and return structured JSON reviewed row by row:

```ts
type CaptureToolInput = {
  selection: { from: number; to: number; text: string };
  chapterId: string;
  hint?: string;   // optional name hint when invoked from an "Add to bible →" pill
};

type CaptureToolOutput = {
  proposal: {
    additions: Array<CharacterDraft | LocationDraft | StyleFieldDelta>;
    updates:   Array<CharacterUpdate | LocationUpdate | StyleFieldDelta>;
  };
  warnings: string[];
  estimatedInputTokens: number;
};
```

**Commit path (capture).** A per-row review modal: every proposed addition or update has its own Accept and Discard, and any field is editable inline before accepting. The bible updates only after "Apply selected" with at least one row accepted. If the model returns malformed JSON, the tool runs one repair retry (parse error + schema attached) before surfacing "Capture failed." No silent no-op.

`summarize_chapter` proposes a continuity card for the active chapter, rendered into the Continuity tab as a draft the writer edits and accepts. `check_continuity` scans a chapter against the bible and preceding continuity and returns flagged statements with severity (high / medium / low) and the conflicting fact — a report panel only; the writer navigates to flagged lines and decides.

**Why it is Level 1.** Analysis and extraction are where AI is most trustworthy for novelists, and they never touch the prose. A writer who wants the Story Bible to maintain itself — and nothing more — stops here.

## Level 2 — Editor (polish your words)

**What it presents.** The Polish panel, active on a highlighted selection. Every result renders as a word-level diff with Accept / Discard.

**How much it helps.** A line editor for prose you already wrote. It rephrases, fixes grammar, shortens, sharpens dialogue, or adds detail — always operating on a selection, never starting a sentence on its own.

**Whose words reach the page.** Yours, refined. The AI's proposal only replaces the selection if you Accept it.

**Tools.**

| Tool              | UI label        | Temp | Length policy           | Context (before / after) |
|-------------------|-----------------|------|-------------------------|--------------------------|
| `rephrase`        | Rephrase        | 0.5  | ±20% of input           | 300 / 150                |
| `fix_grammar`     | Fix grammar     | 0.2  | ±5% of input            | 200 / 100                |
| `vivid_detail`    | Vivid           | 0.75 | ≤ 1.5× input (hard cap) | 500 / 200                |
| `shorten`         | Shorten         | 0.4  | within ±5% of target    | 300 / 150                |
| `polish_dialogue` | Polish dialogue | 0.65 | ±15% of input           | 1000 / 500               |

All five share one input and output contract:

```ts
type PolishToolInput = {
  selection: { from: number; to: number; text: string };
  chapterId: string;
  guidance?: string;          // free-text user note ("less formal", "punchier")
  vividFocus?: "sensory" | "atmosphere" | "interiority" | "action";  // vivid_detail only
  shortenTargetPct?: number;  // shorten only; default 30; range 20–50
};

type PolishToolOutput = {
  proposal: string;           // the revised passage
  warnings: string[];         // confidence-check warnings
  estimatedInputTokens: number;
  actualInputTokens?: number;
  actualOutputTokens?: number;
};
```

**Commit path (polish).** Identical across all five: the proposal renders as a word-level diff in the Polish panel; Accept replaces the selection range with the proposal; Discard drops it. The selection range is the Tiptap `from`/`to`, threaded honestly through (no `indexOf` lookups).

**Action-specific instruction (fixed per tool).**

- **`rephrase`** — "Rewrite the passage in different words but with the same meaning, characters, events, emotional register, and point of view. Do not add or remove information. Do not change names or pronouns. Return only the rewritten passage."
- **`fix_grammar`** — "Correct only spelling, grammar, and punctuation. Do not rephrase or restructure. Do not change word choices unless a word is clearly wrong. If already correct, return it verbatim. Return only the corrected passage."
- **`vivid_detail`** (with `{focus}`) — "Expand the passage by adding {focus} detail. Stay inside the same scene, moment, and point of view. Do not invent new events, characters, or locations. Do not exceed 1.5× the input length. Return only the expanded passage." Focus chips: sensory → "what the POV character sees, hears, smells, tastes, feels physically"; atmosphere → "mood, weather, light, time of day, texture of the place"; interiority → "the POV character's thoughts, doubts, recognitions, emotional shifts"; action → "physical motion: blocking, gestures, micro-actions, body language".
- **`shorten`** (with `{pct}`) — "Reduce the passage by approximately {pct}% while preserving every event, line of dialogue, revealed feeling, and the point of view. Cut adjectives, adverbs, and filler before sentences; sentences before paragraphs. Do not cut character names or dialogue lines. Return only the shortened passage."
- **`polish_dialogue`** — "Preserve every speaker's identity and every line's intent. Sharpen voice distinctions through word choice, register, hesitation patterns, dialect markers, and rhythm. Do not add or remove lines. Do not change who says what, or pronouns or names. Return only the polished passage."

**Guardrails.** Local confidence checks run before any diff is shown (defined in `AI.md`): named characters preserved, named locations preserved, dominant pronoun set preserved, plus an off-topic (Jaccard) check. A failed check renders the diff with a warning banner rather than blocking it — the point is to make the cost legible, not to veto the writer.

## Level 3 — Co-writer (fill a beat you defined)

**What it presents.** The Beat Anchor insertion UI and beat cards. The writer authors a beat card — type (action / reaction / dialogue / realization / decision / transition), intent, target length — and the AI writes the prose for that one beat.

**How much it helps.** The AI now generates new prose, but only inside a slot the writer authored. The card is the writer's; the words fill it.

**Whose words reach the page.** AI-written prose, staged inside the beat card with Apply / Retry / Discard. Apply inserts the prose beneath the card and marks the card done.

**Tools.**

- `write_beat` — Generates prose for one structured beat card.
  - *Input:* beat type (action / reaction / dialogue / realization / decision / transition / guide), beat description, target word count (200 / 400 / 600), preceding-prose context, following-prose context.
  - *Output:* a draft of the beat's prose.
  - *Commit path:* staged inside the beat card (Apply / Retry / Discard); Apply inserts beneath the card and marks it done.
  - *Guardrail:* a length-policy check runs post-generation (soft-truncate to target with a warning), in addition to the L2 confidence checks.

**This is where the consent line is crossed** (see "L2 → L3" above). It is the first level at which the manuscript can contain a sentence the writer did not write.

## Level 4 — Drafter (draft a scene you described)

**What it presents.** A scene description surface. The writer describes a scene at a higher level; the AI plans the beats, drafts them in order with continuity awareness, and presents the result as a reviewable draft.

**How much it helps.** Scene-scale generation. The AI sequences and writes multiple beats so the writer reviews a coherent draft rather than assembling it beat by beat.

**Whose words reach the page.** A full scene draft, awaiting the writer's revision. Nothing is committed without review.

**Tools.**

- `plan_scene` — Turns a scene description into a beat sheet.
  - *Input:* scene description, characters present, location, target total length. *Output:* an ordered list of beat cards.
- `draft_scene` — Drafts every beat in a plan, in order, continuity-aware.
  - *Input:* a plan from `plan_scene`. *Output:* prose per beat, concatenated into a scene draft. Internally composes `write_beat` per beat plus `check_continuity` after.
- `revise_scene` — Applies revision notes to an already-drafted scene.
  - *Input:* scene draft + revision notes. *Output:* a revised scene draft.

## Level 5 — Agent (work across the manuscript)

**What it presents.** Project-wide actions and a run-trace panel. Multi-step orchestration is bounded: a run has a maximum depth (default 3, configurable), may only call tools in a fixed manifest, and logs every internal call for the writer to inspect or replay afterward.

**How much it helps.** Manuscript scale. The AI sweeps the whole project for continuity, and `draft_scene` can return several parallel candidates (default 1, up to 3) for side-by-side comparison.

**Whose words reach the page.** Drafts and reports — never a silent edit. Every output is a proposal behind an explicit Accept, and every agent run is auditable.

**Tools.**

- `audit_continuity` — Sweeps the entire manuscript against the bible.
  - *Input:* every chapter + the full bible. *Output:* a project-wide continuity report.
- Multi-candidate `draft_scene` — A `draft_scene` run may return N parallel drafts (default 1, configurable up to 3) for side-by-side comparison.
- Orchestrated workflows — Compositions of lower-level tools, run as a bounded agent loop.

**Bounds.** A Level 5 run is a **deterministic harness pipeline**, not a model-driven tool loop: the writer states intent in the free-text goal box, and the harness sequences a fixed set of steps (e.g. plan → per-beat draft → check), calling the model once per step as a stateless JSON proposer. A run has a maximum depth (default 3, configurable in Settings), only produces write-ops in the run's manifest, and logs every step to a run-trace panel the writer can inspect or replay. The model never decides what runs next — the harness does (see `AI.md`, "The LLM is a stateless proposer").

---

## Mapping to code

- The active level is `WorkspaceAIConfig.level: 0 | 1 | 2 | 3 | 4 | 5`, default `0`, persisted in `workspace/ai.json`.
- A level `>= 1` requires a configured provider (`defaultProviderId` + a ready provider profile) before any AI action is available.
- Tool availability is a pure function of the level: a tool is invocable only if its level `<= workspace.level`. This check belongs in the `runTool` dispatcher alongside the master-toggle check described in `AI.md`, so there is a single enforcement seam.
- Lowering the level immediately hides higher-level surfaces and makes no further calls at those levels; it does not delete anything already committed to the manuscript or Bible.

## What no level unlocks

No level adds model-driven execution (function-calling or a tool loop), a tool that runs without user invocation, or a write to the manuscript or the Bible without an explicit Accept of a write-op card. A free-text intent box appears only at Level 5; Levels 1–4 are driven by named actions chosen in the composer. These remain non-goals/limits at every level (see `AI.md`, "What we will not ship at any level").
