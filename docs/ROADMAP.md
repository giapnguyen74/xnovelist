# Roadmap

xnovelist ships in four milestone releases. Each milestone is shippable on its own: a novelist could install v0.1 and write a complete manuscript with it, without ever wanting more. Each later milestone adds an AI tier on top of a foundation that the previous milestone already proved.

The gating rule across the board: a milestone ships when its acceptance criteria pass against a real beta manuscript of at least 30,000 words. We do not ship features; we ship validated capabilities.

## v0.1 — The Editor (AI off)

**Scope.** The full editor and Story Bible, responsive across phone/tablet/desktop, with English + Vietnamese UI translation, AI master toggle hard-coded off (the code is there; the surface is not). This is the AI-skeptical novelist's complete product.

What's in:

- Tiptap-based rich-text editor with Markdown source of truth, configurable typography, distraction-free mode, find/replace (per chapter + project-wide).
- Chapter management: create, delete, rename, reorder; persisted as `Artifacts/chapter-*.md` files in IndexedDB.
- Story Bible workspace with Characters, Locations, Style, Continuity tabs; full manual editing flows; character and location underlines in the editor.
- Snapshots: interval (30 min), pre-restore, manual; LCS diff viewer; configurable retention.
- Cross-tab safety via `BroadcastChannel`.
- JSON backup export and import.
- DOCX export.
- Storage on IndexedDB only, with one-shot migration from predecessor `localStorage` data (if any).
- **Responsive layout** spanning phone (tab-bar nav), tablet (overlay panels), and desktop (three columns). Touch interactions are first-class.
- **UI translations** for English and Vietnamese, picked from `navigator.language` on first run, switchable in Settings.
- **Static-asset deployment** — the build output is a folder of files that opens from any HTTP host, any CDN, or `file://`. CI publishes the bundle for testing on GitHub Pages and Cloudflare Pages.
- Settings modal for project metadata (title, author, genre, POV, tense, **prose language**, target word count, typography defaults). The AI section is present but says "AI features are not yet available."

**Acceptance.** A beta novelist writes a 30,000-word draft across five chapters, populates the Characters and Locations bibles by hand (at least 8 characters, 5 locations), uses snapshots to roll back at least three times, exports JSON and re-imports on a second browser, exports DOCX and opens it in Word/Pages cleanly. The same beta user picks up a phone, opens the same project (after import), and successfully polishes a paragraph — reads cleanly, selects cleanly, scrolls cleanly. A second beta novelist using the Vietnamese UI completes the same flow.

**Why this milestone.** It de-risks the foundation. Every later milestone sits on top of the editor, storage, and bible code that v0.1 ships. If v0.1 has rough edges, every subsequent milestone inherits them. If v0.1 is solid, the AI work that follows can focus on AI without fighting the surface.

**Timeline target.** First milestone. Aim for shippable beta within the first development cycle.

---

## v0.2 — Phase 1 AI (Polish + Tag)

**Scope.** The AI master toggle is unlocked (still off by default). With AI on and BYOAI configured, the Polish panel appears with the five polish tools and the three capture tools.

What's in (additive to v0.1):

- The master AI toggle in Settings.
- BYOAI configuration UI (base URL, model, API key, optional custom headers) with a Test Connection action.
- The Polish panel in the right sidebar — five polish tools (Rephrase, Fix grammar, Vivid, Shorten, Polish dialogue) and three capture tools (Capture characters, Capture locations, Capture style).
- Word-level inline diff preview for every polish proposal.
- Per-row review modal for every bible capture proposal.
- Tool cost legibility: estimated input tokens on every button; actual usage in the result panel.
- Confidence checks (named characters preserved, named locations preserved, pronoun pattern preserved) with warning banners.
- Off-topic detection (Jaccard threshold) with diff suppression.
- API key privacy: session-only by default, AES-GCM encryption for opt-in persistence; exports strip secrets.
- Replay-aware re-polish (second polish on same passage prompts the model to diverge).
- The "Why?" explain-on-demand link on every diff.

**Acceptance.** Every phase 1 acceptance criterion in `AI.md` passes. A beta novelist runs the five polish tools at least 100 times each across a 30k-word draft and reports zero "wrong-passage" or "lost-edit" incidents over two weeks. Capture tools populate the bibles meaningfully without manual cleanup more than ~20% of the time. Bible-driven highlighting works on a manuscript with 25+ characters and 15+ locations without visible lag.

**Why this milestone.** This is the trust-building tier. If polish actions can't be trusted at the sentence level, beat-driven generation (v0.3) and agent writing (v0.4) will inherit the deficit. v0.2 has to be boring before v0.3 can be exciting.

**Timeline target.** Second milestone. Depends on v0.1 being stable.

---

## v0.3 — Phase 2 AI (Beat)

**Scope.** Beat Cards become the generative AI surface. The Continuity tab's AI generator becomes available.

What's in (additive to v0.2):

- Floating in-editor toolbar for inserting beat cards.
- The Beat Anchor Tiptap node surfaced in the UI (already exists in code from v0.1, just hidden).
- The `write_beat` tool: input is a configured beat (type, description, target length); output is a drafted prose card with Apply / Retry / Discard.
- Streaming output in the beat card (already supported by the LLM client; UX work to surface it cleanly).
- The `summarize_chapter` tool: proposes a continuity Markdown draft from the chapter's prose.
- The `check_continuity` tool: scans a chapter against the bible and preceding continuity; reports flagged statements with severity.
- Beat-level diff between retries.
- The "Continue Writing" action surface is *not* re-added; the use case is served by a "transition" beat.

**Acceptance.** Every phase 2 acceptance criterion in `AI.md` passes. At least 100 beats generated and accepted across 10 beta users. Beat-card retry rate stabilises in the 30–50% range. Continuity check has flagged a real contradiction in at least one beta user's manuscript and the user has acted on it. Streaming UX feels smooth on a typical residential connection (10s to first token, 30s for a 400-word beat).

**Why this milestone.** v0.3 introduces generation. It's only safe because v0.2 built the bible the model now references and the trust contract the user already knows. We're widening the AI's role one step.

**Timeline target.** Third milestone. Gated on v0.2 acceptance.

---

## v0.4 — Phase 3 AI (Agent)

**Scope.** Multi-step orchestration. The AI plans, drafts, and self-checks a scene before showing it to the user.

What's in (additive to v0.3):

- The `plan_scene` tool: scene description → ordered beat sheet.
- The `draft_scene` tool: an agent loop that calls `write_beat` per beat in the plan, then runs `check_continuity` against the result.
- The `revise_scene` tool: drafted scene + revision notes → revised scene.
- The `audit_continuity` tool: project-wide continuity sweep.
- An agent-run trace panel: every internal tool call is logged with input/output token counts and elapsed time. The user can replay a run from a saved trace.
- Multi-candidate output (configurable 1–3) for `draft_scene`.
- A hard cap on agent recursion depth (default 3, configurable).
- Cost calibration: USD-per-million-tokens settings; per-run total displayed before launch (estimated) and after (actual).

**Acceptance.** Agent-drafted scenes are accepted (with or without revision) at least 40% of the time across beta. Run traces are readable — beta users can explain to a friend what their last agent run did. Cost calibration matches real bills within ±15% across at least three model providers.

**Why this milestone.** The destination. By the time v0.4 ships, the user has spent months trusting the AI at lower autonomy tiers; the v0.4 trust contract (an agent that drafts within a bounded recursion and presents the result) is something the product has earned the right to offer.

**Timeline target.** Fourth milestone. Gated on v0.3 acceptance and at least 3 months of v0.3 use across beta.

---

## What ships after v0.4

A few things are roadmap-eligible but not committed:

- **EPUB and PDF export.** Useful, mechanical, deferred to keep early milestones focused on the writing experience.
- **Worldbuilding bible** (factions, magic systems, calendars, glossaries) — separate from Locations. Adds in v0.5 if user research demands it.
- **Comments and annotations** anchored to text ranges — author's own marginalia, useful both for solo work and for beta reader feedback (when paired with import/export).
- **A Tauri shell** that wraps the same web app and adds filesystem-folder sync — only if user research demands native filesystem access. The web bundle remains the primary distribution.
- **More language packs** beyond the v0.1 English / Vietnamese defaults — community-contributable JSON files. Spanish, French, Japanese, Mandarin are the likely next set; each ships as a PR adding two JSON files (UI strings + AI prompt pack).
- **Voice dictation** input via the browser's SpeechRecognition API.

Each post-v0.4 candidate gets its own design doc before any code lands. None of them are committed; the project's success at v0.4 will decide what's worth doing next.

---

## What we're not adding to the roadmap, ever (current convictions)

- A free-text "ask the AI" chat surface. Phase 3 agent is bounded; chat is unbounded.
- A cloud sync product run by xnovelist itself. The export/import flow plus a user-chosen file-sync service (iCloud Drive, Dropbox, syncthing) is the model.
- Real-time collaborative editing. Different product, different team.
- A marketplace for templates / prompts / language packs.
- An ad-supported tier.

These are convictions, not rules. They could change with deliberate decision and a recorded rationale, but the default is no.

---

## How we know we're on track

Across all four milestones, the leading indicator we watch is "AI off" usage. If most beta users keep AI off after they've enabled it once, that means the editor and bible are doing the work — which is good. If most users keep AI on continuously, that means the AI tier is valuable — which is also good. If most users disable AI after enabling it (the "tried it, didn't like it" pattern), we have a phase 1 prompt-design problem to investigate.

We do not measure "AI requests per session" as a primary metric. The user's word count growth, snapshot frequency, and bible richness are what matter.
