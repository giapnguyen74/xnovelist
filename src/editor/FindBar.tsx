import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, X, CaseSensitive, ChevronRight } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface FindBarProps {
  searchQuery: string;
  onChangeSearchQuery: (val: string) => void;
  replaceQuery: string;
  onChangeReplaceQuery: (val: string) => void;
  caseSensitive: boolean;
  onToggleCaseSensitive: () => void;
  wholeWord: boolean;
  onToggleWholeWord: () => void;
  matchCount: number;
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
  /** When true, the Replace row is shown on mount. Useful for Cmd+Alt+F entry. */
  initialReplaceOpen?: boolean;
}

export default function FindBar({
  searchQuery,
  onChangeSearchQuery,
  replaceQuery,
  onChangeReplaceQuery,
  caseSensitive,
  onToggleCaseSensitive,
  wholeWord,
  onToggleWholeWord,
  matchCount,
  activeIndex,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  onClose,
  initialReplaceOpen = false,
}: FindBarProps) {
  const [isReplaceOpen, setIsReplaceOpen] = useState(initialReplaceOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    // Focus search input on open
    inputRef.current?.focus();
  }, []);

  // Handle escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="absolute left-3 right-3 sm:left-auto sm:right-6 top-[58px] z-30 bg-white dark:bg-[#1a1a19] border border-[var(--border)] shadow-lg p-3 sm:w-80 space-y-2 select-none text-[var(--foreground)] rounded-none">
      {/* Search Row */}
      <div className="flex items-center gap-1.5">
        {/* Toggle Replace Accordion button */}
        <button
          onClick={() => setIsReplaceOpen(!isReplaceOpen)}
          className={`p-1.5 hover:bg-[var(--border)] transition-colors cursor-pointer text-[var(--foreground)] opacity-75 hover:opacity-100 ${
            isReplaceOpen ? 'rotate-90' : ''
          }`}
          title="Toggle Replace"
        >
          <ChevronRight size={14} />
        </button>

        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onChangeSearchQuery(e.target.value)}
          placeholder={t('findPlaceholder')}
          className="flex-1 bg-[var(--background)] border border-[var(--border)] px-2.5 py-1 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)] rounded-none"
        />

        {/* Counter */}
        {searchQuery && (
          <span className="text-[10px] opacity-60 font-mono px-1">
            {matchCount > 0 ? `${activeIndex + 1}/${matchCount}` : '0/0'}
          </span>
        )}

        {/* Navigations */}
        <button
          onClick={onPrev}
          disabled={matchCount === 0}
          className="p-1 hover:bg-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Previous Match"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={onNext}
          disabled={matchCount === 0}
          className="p-1 hover:bg-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Next Match"
        >
          <ChevronDown size={14} />
        </button>

        {/* Case Sensitive */}
        <button
          onClick={onToggleCaseSensitive}
          className={`p-1 border transition-all cursor-pointer rounded-none text-xs font-semibold ${
            caseSensitive
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'border-[var(--border)] hover:bg-[var(--border)] opacity-75'
          }`}
          title="Match Case"
        >
          <CaseSensitive size={14} />
        </button>

        {/* Whole Word */}
        <button
          onClick={onToggleWholeWord}
          className={`px-1.5 py-0.5 border text-[10px] font-extrabold transition-all cursor-pointer rounded-none ${
            wholeWord
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'border-[var(--border)] hover:bg-[var(--border)] opacity-75'
          }`}
          title="Match Whole Word"
        >
          W
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1 hover:bg-[var(--border)] transition-colors cursor-pointer opacity-70 hover:opacity-100"
          title="Close Find Bar (Esc)"
        >
          <X size={14} />
        </button>
      </div>

      {/* Replace Row */}
      {isReplaceOpen && (
        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]/40 animate-fade-in">
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => onChangeReplaceQuery(e.target.value)}
            placeholder={t('replaceWithPlaceholder')}
            className="flex-1 bg-[var(--background)] border border-[var(--border)] px-2.5 py-1 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)] rounded-none"
          />
          <button
            onClick={onReplace}
            disabled={matchCount === 0}
            className="px-2.5 py-1 text-xs bg-[var(--background)] hover:bg-[var(--border)] border border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer rounded-none font-semibold"
            title="Replace current match"
          >
            {t('replaceSingle')}
          </button>
          <button
            onClick={onReplaceAll}
            disabled={matchCount === 0}
            className="px-2.5 py-1 text-xs bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer rounded-none font-semibold"
            title="Replace all matches"
          >
            {t('replaceAll')}
          </button>
        </div>
      )}
    </div>
  );
}
