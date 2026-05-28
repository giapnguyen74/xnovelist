# Non-Goals

What xnovelist explicitly does not try to do, with brief rationale for each. The point of this doc is to make scope arguments resolvable by reference — when a feature request lands that hits one of these, the answer is "see NON_GOALS.md," not a fresh debate.

These are not rules forever. They are the v1 (and probably v2) shape. Changing one requires a deliberate decision recorded in a decision log entry.

## Not a cloud SaaS

No xnovelist account. No server-side manuscript storage. No "log in to sync." The application is a static web bundle that runs in the user's browser against their own IndexedDB and (optionally) their own BYOAI endpoint.

Why: the principle of local-first is the product's defining choice. A novelist's manuscript is a uniquely sensitive document — it's their unfinished work, their identifiable voice, their drafts no human else has seen. Putting it on someone else's server is a transfer of trust we won't ask the user to make.

Sync between devices, when needed, happens via the user's chosen file-sync service applied to the exported JSON bundle (or, future, a Tauri filesystem adapter). xnovelist itself never holds the user's prose.

## Not a chat-based AI writer

No free-text "ask the AI anything" surface. No conversational threads. No persistent AI memory of the user across sessions.

Why: chat is unbounded. The tool-set doctrine in `AI.md` exists precisely because we want every AI behaviour to be named, scoped, and previewed. A chat surface would let the AI invoke any tool, any combination, with any phrasing. That's the opposite of the trust ladder.

Users who want a chat-based AI writer have many other options. xnovelist is opinionated about not being one.

## Not a real-time collaboration tool

No simultaneous editing. No presence indicators. No "shared with Sarah" workflows.

Why: real-time collaboration changes the product's shape. Conflict resolution, presence rendering, server-mediated state, identity primitives — all of it pulls the architecture away from local-first and toward a cloud service. It's a legitimate product but it's a different product. We don't half-ship it.

Beta-reader feedback is handled by the export / import flow plus the user's tool of choice (Google Docs comments, Word track changes, paper printouts). xnovelist makes export clean; the rest is downstream.

## Not a screenplay, stage play, or comic script tool

No sluglines, action lines, character cues. No A/B page formatting. No "panel" or "page" primitives. No industry-standard PDF output for those formats.

Why: prose fiction and dramatic writing have different structural primitives. A tool that does both well is rare and large; we'd do one poorly. Prose fiction is the choice. Tools like Final Draft, Highland, WriterDuet, Trelby, and Fountain-based editors serve dramatic writing better than a forked version of xnovelist would.

## Not a general-purpose Markdown editor

xnovelist is opinionated about being a novel-writing surface. The format toolbar excludes tables, code blocks, math, and complex layout. The chapter structure assumes prose. The Story Bible assumes characters and locations. None of this fits short-form writing (blog posts, articles, notes).

Why: an opinionated tool serves its primary use case better than a generic one. iA Writer, Obsidian, Bear, Ulysses serve general Markdown writing. xnovelist asks more of its user (a Story Bible, a chapter outline, a continuity discipline) and gives more in return.

A novelist who also blogs uses two tools. That's fine.

## Not a publishing or marketing platform

No agent query letter templates. No KDP formatting presets. No book-cover generator. No ad campaigns. No analytics dashboards. No reader-engagement metrics.

Why: those are downstream of the manuscript being done. xnovelist ends at "your DOCX export is clean and your JSON backup is portable." Publishing tools (Vellum, Atticus, Reedsy) take it from there.

## Not a worldbuilding-first tool

Locations exists in xnovelist; a full worldbuilding bible (factions, magic systems, technology, calendars, glossaries, cosmology) does not. World Anvil, Campfire, and Notion-based templates serve worldbuilding better than a generic schema would.

Why: the structural diversity of worldbuilding is too large for a single schema. xnovelist's Locations fits "physical places that appear in the prose." A magic system isn't a place; a calendar isn't a place; trying to fit them in would distort the schema for the things it does cover.

A v0.5 worldbuilding bible may ship if user research justifies it. It would be a separate file with a separate tab, not a generalisation of Locations.

## Not a mobile-replacement for desktop drafting

xnovelist is responsive — phone, tablet, and desktop are all supported, and the same bundle serves all three (see Principle 11). What we don't try to do is make a 60,000-word manuscript a comfortable phone-drafting environment. Long-form drafting works best on larger screens with full keyboards; we don't pretend otherwise.

What mobile-friendly means here, concretely: opening the app on the train and polishing a paragraph works comfortably; navigating chapters, reviewing the bible, and accepting an AI proposal works comfortably; selecting and editing a sentence with a finger works comfortably. What it doesn't mean: a phone-first UI optimised for sustained drafting at the cost of desktop richness.

We never ship a separate "mobile app." There is no companion app, no native build, no PWA install required (though installable PWA is a side benefit of the static bundle).

## Not a proxy or relay service

xnovelist does not run a server, ever, for any purpose. We do not host a CORS-friendly relay so users can reach LLMs that block direct browser calls. We do not host a "trial endpoint" so new users can experience AI features without setting up an account. We do not host a key-management service. We do not host telemetry collection.

If a user's chosen LLM provider blocks browser-origin requests via CORS, the surfaced error is explicit ("This provider rejected the browser preflight; use a different provider or run a local model"). The user fixes the situation by switching providers (most cloud LLM providers do support CORS), by running a local model (Ollama, LM Studio), or by running their own relay — which is not our problem to host and not our software to ship.

The reason is the same reason we don't have a backend at all: any server xnovelist runs is a liability that contradicts the local-first claim. The product is honest about being client-only or it isn't.

## Not an AI prompt-engineering surface

The user does not see the system preamble, does not configure the block-stack order, does not write their own prompts. The tools are tuned by us and shipped fixed.

Why: prompt design is hard. Surfacing it to the user transfers the difficulty rather than solving it. A user who wants to write their own prompts is using xnovelist as a generic LLM frontend; that's not what the product is.

Future versions may expose a small number of curated "prompt variants" per tool (e.g. Rephrase: Conservative / Standard / Bold) as preset choices, not as freeform prompt editing.

## Not a multi-language-pack marketplace

The application ships with two language packs (English and Vietnamese, mirroring the predecessor project's languages) and accepts community-contributed packs via JSON file in a known location. There is no marketplace, no plugin store, no submission flow.

Why: a marketplace requires moderation, hosting, ranking, and trust signals. None of those are core to writing novels. Language packs as Git-distributed JSON files (PRs to the repo, or local files dropped into the user's project folder) are sufficient.

## Not a backend service for telemetry, A/B testing, or remote configuration

The application does not phone home. There is no anonymous usage reporting, no crash reporter, no remote feature flagging. What ships is what runs.

Why: a local-first application that quietly reports usage is not really local-first. We accept the cost (no aggregate telemetry to guide product decisions) in exchange for being honest about the privacy claim.

User research happens by talking to users, not by watching them.

## Not a place for the AI to act autonomously

No background tasks. No "the AI will summarise your chapter while you sleep." No scheduled actions. Every AI invocation is a foreground click.

Why: background AI is the cost-runaway failure mode and the trust-erosion failure mode. The user opens xnovelist and pays for the actions they took, not for actions a daemon took on their behalf.

The closest thing to background work in xnovelist is interval snapshots — and those are local, free, and required by the trust contract.
