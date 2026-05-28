# Architecture

## Tech stack

xnovelist ships as a **pure-client static single-page web application**. The build output is a folder of HTML, CSS, JavaScript, and asset files — nothing else. No Node runtime, no API tier, no database, no server-rendered routes, no edge functions. The same bundle deploys identically to a CDN, an internal HTTP server, a USB stick, or a local filesystem opened via `file://`.

The committed stack:

- **Next.js 16** with `output: "export"` — static site generation. We use Next for the developer experience (routing, build pipeline, TypeScript ergonomics) but never for its server features.
- **React 19** as the UI runtime.
- **Tiptap 3** as the rich-text editor. ProseMirror underneath, extensible enough to host our custom marks (locked passages, character highlights, location highlights) and our custom nodes (beat anchors in phase 2).
- **Tailwind CSS 4** for styling, with responsive breakpoints exercised on every component. No component library — we hand-author what we need.
- **idb** (Jake Archibald's library) as a thin wrapper over IndexedDB.
- **zod** for runtime schema validation of every persisted JSON document and every i18n language pack.
- **docx** library for DOCX export. EPUB / PDF deferred.
- **Vitest** + **Testing Library** for tests.
- **TypeScript 5**, strict mode, no `any` outside explicit escape hatches.

The build output is the deployment artefact. It is what serves from a CDN. It is what opens from a USB stick. It is what the user can audit. There is nothing else.

Why not Tauri / Electron: a static web bundle reaches more users (including iPad and Chromebook), deploys more easily, and has no native-build pipeline to maintain. The trade-off is that we cannot read the filesystem directly — but IndexedDB plus first-class export covers the local-first need. If a future user research wave demands a native shell, the same web app embeds inside Tauri trivially.

Why not Svelte / Solid / Vue: React + Tiptap is the most mature pairing for serious text editing on the web. The alternatives have advantages (smaller bundles, simpler reactivity) but the editor risk is the dominant risk, and we choose the lower-risk path.

Why not a monorepo: the previous incarnation of this project tried to be a monorepo with an extractable engine, never finished the extraction, and ended up with a single app aliased to look like a package. xnovelist is honest about being one application. If the engine ever needs to be reused (CLI, plugin host, mobile shell), we extract it then.

## Folder structure

```
xnovelist/
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── vitest.config.ts
├── public/
├── docs/                       (this docs pack)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            (shell; mounts editor or settings)
│   │   └── globals.css
│   ├── editor/                 (writing surface, no AI)
│   │   ├── Editor.tsx
│   │   ├── ChapterList.tsx
│   │   ├── FormatToolbar.tsx
│   │   ├── DistractionFreeMode.tsx
│   │   ├── FindReplace.tsx
│   │   ├── extensions/
│   │   │   ├── locked-passage-mark.ts
│   │   │   ├── character-highlight.ts
│   │   │   ├── location-highlight.ts
│   │   │   └── beat-anchor.ts          (phase 2)
│   │   └── tiptap-config.ts
│   ├── bible/                  (Story Bible — characters, locations, style, continuity)
│   │   ├── CharactersTab.tsx
│   │   ├── LocationsTab.tsx
│   │   ├── StyleTab.tsx
│   │   ├── ContinuityTab.tsx
│   │   ├── schemas/
│   │   │   ├── project.ts              (zod schemas)
│   │   │   ├── characters.ts
│   │   │   ├── locations.ts
│   │   │   ├── style.ts
│   │   │   └── continuity.ts
│   │   └── renderers/                  (json → markdown view)
│   ├── storage/                (persistence — IndexedDB only)
│   │   ├── ProjectStorage.ts           (interface)
│   │   ├── IndexedDBProjectStorage.ts  (only adapter shipped)
│   │   ├── migrate-from-localstorage.ts (one-shot)
│   │   ├── quota.ts                    (navigator.storage.estimate)
│   │   └── snapshots/
│   │       ├── snapshotStore.ts
│   │       └── lcsDiff.ts
│   ├── ai/                     (AI layer — every action lives here)
│   │   ├── enabled.ts                  (master toggle plumbing)
│   │   ├── tools/                      (one file per named tool)
│   │   │   ├── rephrase.ts
│   │   │   ├── fix_grammar.ts
│   │   │   ├── vivid_detail.ts
│   │   │   ├── shorten.ts
│   │   │   ├── polish_dialogue.ts
│   │   │   ├── capture_characters.ts
│   │   │   ├── capture_locations.ts
│   │   │   ├── capture_style.ts
│   │   │   └── (phase 2/3 tools added here)
│   │   ├── prompts/
│   │   │   ├── buildPrompt.ts          (block-stack assembly)
│   │   │   ├── trimming.ts             (relevance-first trimming)
│   │   │   └── system-preamble.ts
│   │   ├── llm/
│   │   │   ├── LLMClient.ts            (interface)
│   │   │   ├── OpenAIClient.ts         (only adapter shipped v1)
│   │   │   └── MockLLMClient.ts        (for tests)
│   │   ├── runTool.ts                  (single dispatch entry point)
│   │   ├── confidence.ts               (post-output local checks)
│   │   └── cost.ts                     (token estimator)
│   ├── ui/                     (cross-cutting components)
│   │   ├── DiffPreview.tsx
│   │   ├── BibleCaptureModal.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── QuotaIndicator.tsx
│   │   ├── CrossTabBanner.tsx
│   │   └── responsive/                 (mobile-specific affordances; touch helpers)
│   ├── i18n/                   (multilingual: UI translations + AI prompt packs)
│   │   ├── ui/
│   │   │   ├── en.json                 (UI string table — buttons, labels, menus)
│   │   │   ├── vi.json
│   │   │   └── schema.ts               (zod schema for UI packs)
│   │   ├── useTranslation.ts           (t(key) helper, picks pack from settings)
│   │   ├── detect.ts                   (browser locale → supported language)
│   │   └── (note: AI prompt packs live under src/ai/prompts/packs/)
│   ├── lib/
│   │   ├── defaults.ts                 (single source of truth for default schemas)
│   │   ├── markdown.ts                 (md ↔ tiptap)
│   │   ├── tokens.ts                   (approximate token counting)
│   │   └── crypto.ts                   (AES-GCM wrappers for opt-in key persistence)
│   └── types/
│       └── (shared cross-module types)
└── tests/
    └── (vitest test files mirror src/)
```

## Module boundaries

Five modules, each with a clear boundary. The contract between modules is enforced through TypeScript types and a small set of public exports — internal modules don't reach across boundaries.

**`editor/`** owns the writing surface and the Tiptap configuration. It reads from `storage/` via React hooks; it knows nothing about `ai/`. If AI is enabled, the Polish panel mounts alongside the editor; the editor doesn't know whether AI is on.

**`bible/`** owns the four Story Bible files and their UI. It reads and writes through `storage/`. It exposes a `useBible()` hook that other modules use to read bible state. When AI captures propose changes, they're routed through `bible/` to be reviewed and committed.

**`storage/`** owns IndexedDB, the `ProjectStorage` interface, and the snapshot system. Nothing in any other module calls IndexedDB directly. All persistent state goes through this module. The interface (`readFile / writeFile / deleteFile / listFiles / exists`) is small enough that swapping the backend (Tauri filesystem, future cloud sync) is a single-class implementation.

**`ai/`** owns every tool, every prompt, every LLM call. Other modules invoke AI only via `runTool({ tool, args })`. The `ai/` module never directly mutates editor state or bible state — it returns proposals that the caller commits via the appropriate module's commit path. If AI is disabled, `runTool` throws synchronously; the master toggle is enforced at this single seam.

**`ui/`** holds the cross-cutting components — the diff preview, the bible capture modal, the settings modal, the quota indicator. These are pure presentation; they receive data and callbacks as props.

**`i18n/`** owns UI translations and the `useTranslation` helper. Every user-facing string in the application goes through `t(key)`. There are no inline literal strings in component code. The supported language packs (English, Vietnamese in v0.2; more community-contributable) are validated at app start via zod. The AI prompt packs live under `ai/prompts/packs/` and are loaded by the AI module independently — by design, the UI language and the prose language are decoupled (see Principle 12 in `PRINCIPLES.md`).

The strictness of these boundaries is what keeps the AI-optional principle honest. The editor module compiles and runs with `ai/` deleted from the source tree; the only break would be a few component imports that we'd stub.

## Mobile and responsive

xnovelist ships a single responsive layout covering phone, tablet, and desktop. There is no separate mobile build, no native shell, no companion app — Principle 11 forbids them. The Tailwind config defines three breakpoints aligned to common form factors: `sm` (640px, large phones in landscape), `md` (768px, tablets in portrait), `lg` (1024px, tablets in landscape and small laptops).

Layout adaptations across breakpoints:

- **Phone (default to `sm-1`):** single column. The chapter list, editor, bible, and AI panel are stacked behind a bottom tab bar. The user taps the bar to switch between Outline, Write, Bible, Polish. Text selection invokes a floating action sheet (the same one that appears on the floating pill at desktop). The format toolbar collapses into a kebab menu in the top bar.

- **Tablet (`md` to `lg-1`):** two columns. Outline or AI panel slides in from the side as an overlay; the editor occupies the full canvas otherwise. Touch-first interactions (drag-to-reorder chapters with a clear handle; long-press for context menu) work alongside mouse and keyboard.

- **Desktop (`lg` and up):** three columns as documented in `EDITOR.md`. The full layout.

The interaction layer (selection, drag, long-press, keyboard shortcuts) is touch-clean in CSS — minimum 44px tap targets per Apple HIG, `:hover` states gated by `@media (hover: hover)` so they don't get stuck on touch devices, momentum scrolling preserved by avoiding `overflow: hidden` traps. Accessibility checks include touch-target audit in CI via Playwright.

Mobile-specific affordances under `src/ui/responsive/`: a `SwipeableTabBar`, a `MobileActionSheet`, a `TouchSelectionHandles` helper that augments Tiptap selection for finger-precision adjustment, a `MobileDiffViewer` that stacks the before/after inline rather than side-by-side at narrow widths.

We do not try to make a 60,000-word manuscript a comfortable phone-drafting environment. We do try to make "open the app on the train, polish a paragraph, save" comfortable on a phone. The first is a different product; the second is what mobile-friendly means here.

## Internationalisation

Every user-facing string is referenced through `t(key)`, never written as a literal. Pack files live at `src/i18n/ui/{lang}.json`. Each is validated at app start against `src/i18n/ui/schema.ts` (zod). A missing key falls back to the English string, with a development-mode warning.

The active UI pack is chosen at startup:

1. If the user has set a language in Settings, use it.
2. Otherwise, use `navigator.language` matched against the supported pack set.
3. Otherwise, default to English.

The user can change the UI language in Settings at any time without losing project state. The change applies immediately; no reload.

The AI prompt packs are independent (lives under `src/ai/prompts/packs/`) — see `AI.md` for the full design. The architectural commitment here: the i18n module does not reach across into AI prompt loading. They are separate concerns served by separate code paths.

## Build, dev, and test

```
npm install            # install dependencies
npm run dev            # next dev (webpack); http://localhost:3000
npm run build          # next build with static export → out/
npm run test           # vitest run
npm run test:watch     # vitest watch mode
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
```

CI runs `lint + typecheck + test + build` on every push and pull request. Builds that fail any of the four fail CI. There is no "skip CI" affordance.

The static export under `out/` is the deployment artefact. It can be served from any static host or opened directly from disk. The README's deployment section documents three reference deployments (GitHub Pages, Netlify, local `file://`).

## Static export caveats

A few things `output: "export"` rules out, accepted deliberately:

- No server-side rendering. The editor is client-only anyway; this is no loss.
- No Next.js API routes. The application has no backend, so this is no loss.
- No image optimisation pipeline. Bible-attached images and chapter-embedded images use `<img>` tags with local blob URLs from IndexedDB.
- `basePath` must be set for sub-path deployments (e.g. GitHub Pages project sites). The config reads `NEXT_PUBLIC_BASE_PATH` and applies it.

These are the right trade-offs for a single-user, local-first application.

## Versioning and the schema migration story

Every persistent JSON document has a `schemaVersion` integer field. The application reads `schemaVersion` on load; if it's older than the current code expects, the migration pipeline runs (a sequence of pure functions, one per version step) to upgrade in place. Snapshots are taken before any migration runs. Migrations are committed to the repository, never deleted — the codebase always carries the forward path from every shipped version.

If `schemaVersion` is newer than the code expects (the user opened an older xnovelist build on data from a newer one), the application refuses to load and shows a "your data is from a newer version of xnovelist; please update" message. We never down-migrate.
