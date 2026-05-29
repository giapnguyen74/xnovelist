import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { useTranslation } from '../i18n/useTranslation';
import { TypographySettings, Character, Location } from '../storage/schemas';
import FormatToolbar from './FormatToolbar';
import { SearchAndReplace } from './SearchAndReplace';
import FindBar from './FindBar';
import { TextSelection } from '@tiptap/pm/state';
import { BibleLinkage } from './bibleLinkage';

interface EditorCanvasProps {
  chapterId: string;
  chapterIndex: number;
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
  jumpToSearchQuery?: string | null;
  onClearJumpToSearchQuery?: () => void;
  characters?: Character[];
  locations?: Location[];
  highlightBibleRefs?: boolean;
  onAttachEvidence?: (entityType: 'characters' | 'locations', entityId: string, quote: string) => void;
  aiLevel?: number;
  isAIPanelOpen?: boolean;
  onToggleAIPanel?: () => void;
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
  chapterIndex,
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
  jumpToSearchQuery,
  onClearJumpToSearchQuery,
  characters = [],
  locations = [],
  highlightBibleRefs = true,
  onAttachEvidence,
  aiLevel = 0,
  isAIPanelOpen = false,
  onToggleAIPanel,
}: EditorCanvasProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');
  const [wordCount, setWordCount] = useState(0);

  const [isFindBarOpen, setIsFindBarOpen] = useState(false);
  // Whether the FindBar should open with the Replace row already visible.
  // True when summoned by Cmd/Ctrl+Alt+F per plan §16.
  const [findBarOpensInReplaceMode, setFindBarOpensInReplaceMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [isEvidenceDialogOpen, setIsEvidenceDialogOpen] = useState(false);
  const [selectedEvidenceText, setSelectedEvidenceText] = useState('');
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const onAttachEvidenceRef = useRef(onAttachEvidence);
  useEffect(() => { onAttachEvidenceRef.current = onAttachEvidence; }, [onAttachEvidence]);

  const handleConfirmAttach = (type: 'characters' | 'locations', id: string) => {
    if (onAttachEvidenceRef.current && selectedEvidenceText.trim()) {
      onAttachEvidenceRef.current(type, id, selectedEvidenceText.trim());
      const name = type === 'characters'
        ? (characters || []).find(c => c.id === id)?.name
        : (locations || []).find(l => l.id === id)?.name;
      showToast(`Attached to ${name || 'item'} successfully!`);
    }
  };

  useEffect(() => {
    if (!isEvidenceDialogOpen) {
      setPickerSearchQuery('');
    }
  }, [isEvidenceDialogOpen]);

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

    /* Search highlight styling */
    .search-match {
      background-color: rgba(250, 204, 21, 0.35) !important;
      border-bottom: 1px dashed rgba(217, 119, 6, 0.4);
    }
    .search-match-active {
      background-color: rgba(245, 158, 11, 0.8) !important;
      color: #000000 !important;
      outline: 1px solid #d97706;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
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
      SearchAndReplace.configure({
        onResults: ({ count, index }) => {
          setMatchCount(count);
          setActiveIndex(index);
        },
      }),
      BibleLinkage.configure({
        characters: characters || [],
        locations: locations || [],
        enabled: !!highlightBibleRefs,
      }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[50vh]',
      },
      handleDOMEvents: {
        contextmenu: (view, event) => {
          const { state } = view;
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, ' ').trim();
          if (text) {
            event.preventDefault();
            setSelectedEvidenceText(text);
            setContextMenuPosition({ x: event.clientX, y: event.clientY });
            setIsContextMenuOpen(true);
            return true;
          }
          return false;
        }
      }
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
      } catch {
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

  // Find-bar close handler — depends on the editor instance.
  const handleCloseFindBar = useCallback(() => {
    setIsFindBarOpen(false);
    setSearchQuery('');
    if (editor && !editor.isDestroyed) {
      editor.commands.setSearchQuery('');
    }
  }, [editor]);

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
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        // Cmd/Ctrl+Alt+F → open directly into Replace mode (plan §16).
        // Cmd/Ctrl+F → open in plain Find mode.
        setFindBarOpensInReplaceMode(e.altKey);
        setIsFindBarOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (editor && !editor.isDestroyed) {
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, ' ').trim();
          if (text) {
            setSelectedEvidenceText(text);
            setIsEvidenceDialogOpen(true);
          } else {
            alert("Please select some text in the editor first to attach as evidence.");
          }
        }
      }
      if (e.key === 'Escape') {
        if (isFindBarOpen) {
          e.preventDefault();
          handleCloseFindBar();
        }
        if (isEvidenceDialogOpen) {
          e.preventDefault();
          setIsEvidenceDialogOpen(false);
        }
        if (isContextMenuOpen) {
          e.preventDefault();
          setIsContextMenuOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, wordCount, onToggleDistractionFree, isFindBarOpen, isEvidenceDialogOpen, isContextMenuOpen, handleCloseFindBar]);

  // Sync BibleLinkage extension state with updates to characters, locations, and settings
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.updateBibleLinkage({
        characters: characters || [],
        locations: locations || [],
        enabled: !!highlightBibleRefs,
      });
    }
  }, [editor, characters, locations, highlightBibleRefs]);

  // Dismiss context menu on click outside
  useEffect(() => {
    if (!isContextMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setIsContextMenuOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isContextMenuOpen]);

  // Dismiss context menu on scroll
  useEffect(() => {
    if (!isContextMenuOpen) return;
    const handleScroll = () => setIsContextMenuOpen(false);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isContextMenuOpen]);

  // Sync Search state with Tiptap
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setSearchQuery(searchQuery);
    }
  }, [editor, searchQuery]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setCaseSensitive(caseSensitive);
    }
  }, [editor, caseSensitive]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setWholeWord(wholeWord);
    }
  }, [editor, wholeWord]);

  // Handle jumpToSearchQuery from command palette snippet jumps
  useEffect(() => {
    if (editor && !editor.isDestroyed && jumpToSearchQuery) {
      const doc = editor.state.doc;
      const matches: { start: number; end: number }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doc.descendants((node: any, pos: number) => {
        if (node.isText) {
          const text = node.text || '';
          const matchIdx = text.toLowerCase().indexOf(jumpToSearchQuery.toLowerCase());
          if (matchIdx !== -1) {
            matches.push({
              start: pos + matchIdx,
              end: pos + matchIdx + jumpToSearchQuery.length,
            });
          }
        }
      });

      if (matches.length > 0) {
        const firstMatch = matches[0];
        editor.commands.command(({ tr, state }) => {
          tr.setSelection(TextSelection.create(state.doc, firstMatch.start, firstMatch.end));
          tr.scrollIntoView();
          return true;
        });
      }
      onClearJumpToSearchQuery?.();
    }
  }, [editor, jumpToSearchQuery, onClearJumpToSearchQuery]);

  return (
    <div className="flex flex-col h-full bg-[var(--editor-bg)]" onBlur={handleBlur}>
      {/* Editor Header Details */}
      {!isDistractionFree && (
        <div className="h-[53px] px-6 border-b border-[var(--border)] flex items-center justify-between select-none">
          <div className="flex items-center gap-2 w-2/3 min-w-0">
            <span className="text-xs font-semibold text-[var(--foreground)] opacity-45 shrink-0 select-none font-mono">
              Ch.{chapterIndex}
            </span>
            <span className="text-[var(--foreground)] opacity-30 select-none">·</span>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none focus:outline-none text-[var(--foreground)] flex-1 min-w-0 truncate"
              placeholder={t('renameChapter')}
            />
          </div>
          <div className="flex items-center gap-3 text-xs opacity-75 text-[var(--foreground)]">
            <span className="font-mono">
              {wordCount.toLocaleString()} {t('wordCount')}
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
            <span className="font-mono">
              {computePages(wordCount)} {computePages(wordCount) === 1 ? t('page') : t('pages')}
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
            <span className="font-mono">
              {formatReadTime(computeReadMinutes(wordCount))} {t('read')}
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
          aiLevel={aiLevel}
          isAIPanelOpen={isAIPanelOpen}
          onToggleAIPanel={onToggleAIPanel}
        />
      )}

      {/* Floating Find & Replace Bar */}
      {isFindBarOpen && (
        <FindBar
          searchQuery={searchQuery}
          onChangeSearchQuery={setSearchQuery}
          replaceQuery={replaceQuery}
          onChangeReplaceQuery={setReplaceQuery}
          caseSensitive={caseSensitive}
          onToggleCaseSensitive={() => setCaseSensitive(!caseSensitive)}
          wholeWord={wholeWord}
          onToggleWholeWord={() => setWholeWord(!wholeWord)}
          matchCount={matchCount}
          activeIndex={activeIndex}
          onNext={() => editor?.commands.goToNextMatch()}
          onPrev={() => editor?.commands.goToPrevMatch()}
          onReplace={() => editor?.commands.replaceSingle(replaceQuery)}
          onReplaceAll={() => editor?.commands.replaceAll(replaceQuery)}
          onClose={handleCloseFindBar}
          initialReplaceOpen={findBarOpensInReplaceMode}
        />
      )}

      {/* Distraction Free Canvas Indicators */}
      {isDistractionFree && (
        <div className="fixed top-4 right-4 flex items-center gap-3 text-xs opacity-40 hover:opacity-100 transition-opacity select-none z-50">
          <span className="font-mono">{wordCount.toLocaleString()} {t('words')}</span>
          <span>•</span>
          <span className="font-mono">{computePages(wordCount)} {computePages(wordCount) === 1 ? t('page') : t('pages')}</span>
          <span>•</span>
          <span className="font-mono">{formatReadTime(computeReadMinutes(wordCount))} {t('read')}</span>
          <span>•</span>
          <span>{saveStatus === 'saved' ? t('saveStatusSaved') : t('saveStatusSaving')}</span>
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-12">
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
                <span className="flex items-center gap-1 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--border)] text-[10px]">{modKey} + {shiftKey} + E</kbd> Evidence
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

      {/* Floating Context Menu */}
      {isContextMenuOpen && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-[var(--editor-bg)] border border-[var(--border)] shadow-md text-xs py-1 min-w-[200px] rounded-none text-[var(--foreground)]"
          style={{ top: contextMenuPosition.y, left: contextMenuPosition.x }}
        >
          <div className="px-3 py-1.5 font-semibold border-b border-[var(--border)] opacity-60">
            Attach as Evidence to
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1">
            {(characters || []).length === 0 && (locations || []).length === 0 && (
              <div className="px-3 py-2 text-xs opacity-50 italic">
                No bible items yet
              </div>
            )}
            
            {(characters || []).length > 0 && (
              <>
                <div className="px-3 py-1 font-semibold opacity-40 uppercase tracking-wider text-[9px] mt-1">Characters</div>
                {(characters || []).map(char => (
                  <button
                    key={char.id}
                    onClick={() => {
                      handleConfirmAttach('characters', char.id);
                      setIsContextMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-1.5 hover:bg-[var(--border)] hover:text-[var(--foreground)] cursor-pointer truncate"
                  >
                    {char.name}
                  </button>
                ))}
              </>
            )}

            {(locations || []).length > 0 && (
              <>
                <div className="px-3 py-1 font-semibold opacity-40 uppercase tracking-wider text-[9px] mt-2">Locations</div>
                {(locations || []).map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      handleConfirmAttach('locations', loc.id);
                      setIsContextMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-1.5 hover:bg-[var(--border)] hover:text-[var(--foreground)] cursor-pointer truncate"
                  >
                    {loc.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Centered Picker Modal */}
      {isEvidenceDialogOpen && (() => {
        const allBibleItems = [
          ...(characters || []).map(c => ({
            id: c.id,
            name: c.name,
            type: 'characters' as const,
            subtitle: c.role || '',
          })),
          ...(locations || []).map(l => ({
            id: l.id,
            name: l.name,
            type: 'locations' as const,
            subtitle: l.significance || '',
          }))
        ];
        const filteredItems = allBibleItems.filter(item => 
          item.name.toLowerCase().includes(pickerSearchQuery.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(pickerSearchQuery.toLowerCase())
        );

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 select-none">
            <div className="bg-[var(--editor-bg)] border border-[var(--border)] shadow-xl w-full max-w-md p-6 rounded-none flex flex-col text-[var(--foreground)] animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <h3 className="text-sm font-bold uppercase tracking-wider">Attach Selection as Evidence</h3>
                <button
                  onClick={() => setIsEvidenceDialogOpen(false)}
                  className="text-xs opacity-50 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Selected Quote Preview */}
              <div className="my-4 p-3 bg-[var(--sidebar-bg)] border-l-2 border-[var(--accent)] text-xs italic opacity-90 max-h-[80px] overflow-y-auto">
                &ldquo;{selectedEvidenceText}&rdquo;
              </div>

              {/* Search Input for Bible items */}
              <input
                type="text"
                placeholder="Filter characters or locations..."
                value={pickerSearchQuery}
                onChange={(e) => setPickerSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--editor-bg)] border border-[var(--border)] focus:outline-none text-xs rounded-none mb-3"
                autoFocus
              />

              {/* List of items */}
              <div className="flex-1 overflow-y-auto max-h-[240px] border border-[var(--border)]">
                {filteredItems.length === 0 ? (
                  <div className="p-4 text-center text-xs opacity-50 italic">
                    No matching items found
                  </div>
                ) : (
                  filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleConfirmAttach(item.type, item.id);
                        setIsEvidenceDialogOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[var(--border)] border-b border-[var(--border)] last:border-b-0 cursor-pointer flex flex-col gap-0.5"
                    >
                      <span className="text-xs font-semibold text-[var(--foreground)]">{item.name}</span>
                      <span className="text-[10px] opacity-60 flex items-center gap-2">
                        <span className="uppercase tracking-wider font-bold text-[8px]">
                          {item.type === 'characters' ? 'Character' : 'Location'}
                        </span>
                        {item.subtitle && <span>• {item.subtitle}</span>}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => setIsEvidenceDialogOpen(false)}
                  className="px-4 py-2 text-xs font-semibold hover:bg-[var(--sidebar-bg)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Success Toast */}
      {toast && (
        <div className="fixed bottom-12 right-6 bg-[var(--accent)] text-white px-4 py-2 text-xs font-semibold shadow-lg z-50 rounded-none border border-[var(--border)]">
          {toast}
        </div>
      )}
    </div>
  );
}
