# Editor — the writing surface without AI

This document describes everything xnovelist offers a novelist who never enables AI. If this surface isn't excellent on its own, the rest of the product doesn't matter. The principle: the AI-skeptical user gets a complete, opinionated, well-tuned writing tool.

## Workspace layout

The same components serve every form factor; the arrangement adapts to screen width.

### Desktop (≥1024px) — three columns

**Left sidebar (256px)** carries project branding, the chapter outline, the storage-quota indicator, and the settings entry point. Chapters are listed in their stored order with their first line as preview text. Active chapter is highlighted with the brand-purple background. Hovering a chapter reveals a trash icon for delete (with confirmation). A "+" button at the bottom of the outline creates a new chapter. A "Story Bible" toggle at the very bottom flips the main canvas into the bible workspace.

**Center canvas (flex)** is the writing surface. It contains, top to bottom, the editor header (undo/redo/word count/save state), the format toolbar (block-level formatting, typography controls), a centered Tiptap canvas (max-width 768px for optimal line length), and — when phase 1 AI is enabled — an optional floating Polish pill at the bottom. The canvas uses a serif font (configurable, default Merriweather) at 1.1rem with relaxed leading.

**Right sidebar (340px)** holds three tabs: Assistant (only when AI is enabled), History, Notes. With AI disabled, the right sidebar shows only History and Notes; the Assistant tab is hidden. History lists snapshots; Notes is per-chapter scratchpad markdown.

The left and right sidebars are independently collapsible. A distraction-free mode hides both and the format toolbar, leaving only the canvas centered on the screen.

### Tablet (768px – 1023px) — two columns

The center canvas remains primary. The chapter outline and the assistant/history/notes column become overlay panels that slide in from the left or right edge respectively, triggered by edge-swipe gestures or by the icons in the top bar. Only one overlay is open at a time. Overlays dismiss on tap-outside and on a second swipe.

The format toolbar collapses to a single "Format" button that opens a sheet with all formatting controls grouped by category. Typography settings move from inline controls into the same sheet. The Polish panel, when AI is enabled, becomes a bottom sheet that rises when a selection is active.

Tablet mode preserves the full desktop feature set; nothing is removed. The layout adapts; the capability doesn't.

### Phone (≤767px) — tab bar

The screen is dominated by the active surface. A bottom tab bar with four tabs — **Outline**, **Write**, **Bible**, **Polish** — switches between them. "Write" is the active editor; "Outline" is the chapter list; "Bible" is the Story Bible workspace; "Polish" is the AI panel (visible only when AI is enabled).

When the user has text selected in the Write tab, a floating action sheet appears with quick actions: format, copy, run Polish (if AI is on). Long-press on a chapter in Outline opens its context menu (rename, delete, snapshot). Long-press on a character or location in Bible opens its edit form.

The editor canvas widens to fill the screen with comfortable side padding (4% of viewport). The serif font size auto-scales to maintain comfortable line length on small screens. Word count and save status live in a thin top bar.

Distraction-free mode on phone collapses the top bar into a single fade-on-tap indicator and hides the bottom tab bar; only the canvas remains. Tap once to bring the chrome back.

## Touch and pointer parity

Every interaction has a mouse path, a keyboard path, and a touch path. The application uses Pointer Events under the hood so the three converge cleanly in code, but the UX of each is designed separately. A non-exhaustive list:

- **Text selection.** Mouse: click-drag. Keyboard: Shift + arrow keys, Cmd/Ctrl + A. Touch: long-press to start, drag the selection handles to adjust. The Tiptap selection handles are augmented (via `src/ui/responsive/TouchSelectionHandles`) to be 44px tap targets on touch devices.
- **Chapter reorder.** Mouse: drag the row by its handle. Keyboard: focus a row, Cmd/Ctrl + Up/Down to move. Touch: long-press to grab, drag.
- **Snapshot restore.** Mouse: click "Restore." Keyboard: focus the snapshot row, Enter, confirm in modal. Touch: tap "Restore."
- **AI affordance ("Add to bible →").** Mouse: hover near an underlined unknown name; click the pill. Touch: tap the underlined name; the pill appears persistently until tapped or dismissed.

Tap targets are minimum 44px on touch devices (Apple HIG). Hover-only affordances do not exist — every hover-revealed control is also accessible via a tap or via a context menu. `:hover` styles are gated by `@media (hover: hover)` so they don't get stuck on touch devices.

## Tiptap configuration

The editor is Tiptap 3 over ProseMirror, with starter-kit plus a small set of custom extensions:

- **Starter kit** — bold, italic, headings (H1–H3 only; H4+ is rejected on paste), blockquote, code, code block, bullet list, ordered list, horizontal rule.
- **`tiptap-markdown`** — Markdown serializer/parser. Chapter files are stored as Markdown on disk; the editor parses on load and serialises on save.
- **`character-highlight`** (custom, decoration-only) — underlines names from `Characters.json` in purple. Decorations are computed from the bible state, not stored in the document; if the bible changes, the highlights update on the next render tick.
- **`location-highlight`** (custom, decoration-only) — underlines names from `Locations.json` in green.
- **`locked-passage-mark`** (custom mark) — applied automatically to any range the user has typed in. Indicated visually by a thin marker in the gutter; click to toggle.
- **`beat-anchor`** (custom node, phase 2 only) — block-level node for inserted beats. Not surfaced in v1.

The editor disables several starter-kit features that don't fit prose fiction: tables (no surface to author them sensibly), code blocks (rare in novels; if needed, the user can paste a code-block-fenced section into a Notes tab), task lists.

Paste handling: the editor strips inline styles and class attributes from pasted HTML, preserves bold/italic/headings, converts smart quotes to the project's configured quote style (curly vs straight), and rejects images by default (a future "attach image to bible" flow handles bible-attached images explicitly).

## Format toolbar

A second row beneath the editor header carries block-level and typography controls. Block-level: bold, italic, H1/H2/H3 toggles, blockquote, list toggles. Typography: font family selector (a curated list of serif faces — Merriweather, Lora, Crimson Pro, IBM Plex Serif, Georgia), font size (small / normal / large), line height (1.0 / 1.15 / 1.5 / 2.0), paragraph spacing (none / small / medium / large), first-line indent (on/off), page width (narrow / normal / wide), scene divider style (none / centered asterisks / centered dingbat).

Typography settings are persisted per-project in `Project.json` so the user's preferred reading width and font stick across sessions and across devices (via export/import).

## Chapter management

Chapters live as `Artifacts/chapter-<id>.md` files. The `<id>` is a millisecond timestamp at creation time, which keeps the alphabetic sort stable and chronological. The Markdown file starts with an H1 line that is the chapter title; the title is editable inline at the top of the canvas, and editing the title rewrites the first line of the Markdown.

Creating, deleting, renaming, and reordering chapters all snapshot the project before the change. Reordering is via drag-and-drop in the outline; the `<id>` doesn't change, but a `Project.json` `chapterOrder` array tracks the user's preferred sequence. (The Markdown filenames stay stable so external tools can rely on them.)

Each chapter knows its preceding chapter (by `chapterOrder` index) — this is what powers the position-dependent continuity model (chapter N reads chapter N-1's continuity as context).

## Word count and save status

The editor header shows live word count for the active chapter and a save status indicator. Word count is recomputed on every blur and every 5 seconds during typing; it strips Markdown formatting before counting. The save indicator has three states: idle (no recent changes), saving (a debounced write is in flight), saved (the last write completed). Writes are debounced 500ms after the last keystroke.

A second word count is available in the sidebar — total across all chapters, alongside the project's target word count, with a progress ring.

## Snapshots and version control

Snapshots are the safety net under every change. The snapshot store creates entries automatically on three triggers and on demand via manual save:

- **Interval** — every 30 minutes of activity (configurable per project). Skipped if the content hash matches the last snapshot.
- **Pre-AI** — before any AI action that would modify a chapter file. (Inert when AI is off.)
- **Pre-restore** — before applying a snapshot restore, so the user can roll *back* the restore if they change their mind.
- **Manual** — the user clicks "Snapshot now" in the History tab with an optional label.

Snapshots are listed in the right panel's History tab. Each row shows the timestamp, the kind (with a small icon), the label, the byte size, and two actions: "View diff" opens a side-by-side or inline LCS diff between the snapshot and the current chapter; "Restore" replaces the current chapter with the snapshot's content (after taking a pre-restore snapshot of the current state).

The LCS diff renderer is the same component used by the AI diff preview in phase 1 — visual consistency means the user learns one diff vocabulary.

Snapshot retention: per-chapter cap (default 50, configurable 10–500). Pre-AI and pre-restore snapshots are exempt from auto-prune; only interval and manual snapshots are pruned, oldest first.

## Find and replace

A find/replace panel opens with Ctrl/Cmd+F. It operates on the active chapter by default, with a "Search all chapters" toggle that searches across the project. Results are listed with the chapter name, the matched line, and a click-to-jump action. Replace is per-match or all; a confirmation appears before replacing across chapters, with a count of changes.

Find/replace is regex-capable behind a small toggle. The default mode is plain text with case-insensitive matching.

## Notes tab

Each chapter has a freeform Markdown scratchpad accessible from the right panel's Notes tab. Notes are stored at `Notes/chapter-<id>.md` and travel with the project in exports. They aren't included in the manuscript compile. Use cases: pre-writing outlines, "things to fix" lists, research links, dialogue snippets the writer is parking for later.

The Notes tab also offers a project-level note (`Notes/project.md`) for high-level material that isn't tied to a specific chapter.

## Distraction-free mode

A keyboard shortcut (Ctrl/Cmd+Shift+F) hides both sidebars, hides the format toolbar, and centers the canvas with extra vertical padding. Word count, save status, and a small "exit" button remain visible in the top-right corner. The editor's full-screen API is also engaged so the browser chrome disappears. Escape exits.

Within distraction-free mode, all typing, formatting (via keyboard shortcuts), find/replace, and snapshot triggers continue to work. The user has not lost any capability; they have lost only the visual clutter.

## Cross-tab safety

xnovelist supports having a project open in multiple browser tabs (or windows), but only one at a time can write. Tabs coordinate via `BroadcastChannel`. When a tab writes a chapter, other tabs listening on that channel get a "this chapter changed in another tab" signal. If the receiving tab has unsaved changes for the same chapter, it shows a conflict banner with three options: keep this tab's version (and overwrite), load the other tab's version (and discard local), or open a side-by-side compare (a transient diff view from which the user can copy lines).

If the receiving tab has no unsaved changes, it silently reloads the chapter from storage.

## Compile and export

The compile modal lives at the left sidebar's "Export" button. It offers:

- **JSON backup** — the full project bundle, including bibles, snapshots, notes, and settings (sans API key). Used for transfer between devices, for archival, and for sharing with a beta reader.
- **DOCX export** — manuscript only (no bibles, no notes), with the project's typography settings applied. Chapter breaks become Word section breaks. Scene dividers render per the selected style.

The compile modal shows a preview pane (first 2 pages of the rendered DOCX, approximate) before download, so the user can verify the formatting before saving.

EPUB and PDF compile are deferred to a later milestone. They're called out in the roadmap.

## Accessibility

Every interactive element has a visible focus ring (overridable per project, default brand-purple). Every icon button has an `aria-label`. The editor and bible workspaces are reachable by keyboard only — sidebar tab order is consistent (left → center → right), and Ctrl/Cmd+1 / +2 / +3 jump between the three columns. Headings in the editor use semantic HTML (`h1`/`h2`/`h3`) so screen readers and outline tools see the manuscript structure.

Color contrast meets WCAG AA in both the light and dark themes (dark mode ships in v0.3). The character-highlight and location-highlight underlines have a redundant text-decoration style (dotted vs dashed), so users with color vision deficiency can tell them apart.

## What the editor doesn't do (in v1)

Comments / annotations anchored to text ranges — deferred. Inline images embedded in chapter prose — deferred (bible-attached images are supported). Real-time collaboration — out of scope by principle. Voice dictation — deferred.

These are noted in the non-goals doc with rationale.
