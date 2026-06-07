# AI

This document specifies the **general AI design** of xnovelist: the philosophy, the master controls, the endpoint model, the doctrine every tool obeys, the prompt architecture, the guardrails, the failure model, and the privacy posture. It is the cross-cutting layer that holds true regardless of which tools are enabled.

For the **per-level tool detail** — exactly which tools a writer gets at each AI level, what each consumes and produces, and how each result is reviewed and committed — see [`AI_LEVELS.md`](AI_LEVELS.md). The split is deliberate: this document is the design; `AI_LEVELS.md` is the catalogue.

The framing throughout: AI is **optional**, **named**, **scoped**, and **previewed**. Every AI behaviour is enumerated. Nothing emerges; nothing is hidden.

**The LLM is a stateless proposer; the harness disposes.** The model is a pure function — a prompt in, structured JSON out. It never executes a side effect and never holds the control flow. Every side effect, every sequencing decision, and every multi-step run is deterministic harness code. xnovelist does **not** use provider function-calling or a tool-execution loop at any level: a single-user, local, deterministic app already knows its steps, and JSON proposals work on every BYOAI model (including local ones) where tool-calling does not. The AI surface is a single **Agent panel** — a composer plus a scrollable transcript of proposed *write-ops* the writer accepts or rejects. See [`../works/05-action.md`](../works/05-action.md) for the panel, the action → proposal → write-op pipeline, and the engine shape.

## The master toggle and the level

AI in xnovelist is governed by two settings that compose:

1. **Enable AI features** — a single switch, **off by default** on a fresh install. Off means: every AI surface is hidden, and no outbound network request to any LLM endpoint is ever made. Off is equivalent to **Level 0** (see `AI_LEVELS.md`).

2. **The AI level** — once AI is enabled, the workspace sits at a level from `1` to `5`. The level is a ceiling on how far the AI may reach into the writer's prose, and it decides which tools are visible. **A tool appears only if its level is `<=` the workspace level.** Lowering the level immediately hides higher-level surfaces and stops making calls at those levels.

With AI enabled, the writer must also configure a BYOAI endpoint (base URL + model + optional API key) before any AI action is available. Until the endpoint is configured, the AI surfaces are visible but disabled with a "Configure your model in Settings" prompt.

Both controls are enforced at a single seam: the `runTool({ tool, args })` dispatcher in `src/ai/runTool.ts`. It checks, synchronously, that AI is enabled (else throws `AIDisabledError`) and that the tool's level is `<=` the workspace level (else throws `AILevelError`). No tool can be invoked through any other path. This is auditable in CI by a lint rule that bans direct imports of any file under `src/ai/llm/` outside of `src/ai/`.

## The level model

xnovelist phases AI in along one axis: **how far the AI reaches into your prose.** Six levels, `0–5`, each a superset of the one below.

- **L0 Off** — no AI.
- **L1 Reader** — the AI reads your book (analysis & capture); it never writes prose.
- **L2 Editor** — the AI edits words you already wrote and highlighted; it never originates a sentence.
- **L3 Co-writer** — the AI writes a passage inside a beat slot you outlined.
- **L4 Drafter** — the AI drafts a scene you described.
- **L5 Agent** — the AI works across the whole manuscript under bounded, audit-logged orchestration.

The meaningful consent line is **L2 → L3**: at L2 and below every word the AI touches was the writer's word first; at L3 and above the AI generates new prose. The level is chosen by the writer to match the help they want, and can change at any time — it is a ceiling, not a graduation earned over time. Full per-level tool sets, contracts, and commit paths live in [`AI_LEVELS.md`](AI_LEVELS.md).

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

## Tool-set doctrine

Three rules that govern every AI tool at every level.

**Named.** Every tool has a unique `tool` identifier (e.g. `rephrase`, `capture_characters`, `write_beat`). The user sees the tool name (or its UI label) before invoking. There is no "ask the AI" free-text surface that could call any tool.

**Scoped.** Every tool declares its input contract (what state it consumes), its output contract (what it produces), its preview surface (how the user reviews), and its commit path (how the result enters the project, if accepted). These are visible in the source under `src/ai/tools/<tool>.ts` and documented per tool in `AI_LEVELS.md`.

**Composed only by the harness, never by the model.** No tool invokes another tool, and the model never decides which tool runs. The writer chooses an action; the harness runs it. When a workflow needs several steps (Level 4 scene drafting, Level 5 agent runs), the **harness** sequences them deterministically — the model is called once per step as a stateless proposer, never given the controls. A Level 5 run is therefore a deterministic pipeline of JSON calls, audit-logged to a run trace for the writer to inspect, not a model-driven tool loop.

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

**Prompt-pack design.** Each pack is a structured JSON document (validated by zod) whose keys mirror the action set: a `system` preamble in the target language; per-tool blocks with `actionInstruction`, `outputFormatReminder`, and tool-specific fields like `vividFocusChips` (each chip's name and its directive). The pack also declares language-specific guidance — pronoun systems (Vietnamese has many; Japanese has more; English has few), dialogue conventions, register markers — that the AI prompt blocks pull from for relevant actions. The integration with the prompt assembler is named: `buildPrompt` calls `loadPromptPack(project.language)`, never reaching across to UI translations.

## Prompt architecture

Every prose-touching tool assembles its prompt from the same block stack, in this order:

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

The system preamble, fixed across all prose-touching tools:

> You are a writing assistant for a novelist. You preserve the author's voice. You edit only what is asked. You return only the requested output, in plain prose, with no headers, no commentary, no metadata. You preserve every named character, every named place, and the point of view. If the user's instruction would require changing something outside the selection, refuse and explain.

The total prompt is capped at a model-dependent input budget (default 6,000 input tokens; configurable per model in Settings). The action instruction and tool-specific fields (temperatures, length policies, context windows) are listed per tool in `AI_LEVELS.md`.

### Trimming policy

Relevance-first, surroundings-second. The bible is the small, hard-won, high-signal context; the surrounding prose is cheap to reconstitute. So:

- Characters and Locations are filtered by name match against the surrounding prose. Only entities that appear are included.
- Style is filtered to the action-relevant subset (per tool — see `src/ai/prompts/buildPrompt.ts`).
- If the prompt still exceeds budget, the surrounding-prose window shrinks first, down to a floor (100 before / 50 after).
- If still over budget, the Continuity block is dropped (with a warning surfaced to the user).
- Only if still over budget do character and location entries get summarised to one-line versions.
- The target selection and the action instruction are never trimmed.

## Confidence checks

Before showing any prose proposal, three local checks run on the AI's output:

1. **Named characters preserved.** Every character name (primary or alias) that appears in the input also appears in the output. Failure → warning banner "AI output drops a character name: <name>."

2. **Named locations preserved.** Same shape for locations.

3. **Pronoun pattern preserved.** Compute the dominant pronoun set of the input (he/she/they/I plus any `pronounPairs` from Style); compute the same for the output; flag a mismatch. Failure → warning banner "AI output changes the dominant pronoun set."

Checks are local string operations — no LLM call. If any check fails the diff still renders, with a warning banner above the Accept button. The user can override. The point is to make the cost legible, not to block.

Level 3 adds a length-policy check (post-truncation); Levels 4 and 5 add a continuity-check that runs against the bible.

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

## Reasoning models

Some models (OpenAI o-series, Anthropic extended thinking, local deepseek-r1 / QwQ) emit hidden chain-of-thought before any visible answer, and those reasoning tokens are drawn from the **output** budget. Two consequences shape our handling:

- **Output budget is a ceiling, set generously.** `max_tokens` only truncates if the model would exceed it — it is not a target and costs nothing extra (local models bill nothing at all). A *small* cap is the danger: a reasoning model can spend the whole budget thinking and return empty content. We send a generous fallback ceiling (overridable per action, and per model later), because Anthropic requires the field and an unbounded local run can hit the context limit or the request timeout.
- **Thinking is stripped from the answer but kept for debug.** The harness removes provider reasoning fields (`reasoning` / `reasoning_content`) and inline `<think>…</think>` wrappers before parsing, so a tool's JSON/prose output is clean. The captured thinking is held in memory only and shown in the Agent panel's optional **Debug** view; it is never persisted, exported, or sent anywhere — consistent with the privacy posture below. The Anthropic response is read from its `text` content block (not block `[0]`), so thinking blocks don't blank the answer.

## Privacy posture

Four decisions enforce the local-first posture for AI specifically.

**Session-only API key by default.** The Settings "Remember this key" checkbox is off by default. Off → key lives in `sessionStorage` (gone when tab closes). On → key is encrypted via `crypto.subtle.encrypt` (AES-GCM) with a session-scoped passphrase asked once per browser session, then stored as a record in IndexedDB at `ai-key.encrypted`. The key is never in plain storage.

**No keys in exports.** JSON exports strip every path matching `^ai-key`, `^.*\.encrypted$`, and any field name in `config.json` matching `/key|token|secret/i`. There is no override checkbox.

**No prose leaves the device without an explicit action.** Confidence checks are local. Token estimation is local. Cost calibration is local. The only outbound traffic is when the user clicks a tool button.

**Connection test sends a constant.** The "Test connection" button in Settings sends the fixed string `"Hello"` to the configured endpoint, not user prose.

## What we will not ship at any level

Model-driven execution of any kind: provider function-calling, a tool-execution loop, or any path where the model — rather than the harness — decides what runs next. A write to the manuscript or the bible without an explicit user Accept of a write-op card. A tool that runs without user invocation. A background process that consumes the user's tokens. A telemetry pipeline that reports tool usage to xnovelist's developers.

A free-text intent box is **not** offered at Levels 1–4 — there the writer chooses a named action from the composer, and the model never selects the operation. The free-text goal box exists **only at Level 5**, where the harness turns the stated intent into a deterministic, audit-logged pipeline of stateless JSON proposals.

These are commitments the proposer/harness split, the tool-set doctrine, the master toggle, and the level ceiling exist to keep.
