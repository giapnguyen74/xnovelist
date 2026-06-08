import React, { useState, useRef, useEffect } from 'react';
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
  Maximize2,
  Minimize2,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { TypographySettings } from '../storage/schemas';
import { Editor } from '@tiptap/react';
import { useTranslation } from '../i18n/useTranslation';

interface FormatToolbarProps {
  editor: Editor | null;
  typography: TypographySettings;
  onChangeTypography: (settings: Partial<TypographySettings>) => void;
  isDistractionFree: boolean;
  onToggleDistractionFree: () => void;
  aiLevel?: number;
  isAIPanelOpen?: boolean;
  onToggleAIPanel?: () => void;
  highlightBibleRefs?: boolean;
  onToggleHighlightBibleRefs?: () => void;
}

export default function FormatToolbar({
  editor,
  typography,
  onChangeTypography,
  isDistractionFree,
  onToggleDistractionFree,
  aiLevel = 0,
  isAIPanelOpen = false,
  onToggleAIPanel,
  highlightBibleRefs = true,
  onToggleHighlightBibleRefs,
}: FormatToolbarProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!editor) return null;

  // Bold, iconic SVGs — viewBox 24×24, rounded caps, strong weight.

  // Line height: 3 stacked bars; vertical gap grows with the level.
  const renderLineHeightIcon = (level: number) => {
    const gap = 3 + level * 1.8; // 4.8, 6.6, 8.4, 10.2
    const cy = 12;
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <line x1="5" y1={cy - gap} x2="19" y2={cy - gap} />
        <line x1="5" y1={cy} x2="19" y2={cy} />
        <line x1="5" y1={cy + gap} x2="19" y2={cy + gap} />
      </svg>
    );
  };

  // Text indent: 3 bars; first bar pushed in by the indent amount.
  const renderTextIndentIcon = (level: number) => {
    const indent = 2 + level * 2; // 4, 6, 8, 10
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <line x1={4 + indent} y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    );
  };

  // Paragraph spacing: two paragraph blocks (2 bars each) with growing gap.
  const renderSpacingIcon = (level: number) => {
    const halfGap = 1 + level * 1.2; // 2.2, 3.4, 4.6, 5.8
    const step = 3;
    const yTop1 = 12 - halfGap - step;
    const yTop2 = 12 - halfGap;
    const yBot1 = 12 + halfGap;
    const yBot2 = 12 + halfGap + step;
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <line x1="5" y1={yTop1} x2="19" y2={yTop1} />
        <line x1="5" y1={yTop2} x2="15" y2={yTop2} />
        <line x1="5" y1={yBot1} x2="19" y2={yBot1} />
        <line x1="5" y1={yBot2} x2="15" y2={yBot2} />
      </svg>
    );
  };

  // Page width: a rounded "page card" whose width grows with the level.
  // Level 4 = full bleed — card touches the icon edges.
  const renderPageWidthIcon = (level: number) => {
    const inset = level === 1 ? 6 : level === 2 ? 4 : level === 3 ? 2 : 0;
    const x = 2 + inset;
    const w = 20 - 2 * inset;
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x={x} y="5" width={w} height="14" rx="2.5" />
        <line x1={x + 2} y1="10" x2={x + w - 2} y2="10" strokeWidth="1.5" opacity="0.55" />
        <line x1={x + 2} y1="13" x2={x + w - 2} y2="13" strokeWidth="1.5" opacity="0.55" />
        <line x1={x + 2} y1="16" x2={x + w - 4} y2="16" strokeWidth="1.5" opacity="0.55" />
      </svg>
    );
  };



  // Shared classes for an individual option button — flex-1 + aspect-square
  // means each group renders 4 perfectly equal squares that fill the cell.
  const optionBtn = (selected: boolean, disabled = false) =>
    `relative flex-1 aspect-square flex items-center justify-center rounded-none transition-all cursor-pointer select-none min-w-0 ${
      disabled ? 'opacity-30 cursor-not-allowed' : ''
    } ${
      selected
        ? 'bg-white dark:bg-[#20201e] ring-2 ring-[var(--accent)] text-[var(--accent)] shadow-sm'
        : 'bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] opacity-75 hover:opacity-100 hover:border-[var(--accent)]'
    }`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-[var(--border)] bg-[var(--editor-bg)] select-none relative">
      {/* Rich Text Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            editor.isActive('bold') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Bold (Cmd/Ctrl + B)"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            editor.isActive('italic') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Italic (Cmd/Ctrl + I)"
        >
          <Italic size={16} />
        </button>

        <span className="w-px h-6 bg-[var(--border)] mx-1" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            editor.isActive('heading', { level: 1 }) ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Heading 1"
        >
          <Heading1 size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            editor.isActive('heading', { level: 2 }) ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            editor.isActive('heading', { level: 3 }) ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Heading 3"
        >
          <Heading3 size={16} />
        </button>

        <span className="w-px h-6 bg-[var(--border)] mx-1" />

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            editor.isActive('blockquote') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Blockquote"
        >
          <Quote size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            editor.isActive('bulletList') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            editor.isActive('orderedList') ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title="Ordered List"
        >
          <ListOrdered size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] transition-colors cursor-pointer"
          title="Scene Divider"
        >
          <Minus size={16} />
        </button>
        {aiLevel >= 3 && (
          <button
            onClick={() => {
              const id = `beat-${Date.now()}`;
              const { state } = editor;
              const { $from } = state.selection;
              const inNonEmptyBlock =
                $from.parent.type.name === 'paragraph' &&
                $from.parent.textContent.length > 0;
              if (inNonEmptyBlock) {
                editor.chain().focus().splitBlock().insertContent([
                  { type: 'beatAnchor', attrs: { id } },
                  { type: 'paragraph' },
                ]).run();
              } else {
                editor.chain().focus().insertContent([
                  { type: 'beatAnchor', attrs: { id } },
                  { type: 'paragraph' },
                ]).run();
              }
            }}
            className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] transition-colors cursor-pointer"
            title="Insert Beat Caret (Cmd/Ctrl + Shift + B)"
          >
            <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
          </button>
        )}
      </div>

      {/* Typography Action Trigger */}
      <div className="flex items-center gap-2">
        {/* Toggle Typography Popover button */}
        <button
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
            isPopoverOpen 
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]' 
              : 'border-[var(--border)] hover:bg-[var(--sidebar-bg)] text-[var(--foreground)]'
          }`}
          title="Typography Settings"
        >
          <Palette size={14} />
          <span>{t('typographyBtn')}</span>
        </button>

        <span className="w-px h-6 bg-[var(--border)]" />

        {/* Distraction-Free Toggle */}
        <button
          onClick={onToggleDistractionFree}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isDistractionFree ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
          }`}
          title={isDistractionFree ? "Exit Distraction-Free (Esc)" : "Distraction-Free Mode (Cmd/Ctrl+Shift+F)"}
        >
          {isDistractionFree ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {onToggleHighlightBibleRefs && (
          <button
            onClick={onToggleHighlightBibleRefs}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              highlightBibleRefs
                ? 'bg-[var(--accent)] text-white'
                : 'hover:bg-[var(--border)] text-[var(--foreground)] opacity-60'
            }`}
            title={highlightBibleRefs ? "Hide Story Bible Highlights" : "Show Story Bible Highlights"}
          >
            {highlightBibleRefs ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        )}

        {aiLevel >= 1 && onToggleAIPanel && (
          <button
            onClick={onToggleAIPanel}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isAIPanelOpen ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--border)] text-[var(--foreground)]'
            }`}
            title="AI Co-Writer Panel (Cmd/Ctrl + J)"
          >
            <Sparkles size={16} />
          </button>
        )}
      </div>

      {/* TYPOGRAPHY SETTINGS POPOVER DIALOG */}
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          className="absolute right-2 top-12 z-50 bg-white dark:bg-[#1a1a19] border border-[var(--border)] rounded-none shadow-xl p-5 w-[26rem] md:w-[28rem] max-h-[80vh] overflow-y-auto pb-8 space-y-4 animate-fade-in select-none text-[var(--foreground)]"
        >
          <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 border-b border-[var(--border)] pb-2 mb-3">
            {t('typographySettings')}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Font Family selector */}
            <div className="col-span-2 space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-65">{t('fontFamilyLabel')}</label>
              <select
                value={typography.fontFamily || 'serif'}
                onChange={(e) => onChangeTypography({ fontFamily: e.target.value })}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-none px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)] cursor-pointer"
              >
                <optgroup label="Serif (Literature)">
                  <option value="serif">Merriweather — Default, screen-optimized</option>
                  <option value="lora">Lora — Literary, slightly calligraphic</option>
                  <option value="garamond">EB Garamond — Classic paperback feel</option>
                  <option value="source-serif">Source Serif 4 — Modern, warm</option>
                  <option value="crimson">Crimson Pro — Traditional book serif</option>
                </optgroup>
                <optgroup label="Sans Serif (Modern / Draft)">
                  <option value="sans">Inter — Clean UI sans</option>
                  <option value="lato">Lato — Friendly humanist sans</option>
                </optgroup>
                <optgroup label="Monospace (Screenplay)">
                  <option value="courier">Courier Prime — Standard screenplay</option>
                </optgroup>
              </select>
            </div>

            {/* Text Size (Ab buttons) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-65">{t('textSizeLabel')}</label>
              <div className="flex items-center gap-2">
                {['1', '2', '3', '4'].map((size) => {
                  const isSelected =
                    typography.fontSize === size ||
                    (size === '2' && typography.fontSize === 'normal') ||
                    (size === '1' && typography.fontSize === 'small') ||
                    (size === '3' && typography.fontSize === 'large');
                  return (
                    <button
                      key={size}
                      onClick={() => onChangeTypography({ fontSize: size })}
                      className={optionBtn(isSelected)}
                      title={`Text size ${size}`}
                    >
                      <span
                        className={
                          size === '1' ? 'text-[10px] font-semibold' :
                          size === '2' ? 'text-xs font-semibold' :
                          size === '3' ? 'text-sm font-semibold' :
                          'text-base font-bold'
                        }
                      >
                        Ab
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Line Height Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-65">{t('lineHeightLabel')}</label>
              <div className="flex items-center gap-2">
                {['1', '2', '3', '4'].map((lh) => {
                  const isSelected =
                    typography.lineHeight === lh ||
                    (lh === '2' && typography.lineHeight === 'comfortable') ||
                    (lh === '3' && typography.lineHeight === 'loose');
                  return (
                    <button
                      key={lh}
                      onClick={() => onChangeTypography({ lineHeight: lh })}
                      className={optionBtn(isSelected)}
                      title={`Line height ${lh}`}
                    >
                      {renderLineHeightIcon(parseInt(lh))}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paragraph Spacing */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-65">{t('paragraphSpacingLabel')}</label>
              <div className="flex items-center gap-2">
                {['1', '2', '3', '4'].map((sp) => {
                  const isSelected =
                    !typography.chicagoStyle &&
                    (typography.paragraphSpacing === sp || (sp === '2' && !typography.paragraphSpacing));
                  return (
                    <button
                      key={sp}
                      onClick={() => onChangeTypography({ paragraphSpacing: sp })}
                      className={optionBtn(isSelected, typography.chicagoStyle)}
                      title={`Spacing level ${sp}`}
                      disabled={typography.chicagoStyle}
                    >
                      {renderSpacingIcon(parseInt(sp))}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Page width constraints */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-65">{t('pageWidthLabel')}</label>
              <div className="flex items-center gap-2">
                {['1', '2', '3', '4'].map((w) => {
                  const isSelected =
                    typography.pageWidth === w ||
                    (w === '3' && typography.pageWidth === 'normal') ||
                    (w === '1' && typography.pageWidth === 'narrow') ||
                    (w === '4' && (typography.pageWidth === 'wide' || typography.pageWidth === '5'));
                  return (
                    <button
                      key={w}
                      onClick={() => onChangeTypography({ pageWidth: w })}
                      className={optionBtn(isSelected)}
                      title={`Page width ${w}`}
                    >
                      {renderPageWidthIcon(parseInt(w))}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* First Line Indent */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-65">{t('textIndentLabel')}</label>
              <div className="flex items-center gap-2">
                {['1', '2', '3', '4'].map((ind) => {
                  const isSelected =
                    typography.chicagoStyle &&
                    (typography.textIndent === ind || (ind === '2' && !typography.textIndent));
                  return (
                    <button
                      key={ind}
                      onClick={() => onChangeTypography({ textIndent: ind })}
                      className={optionBtn(isSelected, !typography.chicagoStyle)}
                      title={`Indent level ${ind}`}
                      disabled={!typography.chicagoStyle}
                    >
                      {renderTextIndentIcon(parseInt(ind))}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-1.5 text-[10px] font-medium opacity-65 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={typography.chicagoStyle || false}
                  onChange={(e) => onChangeTypography({ chicagoStyle: e.target.checked })}
                  className="accent-[var(--accent)] h-3.5 w-3.5 cursor-pointer rounded-none border-[var(--border)]"
                />
                <span>{t('chicagoStyle')}</span>
              </label>
            </div>

            {/* Text Alignment */}
            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-65">{t('textAlignmentLabel')}</label>
              <div className="flex items-center gap-2">
                {([
                  { val: 'left', label: 'Left', Icon: AlignLeft },
                  { val: 'center', label: 'Center', Icon: AlignCenter },
                  { val: 'right', label: 'Right', Icon: AlignRight },
                  { val: 'justify', label: 'Justify', Icon: AlignJustify },
                ] as const).map(({ val, label, Icon }) => {
                  const isSelected =
                    typography.textAlignment === val ||
                    (val === 'left' && !typography.textAlignment);
                  return (
                    <button
                      key={val}
                      onClick={() => onChangeTypography({ textAlignment: val })}
                      className={optionBtn(isSelected)}
                      title={label}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scene Divider Symbol */}
            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-65">{t('sceneDividerLabel')}</label>
              <select
                value={typography.sceneDivider || 'asterisk'}
                onChange={(e) => onChangeTypography({ sceneDivider: e.target.value as 'boxes' | 'stars' | 'lines' | 'asterisk' })}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-none px-2.5 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)] cursor-pointer"
              >
                <option value="asterisk">Asterisks (* * *)</option>
                <option value="boxes">Boxes (◆ ◆ ◆)</option>
                <option value="stars">Stars (★ ★ ★)</option>
                <option value="lines">Thin lines</option>
              </select>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
