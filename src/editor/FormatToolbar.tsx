import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Minus,
  Type,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { TypographySettings } from '../storage/schemas';
import { Editor } from '@tiptap/react';

interface FormatToolbarProps {
  editor: Editor | null;
  typography: TypographySettings;
  onChangeTypography: (settings: Partial<TypographySettings>) => void;
  isDistractionFree: boolean;
  onToggleDistractionFree: () => void;
}

export default function FormatToolbar({
  editor,
  typography,
  onChangeTypography,
  isDistractionFree,
  onToggleDistractionFree,
}: FormatToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-[var(--border)] bg-[var(--editor-bg)] select-none">
      {/* Rich Text Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('bold') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Bold (Cmd/Ctrl + B)"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('italic') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Italic (Cmd/Ctrl + I)"
        >
          <Italic size={16} />
        </button>

        <span className="w-px h-6 bg-[var(--border)] mx-1" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Heading 1"
        >
          <Heading1 size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Heading 3"
        >
          <Heading3 size={16} />
        </button>

        <span className="w-px h-6 bg-[var(--border)] mx-1" />

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('blockquote') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Blockquote"
        >
          <Quote size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('bulletList') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('orderedList') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Ordered List"
        >
          <ListOrdered size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] transition-colors"
          title="Scene Divider"
        >
          <Minus size={16} />
        </button>
      </div>

      {/* Typography preferences */}
      <div className="flex items-center gap-3">
        {/* Font Family selector */}
        <div className="flex items-center gap-1 text-xs text-[var(--foreground)] opacity-80">
          <Type size={14} />
          <select
            value={typography.fontFamily}
            onChange={(e) => onChangeTypography({ fontFamily: e.target.value as 'serif' | 'sans' })}
            className="bg-transparent border-none py-1 focus:outline-none cursor-pointer"
          >
            <option value="serif">Merriweather (Serif)</option>
            <option value="sans">Inter (Sans)</option>
          </select>
        </div>

        {/* Font Size selector */}
        <select
          value={typography.fontSize}
          onChange={(e) => onChangeTypography({ fontSize: e.target.value as 'small' | 'normal' | 'large' })}
          className="bg-transparent border-none text-xs py-1 focus:outline-none cursor-pointer text-[var(--foreground)] opacity-80"
        >
          <option value="small">Small size</option>
          <option value="normal">Normal size</option>
          <option value="large">Large size</option>
        </select>

        {/* Line Height selector */}
        <select
          value={typography.lineHeight}
          onChange={(e) => onChangeTypography({ lineHeight: e.target.value as 'comfortable' | 'loose' })}
          className="bg-transparent border-none text-xs py-1 focus:outline-none cursor-pointer text-[var(--foreground)] opacity-80"
        >
          <option value="comfortable">Comfortable line</option>
          <option value="loose">Loose line</option>
        </select>

        {/* Page Width selector */}
        <select
          value={typography.pageWidth}
          onChange={(e) => onChangeTypography({ pageWidth: e.target.value as 'narrow' | 'normal' | 'wide' })}
          className="bg-transparent border-none text-xs py-1 focus:outline-none cursor-pointer text-[var(--foreground)] opacity-80"
        >
          <option value="narrow">Narrow view</option>
          <option value="normal">Normal view</option>
          <option value="wide">Wide view</option>
        </select>

        <span className="w-px h-6 bg-[var(--border)]" />

        {/* Distraction-Free Toggle */}
        <button
          onClick={onToggleDistractionFree}
          className={`p-1.5 rounded transition-colors ${
            isDistractionFree ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title={isDistractionFree ? "Exit Distraction-Free (Esc)" : "Distraction-Free Mode (Cmd/Ctrl+Shift+F)"}
        >
          {isDistractionFree ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}
