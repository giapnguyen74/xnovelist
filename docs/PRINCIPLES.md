# Principles

These are the design invariants. When a feature request, an architectural decision, or a contributor PR conflicts with a principle, the principle wins. We change a principle only with a deliberate decision recorded in the project's decision log.

The first four are the foundational product decisions. The remainder are the disciplines that keep those four honest.

## 1. AI is optional and additive

The application must be useful to a novelist who never enables AI. The master AI toggle in Settings is **off** by default; the editor, Story Bible, snapshots, search, and export work fully without any AI configuration. When AI is off, the AI panel is hidden, the AI menu items are hidden, capture affordances are hidden, and no LLM endpoint is ever contacted.

When AI is on, every AI surface is opt-in at the action level too. Nothing runs in the background. Nothing auto-applies. The author writes; the AI waits to be asked.

## 2. Pure client-side, no server — ever

xnovelist is a static asset bundle: HTML, CSS, JavaScript, and a small `public/` folder of fonts and icons. It deploys to any static host — GitHub Pages, Cloudflare Pages, Netlify, S3, an internal HTTP server, a USB stick. It opens from `file://` if the user double-clicks the `index.html`. There is no backend, there is no xnovelist API tier, there is no xnovelist server of any kind. We do not run one and we never will.

Manuscripts, bibles, snapshots, and settings live in IndexedDB on the user's device. Outbound network traffic happens only when the user clicks an AI action, and it goes directly from the user's browser to the LLM endpoint they configured (see Principle 3). The application does not telemeter, fingerprint, or report.

A CDN may serve the static bundle. A CDN does not see writing.

## 3. BYOAI direct — no proxy, no broker

xnovelist does not ship with an LLM, does not host an LLM, and does not relay LLM calls. When the user runs an AI action, the request goes from the user's browser straight to the endpoint the user configured. The endpoints we support in practice:

- **OpenAI** directly, with the user's own API key from their own subscription.
- **Anthropic** via any OpenAI-compatible adapter (Claude has a native API, and third-party shims expose it via the Chat Completions schema).
- **OpenRouter** and other federated providers, with the user's own account.
- **Local Ollama**, typically at `http://localhost:11434`.
- **Local LM Studio**, typically at `http://localhost:1234`.
- **Any OpenAI Chat-Completions-compatible endpoint** the user can reach from the browser.

The application does not subsidise, broker, rebill, or proxy model calls. There is no xnovelist-issued key on the user's behalf. There is no fallback to a "default model" if the user has no key — the AI surface is disabled until the user configures their own endpoint.

This commits us to practical constraints. Prompts use the OpenAI Chat Completions schema (the lowest common denominator). The user is responsible for CORS — most cloud LLM providers configure CORS to permit browser calls; some don't, in which case the user picks a CORS-friendly provider, runs a local model, or runs their own thin proxy that we do not host. The application surfaces a clear, specific error when a CORS failure occurs (not just "request failed").

## 4. The author owns the prose

Every AI proposal is presented as a diff. Every diff requires an explicit Accept. There is no auto-apply, no inline ghost-text, no "the AI is writing your draft" state. The author can reject any proposal at any time. The author can roll back any committed change via the snapshot system.

The corollary: the AI never writes to the Story Bible or to chapter files without the user accepting the change. Capture actions return merge proposals, not writes.

## 5. Snapshots are sacred

Every interval (default 30 minutes of activity), every pre-AI action, and every pre-restore action takes a snapshot of the affected file. Snapshots are stored with the project. The snapshot index is durable; pruning happens by deliberate retention policy, never silently. The user can always roll back to any snapshot.

If the snapshot system is broken, the application refuses to run AI actions. The trust contract depends on the rollback path.

## 6. Privacy is the default posture

The API key is held in `sessionStorage` by default — gone when the tab closes. Persistence is opt-in and encrypted. Backups never include API keys. The estimated-tokens gauge is computed locally; nothing leaves the device to compute it.

We do not include third-party analytics, fonts loaded from CDN that could fingerprint, or A/B testing harnesses. The application's hash of code on first load is the hash of code on last load.

## 7. Cost is legible

Every AI action shows its estimated input-token cost before the user clicks. The user knows the price before paying it. This is the BYOAI version of a checkout screen — the user is on the hook for the bill and deserves to see it.

## 8. Tool sets are explicit, not emergent

Each AI phase exposes a named, fixed set of tools. The user can read the list, understand each tool's scope, and trust that no unnamed tool is in the loop. We do not add a free-text "ask the AI" surface that could call any tool. We do not let one tool silently invoke another. If the AI's behaviour can't be enumerated, it isn't shipped.

## 9. The bible serves the human first

The Story Bible (Characters, Locations, Style, Continuity) is a reference the human uses while writing. The AI consumes it, but the bible's design priority is the author's ability to add, edit, and skim it without friction. If a schema change makes the bible better for the AI but worse for the human, we don't make the change.

## 10. One application, single-user, single-install

No collaboration features in v1. No cloud sync built into the product. No multi-tenancy. The user opens xnovelist on their device and writes. If they need to share with a beta reader, they export. If they need to sync across devices, they use the file system or a backup service they already trust. The product stays narrow on purpose.

## 11. The writer's device, whatever it is

Novelists do not write exclusively at desks. They draft on phones during commutes, revise on tablets in coffee shops, polish on laptops at home. xnovelist is designed to work on all three.

The editor, the bible, and the AI surfaces all have a responsive layout that works at desktop, tablet, and phone widths. Touch interactions are first-class — text selection, the AI affordances, snapshot navigation, find/replace, and the bible edit forms all work with a finger as well as with a mouse. There is no separate mobile app; the same static bundle serves every device, and the user's IndexedDB state lives on the device they last wrote on (cross-device sync is via export/import, as elsewhere in the product).

We design *for* phone last in the layout sense — desktop has more real estate, so the desktop layout is the richest. We test *for* phone first in the interaction sense — if a tap target is too small for a thumb, or a gesture conflicts with the browser's native scroll, that gets fixed before the desktop version of the same affordance is considered done.

## 12. Multilingual by design — UI and prose are independent

A novelist who writes in Vietnamese deserves a tool whose UI labels are in Vietnamese *and* whose AI prompts ask the model to think in Vietnamese. These are independent settings.

The UI language tracks the user's preference, set in Settings, defaulting to the browser's detected locale. The novel's prose language tracks the project, set in the project's metadata when the project is created and editable thereafter. The two are decoupled: an Anglophone editor working on a Vietnamese-language novel uses an English UI but issues Vietnamese AI prompts.

The AI prompt assembler picks its language pack from the project's prose language, never from the UI language. A user with an English UI writing a Vietnamese novel gets Vietnamese prompts producing Vietnamese output. A user with a Japanese UI writing a French novel gets French prompts producing French output.

Language packs are JSON files in the repository: `src/i18n/ui/{lang}.json` for the UI; `src/ai/prompts/packs/{lang}.json` for the AI. Adding a language is a pull request — no infrastructure, no API. The initial languages shipped are English and Vietnamese; further languages are community-contributable.
