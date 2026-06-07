# xnovelist

**Write your novel on your own machine. Own every word. Pay no subscription.**

Most AI novel-writing tools are SaaS, and the meter is always running. The pricing models differ but the shape is the same — a recurring bill and your manuscript on someone else's server:

- **Sudowrite** — a flat monthly subscription, metered in credits.
- **NovelAI** — tiered monthly plans on a token system (with higher tiers for heavier generation).
- **Novelcrafter** — a low monthly platform fee *plus* pay-as-you-go API usage billed by third-party AI providers on top. 

Depending on how much you write and which models you choose, real-world cost can land anywhere from roughly **$5 to $150 a month**.

(These are legitimate tools, and their prices change — check their sites for current numbers.) The common thread: you rent the software, and your draft lives in their cloud.

**xnovelist takes the other path.** The app is free and open-source. It's a folder of HTML, CSS, and JavaScript — no backend, no account, no xnovelist server. Your manuscript lives in your browser's IndexedDB, on your device. For AI, you **bring your own**: plug in your own provider key and pay that provider directly at cost, or point it at a **local model** (Ollama, LM Studio) and pay nothing at all — in which case **nothing ever leaves your computer.**

- **$0 for the app.** Open-source, host it yourself, or open it from a file on disk.
- **AI is optional and yours.** No key, no AI — a complete writing tool. Add a key and pay your provider at cost, or run local and pay nothing.
- **Local-first, privacy-first.** Your prose stays on your device. With a local model the whole loop is offline.
- **Auditable.** It's open source — read it, build it, confirm it isn't phoning home.

---

## What it is

xnovelist is a serious tool for writing long-form fiction. You can host it on GitHub Pages, on Cloudflare, on a USB stick, or open it straight from your hard drive.

It works **fully without AI**: rich-text editor, chapter outline, Story Bible (characters, locations, voice, continuity), automatic snapshots with line-level diff, find/replace across the manuscript, distraction-free mode, DOCX export. The AI-off experience is the first-class experience, not a stripped-down one.

When you *do* want AI, it's introduced on a dial you control — see "The AI levels" below.

The four product decisions that shape every other choice:

1. **Pure client-side, no server, ever.** Static asset bundle. Deploys to any CDN, opens from `file://`. We do not run a backend and never will.
2. **Mobile, tablet, desktop — same bundle.** Responsive layout; touch interactions are first-class.
3. **Bring your own AI, direct.** OpenAI, OpenRouter, Anthropic, local Ollama, local LM Studio — anything that speaks OpenAI Chat Completions. Your browser talks to the model directly. We host no proxy and hold no key.
4. **Multilingual: UI and prose, independent.** The interface in your language; the AI works in the language your novel is written in. The two settings move separately.

---

## The AI levels

AI is **off by default** and governed by a single dial — a workspace **level from 0 to 5**. The level is a ceiling on how far the AI may reach into your prose, and it decides which tools exist. Every AI result appears in a right-hand **Agent panel** as a proposal you **accept or reject** — nothing is written to your manuscript or Story Bible without your explicit Accept.

- **L0 — Off.** No AI. No network calls. The complete manual writing desk.
- **L1 — Reader.** The AI reads your book but never writes prose: capture characters/locations/style into the Story Bible, summarize a chapter, check continuity against established facts.
- **L2 — Editor.** Light-touch edits to text *you selected* — rephrase, fix grammar, shorten, polish dialogue, sharpen detail. It reshapes your words; it never starts a sentence.
- **L3 — Co-writer.** Writes a passage inside a beat you outlined. *(designed; in progress)*
- **L4 — Drafter.** Drafts a scene you described. *(designed)*
- **L5 — Agent.** Bounded, audit-logged work across the whole manuscript. *(designed)*

The meaningful line is **L2 → L3**: at L2 and below, every word the AI touches was your word first; only at L3+ does it generate new prose. You set the level; you can lower it any time and the app is identical to its AI-free self.

---

## Who this is for

If you write novels and want a tool that takes your work as seriously as you do — without forcing AI on you or charging you rent — xnovelist is for you. Two shapes of writer especially:

- **The AI sceptic.** Turn AI off (or never turn it on) and get a first-class, distraction-free writing environment.
- **The disciplined AI-curious.** The level dial and the accept/reject Agent panel keep every AI action named, scoped, and previewed. Nothing about the AI surface is unbounded.

If you want a chat-based ghostwriter, a cloud collaboration suite, or a screenplay tool, xnovelist is the wrong product. See [`docs/NON_GOALS.md`](docs/NON_GOALS.md).

---

## Status

- **v0.1 — AI-free core.** Local-first IndexedDB persistence, safe snapshots, the writing canvas, character/location bible workspaces, DOCX export.
- **v0.2–0.3 — Bring-your-own-AI + the level system.** Provider configuration (OpenAI, Anthropic, OpenRouter, local), connection testing, and the workspace level dial.
- **v0.4–0.7 — The Agent engine, Levels 1 & 2.** A modular AI engine where the model only *proposes* and the app *applies* on your Accept: L1 capture/summary/continuity tools and L2 selection edits, surfaced as accept/reject cards in the Agent panel, with style/continuity-aware context and local guardrails. Levels 3–5 are designed and scaffolded.

Design and decision logs live under [`works/`](works) (the `NN-action.md` slices) and [`docs/`](docs).

---

## Getting started

```bash
npm install
npm run dev      # dev server at http://localhost:3000
npm run build    # static export into out/
```

The built `out/` folder is the entire deployment artefact — host it anywhere, or open `out/index.html` directly.

To use AI, open Settings → AI Connections, set the level to 1+, and add a provider (a cloud key, or a local endpoint like `http://localhost:11434/v1` for Ollama).

---

## Tech stack at a glance

Next.js 15 (static export, `output: "export"`) · React 19 · Tiptap 3 · Tailwind 4 · IndexedDB via `idb` · zod for schema validation · `docx` for export. Build output is a folder of static files — that is the entire deployment artefact. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## The docs pack

Planning, decisions, and concept documents live under `docs/`. First-pass reading order:

1. [`docs/VISION.md`](docs/VISION.md) — what xnovelist is, who it's for, what it isn't
2. [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md) — the design invariants
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — tech stack, folder structure, module boundaries, i18n
4. [`docs/STORAGE.md`](docs/STORAGE.md) — IndexedDB, schemas, migration, export
5. [`docs/EDITOR.md`](docs/EDITOR.md) — the writing experience without AI
6. [`docs/STORY_BIBLE.md`](docs/STORY_BIBLE.md) — characters, locations, style, continuity
7. [`docs/AI.md`](docs/AI.md) — the general AI design: the level model, BYOAI matrix, the proposer/harness split, prompt architecture, guardrails, privacy
8. [`docs/AI_LEVELS.md`](docs/AI_LEVELS.md) — the per-level tool catalogue (levels 0–5)
9. [`docs/ROADMAP.md`](docs/ROADMAP.md) — milestones and gates
10. [`docs/NON_GOALS.md`](docs/NON_GOALS.md) — explicit cuts, including the no-proxy commitment

If you only read one, read `AI.md` — it captures the most distinctive decisions in the project.

---

## Deployment

A pure client-side static site. Three reference deployments:

- **GitHub Pages (automated).** A workflow at `.github/workflows/deploy.yml` builds and deploys on push to `main`.
- **CDN (Cloudflare Pages, Netlify, S3+CloudFront).** Run `npm run build`, upload `out/`.
- **Local / self-hosted.** Serve `out/` with any static file server (`npx serve out`, Python's `http.server`, `nginx`, `caddy`) — or just open the files.

No environment variables, no secrets, no deploy scripts beyond `npm run build`. The bundle CI builds is the bundle you run.

---

## Privacy

Your manuscript and Story Bible never leave your device on their own. AI calls go from your browser **directly** to the provider you configured — there is no xnovelist proxy and we never see a key or a keystroke. Point AI at a local model and the entire loop is offline. API keys are kept session-only by default and never included in exports.

---

## License

To be determined — the leading candidate is a permissive open-source license (MIT or Apache 2.0) so the local-first promise is fully verifiable: anyone can read the source, build it themselves, and confirm it isn't phoning home.
