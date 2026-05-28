# AI

This document specifies how AI works in xnovelist. The framing throughout: AI is **optional**, **named**, **scoped**, and **previewed**. Every AI behaviour is enumerated. Nothing emerges; nothing is hidden.

## The master toggle

Settings has a single switch labelled "Enable AI features." It is **off by default** on a fresh install. With it off:

- The Polish panel is hidden.
- The Story Bible capture affordances are hidden.
- The Capture Style button on the Style tab is hidden.
- Phase 2 beat insertion (when phase 2 ships) is hidden.
- Phase 3 scene drafting (when phase 3 ships) is hidden.
- No outbound network request to any LLM endpoint is ever made.

With it on, the user must also configure a BYOAI endpoint (base URL + model + optional API key) before any AI action is available. Until the endpoint is configured, the AI surfaces are visible but disabled with a "Configure your model in Settings" prompt.

The toggle is enforced at a single seam: the `runTool({ tool, args })` dispatcher in `src/ai/runTool.ts` checks the toggle synchronously and throws `AIDisabledError` if AI is off. No tool can be invoked through any other path. This is auditable in CI by a lint rule that bans direct imports of any file under `src/ai/llm/` outside of `src/ai/`.

## Endpoints: BYOAI, direct, no proxy

xnovelist makes its LLM request from the user's browser directly to the endpoint the user configured. There is no xnovelist server in the loop. We do not host a key, do not relay calls, do not aggregate traffic. The supported configurations:

| Provider             | Base URL example                       | Auth                       | CORS in browser         |
|----------------------|----------------------------------------|----------------------------|-------------------------|
| OpenAI               | `https://api.openai.com/v1`            | `Authorization: Bearer …`  | Permitted               |
| OpenRouter           | `https://openrouter.ai/api/v1`         | `Authorization: Bearer …`  | Permitted               |
| Anthropic (via shim) | varies (third-party OpenAI shims)      | varies                     | Depends on shim         |
| Ollama (local)       | `http://localhost:11434/v1`            | none                       | Permitted (local)       |
| LM Studio (local)    | `http://localhost:1234/v1`             | none                       | Permitted (local)       |
| Other OpenAI-compatible | user-configured                     | user-configured            | varies                  |

The application speaks one wire format: OpenAI Chat Completions. Every supported endpoint either implements it natively or sits behind a shim that does. Adding "support" for a new provider that already speaks Chat Completions is configuration, not code.

**CORS is the user's environment, not our service.** Most cloud providers in the table above have CORS configured to permit browser calls; local providers don't need CORS because the request originates from the same host. If a user configures an endpoint that rejects the browser preflight, the error surfaces explicitly ("CORS preflight rejected by https://…. The endpoint may not accept direct browser calls. Try a provider that supports CORS, or run a local model."). We do not work around it by adding a relay.

**No fallback to a default model.** If the user has no key and no configured endpoint, the AI surface stays disabled. The application does not transparently use an embedded model, a "free tier," or any provider on the user's behalf. The first AI call costs whatever the user's chosen provider charges, billed directly to that provider, end of story.

**Settings carries multiple endpoint profiles.** A user can save one configuration named "OpenAI personal," another named "Ollama local," and switch between them per project (or per session) without re-entering credentials. Profile switching is local; no profile metadata leaves the device.

## The trust ladder

Three phases. Each phase adds a tool set to the previous; nothing is removed across phases. The trust contract widens deliberately at each step.

**Phase 1 — Polish + Tag.** The AI edits a passage the user has highlighted, or it captures named entities from prose the user has written. The AI never starts a sentence; every action operates on a selection.

**Phase 2 — Beat.** The user describes a beat — type, intent, target length. The AI writes the prose for that beat inside a structured card. The AI now generates prose, but only inside a slot the user authored.

**Phase 3 — Agent.** The user describes a scene at a higher level. The AI plans the beats, drafts them, checks them against the Story Bible, and presents the result. The AI now runs multiple steps without a human in the loop, but every output is still a draft awaiting human review.

Each phase ships with a defined, enumerated tool set. Phase gates (criteria for moving from one phase to the next) live in the roadmap doc.

## Tool-set doctrine

Three rules that govern every AI tool in every phase.

**Named.** Every tool has a unique `tool` identifier (e.g. `rephrase`, `capture_characters`, `write_beat`). The user sees the tool name (or its UI label) before invoking. There is no "ask the AI" free-text surface that could call any tool.

**Scoped.** Every tool declares its input contract (what state it consumes), its output contract (what it produces), its preview surface (how the user reviews), and its commit path (how the result enters the project, if accepted). These are visible in the source under `src/ai/tools/<tool>.ts` and documented per tool below.

**Composed only by humans.** No tool invokes another tool. If a workflow needs two tools, the UI orchestrates them sequentially with explicit user steps in between. Phase 3's agent loop is the one exception, and even there the agent's tool calls are constrained to a fixed manifest and audit-logged for the user to inspect after the run.

## Phase 1 tool set

Eight tools. Five operate on a highlighted passage and edit it. Three operate on a passage and write to the Story Bible.

### Polish tools (passage → revised passage)

| Tool                | UI label          | Temp | Length policy           | Context window      |
|---------------------|-------------------|------|-------------------------|---------------------|
| `rephrase`          | Rephrase          | 0.5  | ±20% of input           | 300 before / 150 after |
| `fix_grammar`       | Fix grammar       | 0.2  | ±5% of input            | 200 / 100           |
| `vivid_detail`      | Vivid             | 0.75 | ≤ 1.5× input (hard cap) | 500 / 200           |
| `shorten`           | Shorten           | 0.4  | within ±5% of target    | 300 / 150           |
| `polish_dialogue`   | Polish dialogue   | 0.65 | ±15% of input           | 1000 / 500          |

Each polish tool has the same input contract:

```ts
type PolishToolInput = {
  selection: { from: number; to: number; text: string };
  chapterId: string;
  guidance?: string;          // free-text user note ("less formal", "punchier")
  vividFocus?: "sensory" | "atmosphere" | "interiority" | "action";  // required for vivid_detail
  shortenTargetPct?: number;  // required for shorten; default 30; range 20–50
};
```

And the same output contract:

```ts
type PolishToolOutput = {
  proposal: string;              // the revised passage
  warnings: string[];            // confidence-check warnings (see below)
  estimatedInputTokens: number;
  actualInputTokens?: number;
  actualOutputTokens?: number;
};
```

The commit path is identical across polish tools: the proposal renders as a word-level diff in the Polish panel; Accept replaces the selection range with the proposal; Discard drops it. Selection range is the Tiptap `from`/`to`, threaded honestly through (no `indexOf` lookups).

#### Action-specific prompts

The prompt for each tool is a fixed string built per the prompt architecture (below). The action-specific instruction blocks:

- **rephrase**: "Rewrite the passage in different words but with the same meaning, the same characters, the same events, the same emotional register, and the same point of view. Do not add new information. Do not remove information. Do not change names or pronouns. Return only the rewritten passage."

- **fix_grammar**: "Correct only spelling, grammar, and punctuation. Do not rephrase. Do not restructure. Do not change word choices unless a word is clearly wrong. If the passage is already correct, return it verbatim. Return only the corrected passage."

- **vivid_detail** (with `{focus}` interpolated): "Expand the passage by adding {focus} detail. Stay inside the same scene, the same moment, the same point of view. Do not invent new events, characters, or locations. Do not exceed 1.5× the input length. Return only the expanded passage." The focus chip adds a one-line guideline (sensory → "Focus on what the POV character sees, hears, smells, tastes, and feels physically"; atmosphere → "Focus on mood, weather, light, time of day, the texture of the place"; interiority → "Focus on the POV character's thoughts, doubts, recognitions, emotional shifts"; action → "Focus on physical motion: blocking, gestures, micro-actions, body language").

- **shorten** (with `{pct}` interpolated): "Reduce the passage by approximately {pct}% while preserving every event, every line of dialogue, every revealed feeling, and the same point of view. Cut adjectives, adverbs, and filler before cutting sentences. Cut sentences before cutting paragraphs. Do not cut character names. Do not cut dialogue lines. Return only the shortened passage."

- **polish_dialogue**: "Preserve every speaker's identity. Preserve every line's intent. Sharpen voice distinctions through word choice, register, hesitation patterns, dialect markers, and rhythm. Do not add new lines. Do not remove lines. Do not change who says what. Do not change pronouns or names. Return only the polished passage."

### Capture tools (passage → bible proposal)

| Tool                    | UI label                   | Temp | Output target           |
|-------------------------|----------------------------|------|-------------------------|
| `capture_characters`    | Capture characters         | 0.6  | `Characters.json` merge |
| `capture_locations`     | Capture locations          | 0.6  | `Locations.json` merge  |
| `capture_style`         | Capture style              | 0.6  | `Style.json` merge      |

Capture tools take a larger selection (a paragraph or more) and a target bible:

```ts
type CaptureToolInput = {
  selection: { from: number; to: number; text: string };
  chapterId: string;
  // For capture_characters/locations: optional name hint when the user invoked from the
  // "Add to bible →" pill on a specific underlined word.
  hint?: string;
};

type CaptureToolOutput = {
  proposal: {
    additions: Array<CharacterDraft | LocationDraft | StyleFieldDelta>;
    updates: Array<CharacterUpdate | LocationUpdate | StyleFieldDelta>;
  };
  warnings: string[];
  estimatedInputTokens: number;
};
```

The commit path is a per-row review modal: each proposed addition or update has its own Accept and Discard. The user can edit any field inline before accepting. The bible is updated only after the user clicks "Apply selected" with at least one row accepted.

Capture tools return structured JSON. If the LLM returns malformed JSON, the tool runs one repair retry (with the parse error and the schema attached to the prompt) before surfacing a "Capture failed" error to the user. No silent no-op.

## Language: UI vs prose, two independent choices

The UI language and the novel's prose language are independent settings.

**UI language** lives in `Settings → Display`, defaults to the browser's detected locale, falls back to English. It controls the text of every button, label, menu, and modal. UI translations are JSON files under `src/i18n/ui/{lang}.json`. The application loads the chosen pack at startup and exposes a `t(key)` helper to every component.

**Prose language** lives in `Project.json` as the `language` field, set when the project is created (with the UI language pre-filled as a sensible default that the user can change). It identifies the language the novel is being written in. The Story Bible (Characters, Locations, Style, Continuity) is in this language. The Markdown chapter files are in this language. The AI's output is in this language.

The AI prompt assembler picks its prompt language pack from the **prose** language, never from the UI language. The pack lives at `src/ai/prompts/packs/{lang}.json` and contains every tool's action instruction, every focus chip's directive, the system preamble, the rules, the output format reminders — all in the target language. A novelist writing a Vietnamese novel with an English UI gets a Vietnamese system preamble, a Vietnamese rephrase instruction, and Vietnamese-rule output.

```
A user with:                   Sees UI in:    Issues AI prompts in:    Gets AI output in:
─────────────────────────────────────────────────────────────────────────────────────────
EN UI, VI novel                English        Vietnamese               Vietnamese
VI UI, EN novel                Vietnamese     English                  English
JA UI, JA novel                Japanese       Japanese                 Japanese
JA UI, FR novel                Japanese       French                   French
```

Why this decoupling matters. Many writers operate in an L2 (an editor working in their non-native UI language, writing fiction in their first language) or write fiction in multiple languages across projects. Forcing the UI language and the prose language to be the same would force such writers to choose between a comfortable UI and correct AI output. Decoupling lets the UI follow the user's habits and the prompts follow the work.

**Adding a new language.** Both the UI pack and the prompt pack live in the repository as JSON files. Adding Spanish, French, German, or Mandarin support is a pull request that adds two files. There is no marketplace, no infrastructure, no review queue. The community can fork, add their pack, and submit upstream. The application validates each pack against a schema at startup and refuses to load malformed packs (with a clear error). v0.2 ships with English and Vietnamese as the reference packs.

**Prompt-pack design.** Each pack is a structured JSON document (validated by zod) whose keys mirror the action set: a `system` preamble in the target language; per-tool blocks with `actionInstruction`, `outputFormatReminder`, and tool-specific fields like `vividFocusChips` (each chip's name and its directive). The pack also declares language-specific guidance — pronoun systems (Vietnamese has many; Japanese has more; English has few), dialogue conventions, register markers — that the AI prompt blocks pull from for relevant actions. This is the same idea as the predecessor project's language packs, but the schema is sharper and the integration with the prompt assembler is named (`buildPrompt` calls `loadPromptPack(project.language)`, never reaches across to UI translations).

## Prompt architecture

Every phase 1 tool assembles its prompt from the same block stack, in this order:

```
1. System preamble                  (fixed, ~150 tokens)
2. Action instruction               (tool-specific, ~100–200 tokens)
3. User guidance                    (optional free-text, capped at 300 tokens)
4. Style block                      (action-filtered subset of Style.json, capped at 1,500)
5. Character block                  (only characters appearing in the surrounding prose, capped at 2,000)
6. Location block                   (only locations appearing in the surrounding prose, capped at 800)
7. Continuity block                 (preceding chapter's Continuity, capped at 1,000)
8. Surrounding prose                (tool-specific window)
9. Target selection                 (the passage; refuses if > 1,500 tokens)
10. Output format reminder          (~50 tokens)
```

The system preamble, fixed across all phase 1 tools:

> You are a writing assistant for a novelist. You preserve the author's voice. You edit only what is asked. You return only the requested output, in plain prose, with no headers, no commentary, no metadata. You preserve every named character, every named place, and the point of view. If the user's instruction would require changing something outside the selection, refuse and explain.

The total prompt is capped at a model-dependent input budget (default 6,000 input tokens; configurable per model in Settings).

### Trimming policy

Relevance-first, surroundings-second. The bible is the small, hard-won, high-signal context; the surrounding prose is cheap to reconstitute. So:

- Characters and Locations are filtered by name match against the surrounding prose. Only entities that appear are included.
- Style is filtered to the action-relevant subset (per tool — see `src/ai/prompts/buildPrompt.ts`).
- If the prompt still exceeds budget, the surrounding-prose window shrinks first, down to a floor (100 before / 50 after).
- If still over budget, the Continuity block is dropped (with a warning surfaced to the user).
- Only if still over budget do character and location entries get summarised to one-line versions.
- The target selection and the action instruction are never trimmed.

## Confidence checks

Before showing any polish proposal, three local checks run on the AI's output:

1. **Named characters preserved.** Every character name (primary or alias) that appears in the input also appears in the output. Failure → warning banner "AI output drops a character name: <name>."

2. **Named locations preserved.** Same shape for locations.

3. **Pronoun pattern preserved.** Compute the dominant pronoun set of the input (he/she/they/I plus any `pronounPairs` from Style); compute the same for the output; flag a mismatch. Failure → warning banner "AI output changes the dominant pronoun set."

Checks are local string operations — no LLM call. If any check fails the diff still renders, with a warning banner above the Accept button. The user can override. The point is to make the cost legible, not to block.

Phase 2 adds a length-policy check (post-truncation); phase 3 adds a continuity-check that runs against the bible.

## Off-topic detection

After confidence checks, a cheap n-gram overlap check compares input and output token bigrams (Jaccard similarity). If similarity is below 0.15, the diff is suppressed and the user sees "AI returned an unrelated response — try again with more specific guidance, or rephrase your selection." This catches the worst failure mode (the model hallucinates something disconnected from the selection); the threshold is configurable per model.

## Failure model

Every failure surfaces to the user as text, not as a stuck spinner.

- **Empty / whitespace-only output** → "AI returned nothing — try again or refine your guidance." No automatic retry.
- **Output fails a confidence check** → diff renders with warning banner; user decides.
- **Output exceeds length policy** → soft-truncate at the boundary, render with warning "AI returned ~640 words; truncated to 400 to match your target."
- **Output off-topic (Jaccard < threshold)** → diff suppressed; surface the input/output side-by-side with "Unrelated response — try again."
- **HTTP error / network failure** → surface the actual error verbatim with a "Test connection in Settings" link.
- **JSON parse failure on a capture tool** → one repair retry; if that fails, show the raw output and "Capture failed; copy the response or try a smaller selection."
- **Tool refused by the LLM** (e.g. content policy from the BYOAI provider) → surface the refusal text and a hint that the model may not support the requested operation.

## Cost legibility

Every tool button shows an estimated input-token count next to its label, computed from the assembled prompt before the click. The estimator uses an approximate tokenizer (`tiktoken` for OpenAI-compatible models; a character-count fallback for unknown models — 3.8 chars per token, surfaced as "~tokens"). The actual input and output token counts are returned by the LLM call where available and displayed in the result panel after the response.

The Settings modal includes a "per-action cost calibration" widget where the user can map their model to a USD-per-million-input-tokens and USD-per-million-output-tokens. If both are set, the button label includes an estimated USD cost ("Rephrase — ~0.04¢"). If only token counts are calibrated, USD is omitted.

## Privacy posture

Four decisions enforce the local-first posture for AI specifically.

**Session-only API key by default.** The Settings "Remember this key" checkbox is off by default. Off → key lives in `sessionStorage` (gone when tab closes). On → key is encrypted via `crypto.subtle.encrypt` (AES-GCM) with a session-scoped passphrase asked once per browser session, then stored as a record in IndexedDB at `ai-key.encrypted`. The key is never in plain storage.

**No keys in exports.** JSON exports strip every path matching `^ai-key`, `^.*\.encrypted$`, and any field name in `config.json` matching `/key|token|secret/i`. There is no override checkbox.

**No prose leaves the device without an explicit action.** Confidence checks are local. Token estimation is local. Cost calibration is local. The only outbound traffic is when the user clicks a tool button.

**Connection test sends a constant.** The "Test connection" button in Settings sends the fixed string `"Hello"` to the configured endpoint, not user prose.

## Phase 2 tool set (sketch)

Phase 2 ships when phase 1 has passed its gate (see roadmap). The phase 2 additions to the toolset:

- **`write_beat`** — Generates prose for a structured beat card. Input: beat type (action / reaction / dialogue / realization / decision / transition / guide), beat description, target word count (200 / 400 / 600), preceding prose context, following prose context. Output: a draft of the beat's prose. Commit path: staged inside the beat card with Apply / Retry / Discard, where Apply inserts the prose beneath the card and marks the card "done."

- **`summarize_chapter`** — Proposes a continuity Markdown document for the active chapter following the template in the Story Bible doc. Input: chapter content, preceding continuity. Output: a continuity draft. Commit path: rendered into the Continuity tab as a proposal; user edits and accepts.

- **`check_continuity`** — Scans a chapter for contradictions against the bible and preceding continuity. Input: chapter content, full bible, all preceding continuity files. Output: a list of flagged statements with severity (high / medium / low) and the conflicting fact. Commit path: a report panel; no automatic edits. The user navigates to flagged lines and decides what to do.

Phase 2 also unlocks the Beat Anchor insertion UI (already coded but UI-hidden in phase 1) and the Generate Continuity button on the Continuity tab. The Continue Writing action is *not* unhidden — it's replaced by `write_beat` with a "transition" beat type for the use case it covered.

## Phase 3 tool set (sketch)

Phase 3 introduces multi-step orchestration. The new tools:

- **`plan_scene`** — Turns a scene description into a beat sheet (a sequence of beat cards). Input: scene description, characters present, location, target total length. Output: an ordered list of beat cards.

- **`draft_scene`** — Drafts every beat in a plan, in order, with continuity awareness. Input: a plan from `plan_scene`. Output: prose for each beat, concatenated into a scene draft. Internally calls `write_beat` per beat plus `check_continuity` after.

- **`revise_scene`** — Applies revision notes to an already-drafted scene. Input: scene draft, revision notes. Output: a revised scene draft.

- **`audit_continuity`** — Sweeps the entire manuscript against the bible. Input: every chapter, the full bible. Output: a project-wide continuity report.

Phase 3 orchestration is bounded: an agent run has a maximum depth (default 3 levels, configurable in Settings); it can only call tools in the phase 3 manifest; every internal call is logged and visible to the user in a "run trace" panel after the run completes. The user can replay an agent run from a saved trace.

Multi-candidate output ("show me 3 versions") becomes the natural review surface for phase 3: a `draft_scene` run can return N parallel drafts (default 1, configurable up to 3) for side-by-side comparison.

## What we will not ship in any phase

A free-text "ask the AI" chat surface. A tool that can call any other tool. A tool that runs without user invocation. A tool that writes to the manuscript or the bible without an explicit user Accept. A background process that consumes the user's tokens. A telemetry pipeline that reports tool usage to xnovelist's developers.

These are commitments the tool-set doctrine and the master toggle exist to keep.
