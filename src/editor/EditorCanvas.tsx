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
  onSave: (markdown: string, wordCount: number) => void;
  onTitleChange: (newTitle: string) => void;
  isDistractionFree: boolean;
  onToggleDistractionFree: () => void;
}

export default function EditorCanvas({
  chapterId,
  initialTitle,
  initialMarkdown,
  typography,
  onChangeTypography,
  onSave,
  onTitleChange,
  isDistractionFree,
  onToggleDistractionFree,
}: EditorCanvasProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');
  const [wordCount, setWordCount] = useState(0);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingFromPropRef = useRef(false);

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
    onUpdate: ({ editor }) => {
      if (isUpdatingFromPropRef.current) return;

      setSaveStatus('unsaved');
      
      // Calculate word count
      const text = editor.getText();
      const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      setWordCount(count);

      // Debounced Auto-Save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus('saving');
      saveTimeoutRef.current = setTimeout(() => {
        const md = (editor.storage as unknown as Record<string, Record<string, () => string>>).markdown.getMarkdown();
        onSave(md, count);
        setSaveStatus('saved');
      }, 700);
    },
  }, [chapterId]);

  // Sync title input with initialTitle prop
  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  // Sync markdown content when chapter changes
  useEffect(() => {
    if (editor && initialMarkdown !== undefined) {
      isUpdatingFromPropRef.current = true;
      editor.commands.setContent(initialMarkdown);
      const text = editor.getText();
      const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      setWordCount(count);
      isUpdatingFromPropRef.current = false;
      setSaveStatus('idle');
    }
  }, [chapterId, initialMarkdown, editor]);

  // Trigger quick manual save on Blur
  const handleBlur = () => {
    if (editor && saveStatus === 'unsaved') {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const md = (editor.storage as unknown as Record<string, Record<string, () => string>>).markdown.getMarkdown();
      onSave(md, wordCount);
      setSaveStatus('saved');
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onTitleChange(newTitle);
  };

  // Keyboard shortcut listeners (Cmd/Ctrl + S for manual save, Cmd/Ctrl + Shift + F for distraction free)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (editor) {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          const md = (editor.storage as unknown as Record<string, Record<string, () => string>>).markdown.getMarkdown();
          onSave(md, wordCount);
          setSaveStatus('saved');
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onToggleDistractionFree();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, wordCount, onSave, onToggleDistractionFree]);

  // Define styling dynamically based on typography selection
  const fontClass = typography.fontFamily === 'serif' ? 'font-serif' : 'font-sans';
  const sizeClass =
    typography.fontSize === 'small'
      ? 'text-[15px]'
      : typography.fontSize === 'large'
      ? 'text-[21px]'
      : 'text-[18px]';
  const leadClass = typography.lineHeight === 'loose' ? 'leading-[1.85]' : 'leading-[1.6]';
  const widthClass =
    typography.pageWidth === 'narrow'
      ? 'max-w-[650px]'
      : typography.pageWidth === 'wide'
      ? 'max-w-[960px]'
      : 'max-w-[760px]';

  return (
    <div className="flex flex-col h-full bg-[var(--editor-bg)]" onBlur={handleBlur}>
      {/* Editor Header Details */}
      {!isDistractionFree && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] select-none">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none focus:outline-none text-[var(--foreground)] w-2/3 truncate"
            placeholder={t('renameChapter')}
          />
          <div className="flex items-center gap-4 text-xs opacity-75 text-[var(--foreground)]">
            <span className="font-mono">
              {wordCount} {t('wordCount')}
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
          <span className="font-mono">{wordCount} words</span>
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
        <div className={`mx-auto ${widthClass} ${fontClass} ${sizeClass} ${leadClass} text-[var(--foreground)]`}>
          {isDistractionFree && (
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-3xl font-bold mb-8 w-full bg-transparent border-none focus:outline-none"
              placeholder="Chapter Title"
            />
          )}
          <EditorContent editor={editor} className="min-h-[50vh]" />
        </div>
      </div>
    </div>
  );
}
