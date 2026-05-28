# xnovelist v0.1 — AI-Free Basic Novel Editor Action Plan

> Extracted from the current xnovelist design pack and narrowed into a first actionable build plan. This version is intentionally AI-free and focused on a clean, modern, elegant, flat writing experience with minimal distraction.

## 1. Product target

Build a local-first web app where a novelist can create a project, write chapters, reorder chapters, autosave safely, recover previous versions, and export a backup — without accounts, servers, AI, or visual noise.

The first release should feel like a calm writing desk, not a dashboard.

## 2. Version stance

This is not the full original v0.1 scope. This is the first shippable core.

### Keep

- Static client-side web app.
- IndexedDB as the only persistence layer.
- Markdown as the stored chapter format.
- Rich-text writing via Tiptap.
- Chapter outline.
- Autosave.
- Word count.
- Manual and interval snapshots.
- JSON backup export/import.
- Responsive layout.
- Distraction-free writing mode.
- Clean, modern, elegant, flat UI.

### Cut from this first version

- All AI features.
- AI settings, AI toggles, model configuration, prompt packs, token cost UI.
- Story Bible automation.
- Beat cards.
- Agent flows.
- DOCX export, unless the core editor is already stable.
- Advanced continuity system.
- Complex custom Tiptap marks such as locked passages.
- Real-time collaboration.
- Cloud sync.
- Publishing/marketing features.

### Optional after core loop is stable

- Basic project-level notes.
- Basic character/location notes as plain manual reference pages.
- DOCX export.
- English/Vietnamese UI switch.
- Full mobile touch polish.

## 3. Primary user experience

The app should optimize for this loop:

1. Open xnovelist.
2. Create or import a project.
3. Select or create a chapter.
4. Write with no distractions.
5. See autosave status and word count without losing focus.
6. Restore from a snapshot if something goes wrong.
7. Export a JSON backup.

Anything outside this loop is secondary.

## 4. UX principles

### Quiet by default

The writing canvas is the main product. Side panels, toolbars, counters, and settings should stay visually secondary.

### No dashboard feeling

Avoid cards everywhere, heavy panels, bright badges, analytics widgets, large empty-state illustrations, and decorative gradients. This is not a productivity SaaS app.

### Flat but not sterile

Use flat surfaces, soft borders, subtle hover states, restrained spacing, and typography hierarchy. Avoid heavy shadows and glassmorphism.

### Fewer controls, better placement

Most formatting should be available but not constantly demanding attention. Keep the toolbar compact and collapsible.

### The writer should always trust saving

Autosave status, backup export, and snapshots should be clear, boring, and reliable.

### AI-free means AI-absent

Do not show disabled AI buttons. Do not include “coming soon AI” in the writing interface. The first version should stand on its own.

## 5. Information architecture

### Main workspace

Desktop layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Top bar: project title | save status | word count | settings │
├───────────────┬──────────────────────────────────────────────┤
│ Chapter list  │ Writing canvas                               │
│               │                                              │
│ + Chapter     │ Chapter title                                │
│ Chapter rows  │ Rich text editor                             │
│ Export        │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

### Left panel: Outline

Purpose: chapter navigation and manuscript structure.

Includes:

- Project title.
- Chapter list.
- Create chapter.
- Rename chapter.
- Delete chapter.
- Reorder chapter.
- Total word count.
- Export/import entry.

### Center: Editor

Purpose: distraction-free writing.

Includes:

- Editable chapter title.
- Rich-text editor.
- Minimal floating or top toolbar.
- Save status.
- Current chapter word count.
- Distraction-free toggle.

### Right panel: Deferred

Do not ship a persistent right panel in the first build unless needed.

Possible later contents:

- Notes.
- Snapshots/history.
- Project metadata.

For the first build, put snapshots/history in a modal or drawer so the default writing view stays clean.

## 6. Visual design direction

### Look and feel

Keywords:

- Clean.
- Modern.
- Elegant.
- Flat.
- Calm.
- Literary.
- Focused.

### Suggested visual language

- Background: warm off-white or very light neutral.
- Editor surface: white or near-white.
- Text: high-contrast charcoal, not pure black.
- Borders: thin neutral lines.
- Accent: one restrained color for focus rings and primary actions.
- Shadows: minimal or none; use borders and spacing instead.
- Corners: small to medium radius, not playful.
- Icons: thin-line icons only where they improve scanning.

### Typography

Interface:

- Sans-serif.
- Small, quiet labels.
- Clear hierarchy.

Writing canvas:

- Serif by default.
- Comfortable line height.
- Limited line width.
- Large enough for long sessions.

Recommended editor defaults:

```text
Content width: 680–760px
Font size: 18px
Line height: 1.55–1.7
Paragraph spacing: modest
Editor padding desktop: 48–72px top, 32–48px sides
Editor padding mobile: 20–24px
```

### Interaction tone

- Primary action: subtle filled button.
- Secondary action: text or outline button.
- Destructive action: quiet until confirmation.
- Autosave: small text status, not a toast.
- Errors: clear banner, not alarming unless data is at risk.

## 7. Core features

### 7.1 Project creation

Minimum fields:

- Title.
- Author optional.
- Target word count optional.

Create a new project with one default chapter.

Default first chapter title:

```text
Chapter 1
```

### 7.2 Chapter management

Must support:

- Create chapter.
- Rename chapter.
- Delete chapter with confirmation.
- Reorder chapters.
- Select active chapter.
- Show per-chapter word count.

Implementation rule:

- Chapter IDs must be stable.
- Reordering should update `chapterOrder`, not rename files.

### 7.3 Editor

Use Tiptap with a restrained prose configuration.

Supported formatting:

- Bold.
- Italic.
- Heading 1, Heading 2, Heading 3.
- Blockquote.
- Bullet list.
- Ordered list.
- Horizontal rule or scene divider.

Do not support in first build:

- Tables.
- Images in manuscript.
- Code blocks.
- Task lists.
- Comments.
- AI annotations.
- Beat anchors.
- Locked passage marks.

### 7.4 Autosave

Autosave behavior:

- Save 500–800ms after typing stops.
- Save immediately on blur.
- Show one of three statuses:
  - Saving…
  - Saved
  - Unsaved changes

Autosave must never interrupt writing.

### 7.5 Word count

Show:

- Active chapter word count.
- Total project word count.
- Optional progress against target word count.

Word count should update during writing, but it does not need to update on every keystroke if that harms performance.

### 7.6 Snapshots

First version snapshot types:

- Manual snapshot.
- Interval snapshot every 30 minutes of active writing.
- Pre-restore snapshot.

Each snapshot should include:

- Chapter ID.
- Timestamp.
- Type.
- Optional label.
- Full Markdown content.
- Content hash.

Retention:

- Default: 30 snapshots per chapter.
- User can clear old snapshots.
- Never delete pre-restore snapshots automatically in the first build.

Snapshot UI:

- Simple history drawer or modal.
- View timestamp and label.
- Restore with confirmation.
- Diff can be deferred if restore is safe and snapshots are easy to inspect.

### 7.7 Export/import

JSON backup is required.

Export should include:

- Project metadata.
- Chapters.
- Chapter order.
- Snapshots.
- Settings.

Import should:

- Validate file shape.
- Warn before replacing current project.
- Snapshot current project before import.
- Restore the imported project.

DOCX export is optional for this first build. Do not block the core writing loop on DOCX.

### 7.8 Distraction-free mode

Distraction-free mode should:

- Hide chapter list.
- Hide toolbar unless selected text or keyboard shortcut requires it.
- Center the editor.
- Keep tiny save status and word count visible.
- Exit via Escape or visible exit control.

It should not change the document or create a separate editing mode.

## 8. Responsive behavior

### Desktop

- Left outline visible.
- Editor centered.
- No persistent right panel by default.
- Keyboard shortcuts supported.

### Tablet

- Outline becomes slide-over panel.
- Editor remains primary.
- Toolbar collapses if width is tight.

### Phone

- Single-column layout.
- Bottom navigation or top segmented control:
  - Write
  - Chapters
  - Settings/Export
- Editor padding reduced.
- Toolbar behind a compact menu.

First phone target: readable, editable, exportable. Do not overbuild complex mobile gestures in the first pass.

## 9. Data model

### Project metadata

```ts
type Project = {
  schemaVersion: 1;
  id: string;
  title: string;
  author?: string;
  targetWordCount?: number;
  createdAt: string;
  updatedAt: string;
  activeChapterId: string;
  chapterOrder: string[];
  typography: TypographySettings;
};
```

### Chapter

```ts
type Chapter = {
  id: string;
  title: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
};
```

### Snapshot

```ts
type Snapshot = {
  id: string;
  chapterId: string;
  type: "manual" | "interval" | "pre-restore" | "pre-import";
  label?: string;
  markdown: string;
  contentHash: string;
  createdAt: string;
};
```

### Typography settings

```ts
type TypographySettings = {
  fontFamily: "serif" | "sans";
  fontSize: "small" | "normal" | "large";
  lineHeight: "comfortable" | "loose";
  pageWidth: "narrow" | "normal" | "wide";
};
```

## 10. IndexedDB storage layout

Use a path-keyed storage abstraction from day one.

```text
xnovelist.json
Project.json
Artifacts/chapter-<id>.md
.history/Artifacts/chapter-<id>/index.json
.history/Artifacts/chapter-<id>/<snapshot-id>.md
Settings.json
```

Required storage interface:

```ts
export interface ProjectStorage {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(prefix?: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}
```

Rule: no component should call IndexedDB directly. Components use hooks/services that call `ProjectStorage`.

## 11. Recommended implementation slices

### Slice 0 — Project setup

Deliverables:

- Next.js static export app or equivalent static React app.
- TypeScript strict mode.
- Tailwind configured.
- Basic shell layout.
- IndexedDB wrapper installed.
- Test runner installed.

Done when:

- App builds to static files.
- App opens locally from the build output.
- Empty shell renders without server calls.

### Slice 1 — Storage foundation

Deliverables:

- `ProjectStorage` interface.
- IndexedDB implementation.
- Project schema validation.
- Create/read/update project metadata.
- Seed default project.

Done when:

- Refreshing the browser preserves the project title and active chapter.

### Slice 2 — Chapter model

Deliverables:

- Create chapter.
- Rename chapter.
- Delete chapter.
- Reorder chapters.
- Persist chapter order.
- Store chapter Markdown by stable ID.

Done when:

- A user can create five chapters, reorder them, refresh, and see the same order.

### Slice 3 — Writing editor

Deliverables:

- Tiptap editor.
- Markdown load/save.
- Basic formatting toolbar.
- Editable chapter title.
- Autosave.
- Save status.
- Chapter word count.

Done when:

- A user can write 2,000 words, refresh, and lose nothing.

### Slice 4 — Clean UI pass

Deliverables:

- Flat visual system.
- Calm spacing and typography.
- Final desktop layout.
- Toolbar simplification.
- Empty states.
- Confirmation dialogs.

Done when:

- The app feels like a writing tool, not an admin panel.

### Slice 5 — Backup import/export

Deliverables:

- Export JSON backup.
- Import JSON backup.
- Validate backup shape.
- Replace current project with confirmation.
- Pre-import snapshot.

Done when:

- A project can move from one browser to another by export/import.

### Slice 6 — Snapshots

Deliverables:

- Manual snapshot.
- Interval snapshot.
- Pre-restore snapshot.
- Snapshot history UI.
- Restore snapshot.
- Retention cap.

Done when:

- A user can intentionally damage a chapter and restore a previous version.

### Slice 7 — Distraction-free mode

Deliverables:

- Hide panels.
- Center canvas.
- Preserve autosave and shortcuts.
- Minimal status display.
- Escape to exit.

Done when:

- A user can write for 30 minutes without visual clutter.

### Slice 8 — Responsive pass

Deliverables:

- Tablet layout.
- Phone layout.
- Collapsed toolbar.
- Touch-safe buttons.
- Import/export reachable on small screens.

Done when:

- A user can open, edit, save, and export from a phone.

## 12. First 20 implementation tickets

1. Create static React/Next project with TypeScript strict mode.
2. Add Tailwind and base design tokens.
3. Build app shell with top bar, left outline, and editor canvas.
4. Create `ProjectStorage` interface.
5. Implement `IndexedDBProjectStorage`.
6. Add zod schemas for project and chapter metadata.
7. Seed first project and first chapter on initial load.
8. Build chapter list UI.
9. Implement create chapter.
10. Implement rename chapter.
11. Implement delete chapter with confirmation.
12. Implement reorder chapter.
13. Add Tiptap editor.
14. Implement Markdown parse/serialize.
15. Add autosave debounce.
16. Add save status indicator.
17. Add word count calculation.
18. Add basic formatting toolbar.
19. Add JSON backup export.
20. Add JSON backup import with confirmation.

## 13. Acceptance criteria for first usable build

A first usable build is done when:

- A user can create a project.
- A user can create at least five chapters.
- A user can write at least 10,000 words across chapters.
- Refreshing the browser does not lose writing.
- Closing and reopening the browser does not lose writing.
- Reordering chapters persists.
- Autosave status is accurate.
- Manual backup export works.
- Backup import works in a second browser.
- Manual snapshot restore works.
- Distraction-free mode works.
- The desktop UI is calm, clean, modern, elegant, and not visually busy.
- The phone UI allows basic reading, editing, and backup export.

## 14. Design checklist before coding each screen

For every screen or component, ask:

- Does this help the writer write?
- Can this be hidden until needed?
- Is the canvas still visually dominant?
- Is this control obvious without being loud?
- Is the state of saving clear?
- Can this action destroy prose? If yes, is there confirmation or recovery?
- Does this work without AI, account, server, or network?

## 15. UI component inventory

Build only these components first:

- `AppShell`
- `TopBar`
- `ChapterOutline`
- `ChapterRow`
- `EditorCanvas`
- `ChapterTitleInput`
- `FormatToolbar`
- `SaveStatus`
- `WordCount`
- `ConfirmDialog`
- `SettingsDialog`
- `ExportImportDialog`
- `SnapshotHistoryDialog`
- `DistractionFreeToggle`

Avoid building a large component library before the writing flow works.

## 16. Keyboard shortcuts

Minimum shortcuts:

```text
Cmd/Ctrl + S              Manual save / snapshot now
Cmd/Ctrl + B              Bold
Cmd/Ctrl + I              Italic
Cmd/Ctrl + F              Find in current chapter
Cmd/Ctrl + Shift + F      Distraction-free mode
Escape                    Exit modal or distraction-free mode
```

Project-wide find can come later.

## 17. Risks to test early

### Tiptap Markdown fidelity

Risk: rich text editor output may not round-trip cleanly to Markdown.

Test early with:

- Headings.
- Lists.
- Blockquotes.
- Scene dividers.
- Long chapters.
- Paste from Google Docs/Word.

### IndexedDB reliability

Risk: browser quota, private browsing, or blocked storage can break persistence.

Test early with:

- Chrome.
- Edge.
- Firefox.
- Safari desktop.
- iOS Safari.

### Mobile editing

Risk: mobile selection and keyboard behavior may be poor.

Test early with:

- Long chapter editing.
- Toolbar use.
- Scrolling while keyboard is open.
- Chapter switching.

### Export/import trust

Risk: users will not trust local-first unless backup is obvious.

Test early with:

- Export from one browser.
- Import to another browser.
- Import wrong file.
- Import corrupted file.

## 18. Decisions locked for this version

- No AI surface.
- No backend.
- No account.
- No cloud sync.
- IndexedDB only.
- JSON backup required.
- Markdown chapter source.
- Minimal editor formatting.
- Clean, flat, distraction-light UI.

## 19. Decisions still open

Resolve before implementation reaches polish stage:

- Next.js static export vs simpler Vite static app.
- Whether DOCX export belongs in this first version.
- Whether English/Vietnamese UI ships now or after editor stability.
- Whether notes are included in first build.
- Whether snapshot diff ships now or restore-only is enough.
- Whether `file://` support is official or best-effort.

## 20. Immediate next step

Build the thinnest vertical slice:

```text
Static app shell → IndexedDB project → chapter list → Tiptap editor → autosave → refresh-safe writing
```

Do not start with settings, Story Bible, DOCX, AI, or advanced responsive behavior. The first proof is simple: write prose, save prose, restore prose.
