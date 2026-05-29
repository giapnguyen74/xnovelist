import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { useTranslation } from '../i18n/useTranslation';
import { TypographySettings } from '../storage/schemas';
import FormatToolbar from './FormatToolbar';

interface EditorCanvasProps {
  chapterId: string;
  initialTitle: string;
  initialMarkdown: string;
  typography: TypographySettings;
  onChangeTypography: (settings: Partial<TypographySettings>) => void;
  /** Persists markdown for the chapter that initiated the save. */
  onSave: (markdown: string, wordCount: number, chapterId: string) => void;
  /** Fires on every keystroke so parent counts stay live (not debounced). */
  onWordCountChange?: (chapterId: string, count: number) => void;
  /** Optional manual-snapshot hook fired on Cmd/Ctrl+S after the save. */
  onManualSnapshot?: (chapterId: string) => void;
  onTitleChange: (newTitle: string) => void;
  isDistractionFree: boolean;
  onToggleDistractionFree: () => void;
}

// Manuscript-page math: 250 words/page (double-spaced standard), 200 wpm reading pace.
const WORDS_PER_PAGE = 250;
const WORDS_PER_MINUTE = 200;
const computePages = (words: number) => Math.ceil(words / WORDS_PER_PAGE);
const computeReadMinutes = (words: number) => Math.ceil(words / WORDS_PER_MINUTE);
const formatReadTime = (minutes: number) => {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export default function EditorCanvas({
  chapterId,
  initialTitle,
  initialMarkdown,
  typography,
  onChangeTypography,
  onSave,
  onWordCountChange,
  onManualSnapshot,
  onTitleChange,
  isDistractionFree,
  onToggleDistractionFree,
}: EditorCanvasProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');
  const [wordCount, setWordCount] = useState(0);

  const [showShortcuts, setShowShortcuts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xnovelist-show-shortcuts');
      return saved !== 'false';
    }
    return true;
  });

  const toggleShortcuts = () => {
    setShowShortcuts(prev => {
      const next = !prev;
      localStorage.setItem('xnovelist-show-shortcuts', String(next));
      return next;
    });
  };

  const isMac = typeof window !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac');
  const modKey = isMac ? '⌘' : 'Ctrl';
  const shiftKey = isMac ? '⇧' : 'Shift';

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingFromPropRef = useRef(false);

  // Stable references for callbacks/state used inside the editor's onUpdate
  // closure. Because useEditor's deps are now [] (the editor instance is
  // preserved across chapter switches), the closure is created once on mount
  // — these refs let it always see the current chapterId / latest callbacks.
  const chapterIdRef = useRef(chapterId);
  const onSaveRef = useRef(onSave);
  const onWordCountChangeRef = useRef(onWordCountChange);
  // The chapter whose content is currently loaded into the editor. Used to
  // flush pending saves correctly when the chapter prop changes.
  const loadedChapterIdRef = useRef<string>(chapterId);

  const titleRef = useRef(initialTitle);
  const onTitleChangeRef = useRef(onTitleChange);
  const onManualSnapshotRef = useRef(onManualSnapshot);

  useEffect(() => { chapterIdRef.current = chapterId; }, [chapterId]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => { onWordCountChangeRef.current = onWordCountChange; }, [onWordCountChange]);
  useEffect(() => { titleRef.current = initialTitle; }, [initialTitle]);
  useEffect(() => { onTitleChangeRef.current = onTitleChange; }, [onTitleChange]);
  useEffect(() => { onManualSnapshotRef.current = onManualSnapshot; }, [onManualSnapshot]);

  // 1. Resolve typography settings into CONCRETE CSS values. These drive an
  // injected <style> block below so changes apply live and only affect the
  // novel text inside the editor — never the surrounding layout/chrome.
  const fontFamily = (() => {
    switch (typography.fontFamily) {
      // Serifs — best for long-form prose
      case 'lora': return "'Lora', Georgia, serif";
      case 'garamond': return "'EB Garamond', Garamond, Georgia, serif";
      case 'source-serif': return "'Source Serif 4', 'Source Serif Pro', Georgia, serif";
      case 'crimson': return "'Crimson Pro', Georgia, serif";
      // Sans — modern / drafting
      case 'sans': return "'Inter', system-ui, -apple-system, sans-serif";
      case 'lato': return "'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif";
      // Monospace — screenplay / draft
      case 'courier': return "'Courier Prime', 'Courier New', monospace";
      // Default + legacy values ('serif', 'ibm-serif', 'jetbrains') fall here
      case 'serif':
      default: return "'Merriweather', Georgia, serif";
    }
  })();

  const fontSizePx = (() => {
    const v = typography.fontSize;
    if (v === '1' || v === 'small') return '14px';
    if (v === '3' || v === 'large') return '20px';
    if (v === '4') return '23px';
    return '17px';
  })();

  const lineHeightValue = (() => {
    const v = typography.lineHeight;
    if (v === '1') return '1.4';
    if (v === '3' || v === 'loose') return '1.85';
    if (v === '4') return '2.1';
    return '1.6';
  })();

  const pageMaxWidth = (() => {
    const v = typography.pageWidth;
    if (v === '1' || v === 'narrow') return '560px';
    if (v === '2') return '660px';
    if (v === '4' || v === 'wide' || v === '5') return '100%';
    // '3' / 'normal' / default — sits inside the plan's 680–760px recommendation.
    return '720px';
  })();

  const paragraphSpacing = (() => {
    const v = typography.paragraphSpacing;
    if (v === '1') return '4px';
    if (v === '3') return '16px';
    if (v === '4') return '24px';
    return '10px';
  })();

  const indentEm = (() => {
    const v = typography.textIndent;
    if (v === '1') return '0.75em';
    if (v === '3') return '2.25em';
    if (v === '4') return '3em';
    return '1.5em';
  })();

  const textAlign = (() => {
    switch (typography.textAlignment) {
      case 'justify': return 'justify';
      case 'center': return 'center';
      case 'right': return 'right';
      case 'left':
      default: return 'left';
    }
  })();

  // Paragraph block: Chicago book style (first-line indent, no margin) vs.
  // standard web style (no indent, paragraph gap).
  const paragraphCSS = typography.chicagoStyle
    ? `
      .ProseMirror p { text-indent: ${indentEm}; margin-bottom: 0 !important; }
      .ProseMirror p:first-of-type,
      .ProseMirror h1 + p, .ProseMirror h2 + p, .ProseMirror h3 + p,
      .ProseMirror blockquote + p, .ProseMirror hr + p {
        text-indent: 0 !important;
      }`
    : `
      .ProseMirror p { text-indent: 0; margin-bottom: ${paragraphSpacing} !important; }`;

  // Scene divider rendering
  const sceneDividerCSS = (() => {
    switch (typography.sceneDivider) {
      case 'boxes':
        return `
          .ProseMirror hr { border: none; text-align: center; margin: 2em 0; height: auto; }
          .ProseMirror hr::after { content: '◆   ◆   ◆'; display: block; font-size: 1.1rem; letter-spacing: 0.25em; opacity: 0.7; }`;
      case 'stars':
        return `
          .ProseMirror hr { border: none; text-align: center; margin: 2em 0; height: auto; }
          .ProseMirror hr::after { content: '★   ★   ★'; display: block; font-size: 1.1rem; letter-spacing: 0.25em; opacity: 0.7; }`;
      case 'lines':
        return `
          .ProseMirror hr { border: none; border-top: 1px solid var(--border); width: 30%; margin: 2.5em auto; height: 0; }
          .ProseMirror hr::after { content: none; }`;
      case 'asterisk':
      default:
        return `
          .ProseMirror hr { border: none; text-align: center; margin: 2em 0; height: auto; }
          .ProseMirror hr::after { content: '*   *   *'; display: block; font-size: 1.25rem; letter-spacing: 0.5em; opacity: 0.7; }`;
    }
  })();

  const dynamicEditorStyles = `
    .ProseMirror {
      font-family: ${fontFamily} !important;
      font-size: ${fontSizePx} !important;
      line-height: ${lineHeightValue} !important;
      text-align: ${textAlign} !important;
    }
    .ProseMirror li { line-height: ${lineHeightValue} !important; }
    ${paragraphCSS}
    ${sceneDividerCSS}
  `;

  // 2. Initialize useEditor ONCE. Deps are [] — the editor instance is
  // preserved across chapter switches AND typography changes. Content
  // swapping for new chapters happens via editor.commands.setContent below.
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Reject table/code-blocks as they don't fit prose fiction
        codeBlock: false,
      }),
      Markdown.configure({
        html: false,
        linkify: false,
      }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[50vh]',
      },
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingFromPropRef.current) return;

      // Word count — calculate from plain text
      const text = editor.getText();
      const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      setWordCount(count);

      // Live notify the parent so header total & sidebar counts stay in sync
      // immediately (NOT debounced — this is just a state update).
      const cid = chapterIdRef.current;
      onWordCountChangeRef.current?.(cid, count);

      setSaveStatus('unsaved');

      // Live sync title from editor's H1 first line
      try {
        const md = (editor.storage as unknown as Record<string, Record<string, () => string>>).markdown.getMarkdown();
        const firstLine = md.split('\n')[0] || '';
        const parsedTitle = firstLine.replace(/^#\s*/, '').trim();
        if (parsedTitle && parsedTitle !== titleRef.current) {
          titleRef.current = parsedTitle;
          setTitle(parsedTitle);
          onTitleChangeRef.current?.(parsedTitle);
        }
      } catch (e) {
        // ignore
      }

      // Debounced Auto-Save. We capture the chapterId at scheduling time so
      // the save always targets the chapter the user was typing into — even
      // if they switch chapters before the timer fires.
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus('saving');
      const capturedChapter = cid;
      saveTimeoutRef.current = setTimeout(() => {
        if (editor.isDestroyed) return;
        try {
          const md = (editor.storage as unknown as Record<string, Record<string, () => string>>).markdown.getMarkdown();
          onSaveRef.current(md, count, capturedChapter);
          setSaveStatus('saved');
        } catch {
          // editor was destroyed mid-flight — drop save silently
        }
        saveTimeoutRef.current = null;
      }, 700);
    },
  }, []);

  // Sync title input with initialTitle prop
  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  // Sync markdown content when the chapter changes (or when the parent
  // forces a content replacement, e.g. snapshot restore).
  useEffect(() => {
    if (!editor || initialMarkdown === undefined) return;

    // CRITICAL: before swapping content, flush any pending save belonging to
    // the previously loaded chapter — otherwise its in-flight edits would be
    // written into the new chapter's file when the debounce fires.
    const prevChapter = loadedChapterIdRef.current;
    if (saveTimeoutRef.current && prevChapter && prevChapter !== chapterId && !editor.isDestroyed) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      try {
        const md = (editor.storage as unknown as Record<string, Record<string, () => string>>).markdown.getMarkdown();
        const text = editor.getText();
        const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        onSaveRef.current(md, count, prevChapter);
      } catch {
        // ignore
      }
    }

    // Now load the new chapter content into the (stable) editor, if it has actually changed.
    try {
      const currentMd = (editor.storage as unknown as Record<string, Record<string, () => string>>).markdown.getMarkdown();
      if (currentMd.trim() === initialMarkdown.trim() && loadedChapterIdRef.current === chapterId) {
        return;
      }
    } catch {
      // ignore
    }

    isUpdatingFromPropRef.current = true;
    editor.commands.setContent(initialMarkdown);
    const text = editor.getText();
    const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    setWordCount(count);
    loadedChapterIdRef.current = chapterId;
    isUpdatingFromPropRef.current = false;
    setSaveStatus('idle');
  }, [chapterId, initialMarkdown, editor]);

  // Trigger quick manual save on Blur
  const handleBlur = () => {
    if (editor && saveStatus === 'unsaved' && !editor.isDestroyed) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      try {
        const md = (editor.storage as unknown as Record<string, Record<string, () => string>>).markdown.getMarkdown();
        onSaveRef.current(md, wordCount, loadedChapterIdRef.current);
        setSaveStatus('saved');
      } catch {
        // ignore
      }
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    titleRef.current = newTitle;
    onTitleChange(newTitle);

    if (editor && !editor.isDestroyed) {
      editor.commands.command(({ tr, state }) => {
        const firstNode = state.doc.firstChild;
        if (firstNode && (firstNode.type.name === 'heading' || firstNode.type.name === 'paragraph')) {
          const start = 0;
          const end = firstNode.nodeSize;

          const newHeadingNode = state.schema.nodes.heading.create(
            { level: 1 },
            newTitle ? state.schema.text(newTitle) : null
          );

          tr.replaceWith(start, end, newHeadingNode);
          return true;
        }
        return false;
      });
    }
  };

  // Keyboard shortcut listeners (Cmd/Ctrl + S for manual save, Cmd/Ctrl + Shift + F for distraction free)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (editor && !editor.isDestroyed) {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
          try {
            const md = (editor.storage as unknown as Record<string, Record<string, () => string>>).markdown.getMarkdown();
            const targetChapter = loadedChapterIdRef.current;
            onSaveRef.current(md, wordCount, targetChapter);
            // Cmd/Ctrl + S also takes a manual snapshot per plan §16.
            onManualSnapshotRef.current?.(targetChapter);
            setSaveStatus('saved');
          } catch {
            // ignore
          }
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onToggleDistractionFree();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, wordCount, onToggleDistractionFree]);

  return (
    <div className="flex flex-col h-full bg-[var(--editor-bg)]" onBlur={handleBlur}>
      {/* Editor Header Details */}
      {!isDistractionFree && (
        <div className="h-[53px] px-6 border-b border-[var(--border)] flex items-center justify-between select-none">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none focus:outline-none text-[var(--foreground)] w-2/3 truncate"
            placeholder={t('renameChapter')}
          />
          <div className="flex items-center gap-3 text-xs opacity-75 text-[var(--foreground)]">
            <span className="font-mono">
              {wordCount.toLocaleString()} {t('wordCount')}
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
            <span className="font-mono">
              {computePages(wordCount)} {computePages(wordCount) === 1 ? 'page' : 'pages'}
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
            <span className="font-mono">
              {formatReadTime(computeReadMinutes(wordCount))} read
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--border)]" />
            <span className="italic">
              {saveStatus === 'saving'
                ? t('saveStatusSaving')
                : saveStatus === 'saved'
                  ? t('saveStatusSaved')
                  : saveStatus === 'unsaved'
                    ? t('saveStatusUnsaved')
                    : ''}
            </span>
          </div>
        </div>
      )}

      {/* Editor Formatting Toolbar */}
      {!isDistractionFree && (
        <FormatToolbar
          editor={editor}
          typography={typography}
          onChangeTypography={onChangeTypography}
          isDistractionFree={isDistractionFree}
          onToggleDistractionFree={onToggleDistractionFree}
        />
      )}

      {/* Distraction Free Canvas Indicators */}
      {isDistractionFree && (
        <div className="fixed top-4 right-4 flex items-center gap-3 text-xs opacity-40 hover:opacity-100 transition-opacity select-none z-50">
          <span className="font-mono">{wordCount.toLocaleString()} words</span>
          <span>•</span>
          <span className="font-mono">{computePages(wordCount)} pages</span>
          <span>•</span>
          <span className="font-mono">{formatReadTime(computeReadMinutes(wordCount))} read</span>
          <span>•</span>
          <span>{saveStatus === 'saved' ? 'Saved' : 'Saving...'}</span>
          <span>•</span>
          <button
            onClick={onToggleDistractionFree}
            className="px-2 py-1 rounded bg-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t('exit')}
          </button>
        </div>
      )}

      {/* Writing Prose Canvas */}
      <div className="flex-1 overflow-y-auto p-6 md:p-12">
        {/* Scoped, dynamic typography styles — only affect the novel text */}
        <style dangerouslySetInnerHTML={{ __html: dynamicEditorStyles }} />
        <div
          className="mx-auto text-[var(--foreground)]"
          style={{ maxWidth: pageMaxWidth }}
        >
          {isDistractionFree && (
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-3xl font-bold mb-8 w-full bg-transparent border-none focus:outline-none"
              placeholder="Chapter Title"
            />
          )}
          {/* The editor instance is preserved across typography changes —
              CSS rules above update live without remounting. */}
          <EditorContent editor={editor} className="min-h-[50vh]" />
        </div>
      </div>

      {/* Keyboard Shortcuts Tips */}
      {!isDistractionFree && (
        <div className="flex-shrink-0 bg-[var(--sidebar-bg)] border-t border-[var(--border)] px-4 py-1.5 select-none text-[11px] opacity-75 flex items-center justify-between text-[var(--foreground)] relative z-20 flex-wrap gap-2">
          {showShortcuts ? (
            <>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-semibold text-[10px] uppercase tracking-wider opacity-60">Shortcuts:</span>
                <span className="flex items-center gap-1 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--border)] text-[10px]">{modKey} + B</kbd> Bold
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--border)] text-[10px]">{modKey} + I</kbd> Italic
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--border)] text-[10px]">{modKey} + S</kbd> Manual Save
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--border)] text-[10px]">{modKey} + {shiftKey} + F</kbd> Focus Mode
                </span>
              </div>
              <button
                onClick={toggleShortcuts}
                className="px-2 py-0.5 rounded hover:bg-[var(--border)] hover:opacity-100 transition-colors text-[10px] font-medium cursor-pointer"
              >
                Hide
              </button>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                onClick={toggleShortcuts}
                className="px-2 py-0.5 rounded hover:bg-[var(--border)] hover:opacity-100 transition-colors text-[10px] font-medium cursor-pointer flex items-center gap-1 opacity-70"
                title="Show shortcuts help"
              >
                <span>⌨️ Shortcuts Help</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
