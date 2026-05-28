# Storage

## The single backend

xnovelist's persistent state lives in **IndexedDB**. There is no `localStorage` path in the codebase — not for project data, not for settings, not for the API key (`sessionStorage` is used for the ephemeral key path; that is the only other DOM-storage API and it does not hold project data).

The decision is non-negotiable: IndexedDB gives per-origin quotas in the gigabytes (vs. 5–10 MB for `localStorage`), asynchronous reads and writes that don't block keystrokes, and a key-value model that maps cleanly onto a file-path storage interface. The previous incarnation of this project shipped on `localStorage` and hit its ceiling at roughly novella length; we don't repeat that.

## The `ProjectStorage` interface

A single interface gates all persistence:

```ts
export interface ProjectStorage {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(prefix?: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}
```

The single shipped implementation is `IndexedDBProjectStorage`, a thin wrapper over the `idb` library. The interface is small enough that future adapters (a Tauri filesystem adapter, a syncing adapter) are one-class changes; the rest of the application code is unaffected.

No module outside `src/storage/` calls IndexedDB directly. No module outside `src/storage/` calls `localStorage` at all. The lint config enforces both (a custom rule bans `localStorage` and direct IDB API usage outside the storage module).

## File layout — what lives at which path

The storage backend uses string paths as keys. The layout for a project:

```
xnovelist.json                 # manifest sentinel: identifies the store as an xnovelist project
Project.json                   # project metadata: title, author, genre, POV, tense, language, target words
Style.json                     # structured style profile (see Story Bible doc)
Style.md                       # human-readable view, regenerated from Style.json on every write
Characters.json                # structured cast bible
Characters.md                  # human-readable view
Locations.json                 # structured locations bible
Locations.md                   # human-readable view
Continuity/                    # per-chapter continuity (chronological)
  chapter-001.md
  chapter-002.md
  …
Artifacts/                     # the manuscript itself
  chapter-001.md
  chapter-002.md
  …
.history/                      # snapshots, namespaced by file
  Artifacts/chapter-001/
    index.json
    2026-05-27T10-15-00Z--interval.md
    2026-05-27T10-45-00Z--pre-ai.md
    …
config.json                    # BYOAI endpoint config (NOT the key; key handling is separate)
ai-key.encrypted               # only present when "Remember this key" is opted in
```

A few things this layout commits to:

- **Markdown is the source of truth for chapter prose.** `Artifacts/chapter-NNN.md` is plain Markdown; opening it in any other text editor produces a readable file. The Tiptap editor parses Markdown on load and serialises Markdown on save. Custom Tiptap marks (locked-passage, character-highlight, location-highlight) are computed at runtime from the bible, not stored in the file — so the saved Markdown contains only the user's prose.

- **JSON is the source of truth for structured data.** Project, Style, Characters, Locations are JSON. A derived Markdown view exists for readability (and is regenerated whenever the JSON changes) but the JSON drives the application.

- **Continuity is per-chapter and Markdown.** Each chapter's continuity is a Markdown document describing the story state after that chapter, written by the user (in v1) or proposed by the AI (in phase 2). The application reads chapter N-1's continuity as context when working in chapter N. This is the "position-dependent continuity" model carried over from the predecessor project.

- **Snapshots are full file copies indexed by metadata.** `.history/<path>/index.json` lists timestamps, kinds (manual / interval / pre-ai / pre-restore), labels, byte sizes, and content hashes. The snapshot file itself is a full copy of the source at the snapshot moment. Diffs are computed on demand via LCS at view time, not stored.

## Schema validation

Every JSON document is validated against a `zod` schema on every read and every write. Reads that fail validation surface a clear error to the user (with a "restore from snapshot" affordance) rather than crashing the application. Writes that would produce invalid JSON are rejected at the storage boundary; this catches programmer errors in development.

The schemas live in `src/bible/schemas/`. A few representative ones:

```ts
// project.ts
export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string(),
  author: z.string(),
  genre: z.string().optional(),
  pov: z.enum(["first", "second", "third-limited", "third-omniscient"]),
  tense: z.enum(["past", "present"]),
  language: z.string(),                          // ISO 639-1
  targetWordCount: z.number().int().positive(),
  description: z.string().optional(),
});

// style.ts (abridged — see Story Bible doc for full schema)
export const StyleSchema = z.object({
  schemaVersion: z.literal(1),
  rhythm: z.object({…}),
  diction: z.object({…}),
  dialogue: z.object({…}),
  narrativeRegister: z.object({…}),
  sensoryPalette: z.object({…}),
  pronounPairs: z.array(z.string()).optional(),
});
```

The `schemaVersion` field is mandatory on every persisted JSON document. The migration pipeline (see Architecture doc) reads this field to decide whether to upgrade.

## Migration from a predecessor's `localStorage`

On first load, the application looks for a `migration-v1-completed` marker in IndexedDB. If absent, it scans `localStorage` for keys matching predecessor patterns (`Novelwrite.json`, `Artifacts/*`, `Continuity/*`, `Style.md`, `Characters.md`, `Characters.json`, `Continuity.md`, `config.json`, `.history/*` and the legacy `novelwrite-chapters` blob). For each match, it copies the value into IndexedDB at the equivalent xnovelist path, runs schema upgrades if needed, and verifies the round-trip read. Only after all matches are verified does it write the `migration-v1-completed` marker and clear the migrated keys from `localStorage`.

If any step fails, `localStorage` is left intact and the user sees a "Storage migration failed; your data is safe in browser storage. Please reload or report this." panel. We never silently lose data.

After migration, the application does not read or write `localStorage` again. The codebase contains no `localStorage` API usage outside the migration module.

## Quota management

The left sidebar carries a quota indicator backed by `navigator.storage.estimate()`. It surfaces the used and available bytes. At 80% of available, a banner appears in the editor prompting the user to export and trim. At 95%, write operations surface a "Storage nearly full — please export and clear old snapshots" error rather than crashing.

The snapshot system has a configurable retention cap (default 50 snapshots per chapter, oldest pruned first when exceeded). Pruning is deterministic: pre-AI and pre-restore snapshots are never pruned automatically, only interval and manual snapshots are.

The user can request a "compact storage" operation from Settings, which runs the snapshot pruner against the current retention policy and reports bytes recovered.

## Export and import

The JSON backup export reads every key in the project, assembles a single JSON object `{ [path]: content }`, and downloads it as `xnovelist-backup-YYYY-MM-DD.json`. The export filter excludes any path matching `^ai-key`, `^.*\.encrypted$`, and any key inside `config.json` whose name matches `/key|token|secret/i`. There is no override checkbox; if a user wants to share their API key, they do it out of band.

Import is the inverse: parse the JSON, validate each path against its schema, snapshot every affected file in the existing project, then write. The user confirms with a "Replace current project? Snapshots will be taken first" dialog. The import always snapshots first; this guarantees a one-click rollback if the import was wrong.

A future DOCX export ships the manuscript only. The export pipeline:

1. List `Artifacts/chapter-*.md` sorted by filename.
2. Parse each as Markdown.
3. Apply the project's typography settings (font, line spacing, indents, scene dividers).
4. Concatenate into a single DOCX document with chapter breaks.

EPUB and PDF are deferred to a later milestone.

## Cross-tab safety

IndexedDB writes from one tab don't automatically propagate to another tab. The application uses a `BroadcastChannel` named `xnovelist:state` to signal "a key changed in path X". Other tabs listen and reload the affected resource. If the local tab has unsaved Tiptap state for that resource, a conflict banner appears: "This chapter was edited in another tab — keep this version, load the other, or compare." The compare path opens the LCS diff between the two states.

The `BroadcastChannel` carries only path identifiers, never content. The actual data is read from IndexedDB on demand.

## What this design rules out, deliberately

A few things this storage design intentionally does not support:

- **No server-side state.** There is no xnovelist account, no server upload, no shared editing. Sync between devices is the user's responsibility (export, transfer, import, or future Tauri filesystem adapter).
- **No "save to file" via the File System Access API in v1.** That API is uneven across browsers and would split the project model. v2 may add a "linked folder" export-on-save mode behind a feature flag.
- **No autosave to a remote endpoint.** Even with a configured BYOAI, no manuscript data is sent there except as part of an explicit AI action.
- **No image storage in IndexedDB beyond bible-attached small images.** The application is text-first. Large image attachments (cover art, character sketches) are referenced by data URL or external URL; we don't host a media library.
- **No language pack storage in IndexedDB.** UI translations and AI prompt packs ship as part of the static bundle. They live in `src/i18n/ui/` and `src/ai/prompts/packs/` respectively, are loaded by the application at startup, and never persist to the user's storage. This keeps user data clean of bundled assets and makes adding a language a code change (PR) rather than a runtime upload.

These are real trade-offs accepted to keep the storage layer comprehensible, the privacy posture clean, and the bundle small.
