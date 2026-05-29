# xnovelist

**A local, AI-optional novel writing app. Pure static bundle. Runs anywhere.**

xnovelist is a serious tool for writing long-form fiction. It is a folder of HTML, CSS, and JavaScript — no backend, no account, no xnovelist server. You can host it on GitHub Pages, on Cloudflare, on a USB stick, or open it from your hard drive. Your manuscript stays in your browser's IndexedDB, on your device.

The app works fully without AI. A novelist who never enables it gets a complete writing environment: rich-text editor, chapter outline, Story Bible (characters, locations, voice, continuity), automatic snapshots with line-level diff, find/replace across the manuscript, distraction-free mode, DOCX export. A novelist who enables AI gets a calibrated three-phase assistant — polish a passage, write a beat, draft a scene — with a fixed, named tool set at each tier.

The four product decisions that shape every other choice:

1. **Pure client-side, no server, ever.** Static asset bundle. Deploys to any CDN, opens from `file://`. We do not run a backend and never will.
2. **Mobile, tablet, desktop — same bundle.** Responsive layout. Touch interactions are first-class. The same web app fits a phone on the train and a desktop at home.
3. **Bring your own AI, direct.** OpenAI, OpenRouter, Anthropic via shim, local Ollama, local LM Studio, anything that speaks OpenAI Chat Completions. The user's browser talks to the model directly. We host no proxy.
4. **Multilingual: UI and prose, independent.** UI in your language. AI prompts in the language your novel is written in. The two settings move separately.

---

## Who this is for

If you write novels and you've been looking for a tool that takes your work as seriously as you do — without forcing AI on you — xnovelist is for you. Two specific shapes of writer:

- The novelist who is sceptical of AI in writing. xnovelist works fully without ever turning AI on, and it's built so that the AI-off experience is the first-class experience, not a stripped-down one.
- The novelist who is curious about AI but wants discipline. xnovelist phases the AI into three tiers, each with a defined tool set, each requiring the previous tier to feel trustworthy before it opens. Nothing about the AI surface is unbounded.

If you want a chat-based AI writing assistant, a cloud-based document collaborator, or a screenplay tool, xnovelist is the wrong product for you. See [`docs/NON_GOALS.md`](docs/NON_GOALS.md) for the explicit list of what we don't do.

---

## The docs pack

This repo's planning, decisions, and concept documents live under `docs/`. Read in this order for the first pass:

1. [`docs/VISION.md`](docs/VISION.md) — what xnovelist is, who it's for, what it isn't
2. [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md) — the twelve design invariants (the four product decisions plus the disciplines that keep them honest)
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — tech stack, folder structure, module boundaries, mobile responsiveness, i18n module
4. [`docs/STORAGE.md`](docs/STORAGE.md) — IndexedDB, schemas, migration, export
5. [`docs/EDITOR.md`](docs/EDITOR.md) — the writing experience without AI; desktop/tablet/phone layouts
6. [`docs/STORY_BIBLE.md`](docs/STORY_BIBLE.md) — characters, locations, style, continuity; prose-language vs UI-language
7. [`docs/AI.md`](docs/AI.md) — the AI tool sets per phase, BYOAI endpoint matrix, multilingual prompt packs
8. [`docs/ROADMAP.md`](docs/ROADMAP.md) — milestones and gates
9. [`docs/NON_GOALS.md`](docs/NON_GOALS.md) — explicit cuts, including the no-proxy commitment

Every document is structured to stand alone. If you only have time to read one, read `AI.md` — it captures the most distinctive design decisions in the project.

---

## Status
 
v0.1 Implemented (AI-Free Basic Novel Editor). The first shippable core of xnovelist featuring local-first IndexedDB persistence, safe snapshots, an elegant writing canvas, character and location bible workspaces, and DOCX manuscript export.

---

## Getting Started

First, install the dependencies:

```bash
npm install
```

### Run in Development Mode
Run the local development server:

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Build and Export for Production
Build the app for static production export:

```bash
npm run build
```
The built static website assets will be placed inside the `out/` folder, ready to be deployed to any static host or opened directly.

---

## Tech stack at a glance

Next.js 15 (static export, `output: "export"`) · React 19 · Tiptap 3 · Tailwind 4 (responsive breakpoints) · IndexedDB via `idb` · zod for schema validation · `docx` for export. Build output is a folder of static files — that is the entire deployment artefact. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture and rationale.

---

## Deployment   

The application is a pure client-side static site. Three reference deployments:

- **GitHub Pages (Automated)** — The project includes a built-in GitHub Actions workflow under `.github/workflows/deploy.yml`. When you push code changes to the `main` branch, it automatically runs the production build and deploys the output to your GitHub Pages site.
- **CDN (Cloudflare Pages, Netlify, S3+CloudFront)** — Run `npm run build` and upload the compiled static `out/` folder directly.
- **Local / Self-hosted HTTP** — Serve the static `out/` folder with any static file server (such as `npx serve out` for offline local use, or Python's `http.server`, `nginx`, and `caddy` for self-hosting). Because it is a static-only client application, it does not require a custom backend API server or database runtime.

No environment variables, no secrets, no manual deploy scripts beyond `npm run build`. The bundle CI builds is the bundle the user runs.

---

## License

To be determined. The leading candidate is a permissive open-source license (MIT or Apache 2.0) so that the local-first promise is fully verifiable — anyone can read the source, build it themselves, and confirm it isn't phoning home. A final decision lands before v0.1 ships.
