import React, { useEffect, useRef, useState } from 'react';
import { Search, Book, FileText } from 'lucide-react';
import { Chapter } from '../storage/schemas';
import { useTranslation } from '../i18n/useTranslation';

interface CommandPaletteProps {
  chapters: Chapter[];
  activeChapterId: string;
  chapterOrder: string[];
  onSelectChapter: (id: string) => void;
  onSearchManuscript: (query: string) => Promise<{ chapterId: string; chapterTitle: string; snippet: string }[]>;
  onSelectSnippet: (chapterId: string, query: string) => void;
  onClose: () => void;
}

export default function CommandPalette({
  chapters,
  activeChapterId,
  chapterOrder,
  onSelectChapter,
  onSearchManuscript,
  onSelectSnippet,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ chapterId: string; chapterTitle: string; snippet: string }[]>([]);
  const [isSearchingManuscript, setIsSearchingManuscript] = useState(false);
  const [searchMode, setSearchMode] = useState<'chapters' | 'snippets'>('chapters');
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

  const orderedChapters = chapterOrder
    .map((id) => chapters.find((c) => c.id === id))
    .filter((c): c is Chapter => !!c);

  // Filter chapters based on query
  const filteredChapters = orderedChapters.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleSearchFullText = async () => {
    if (!query.trim()) return;
    setIsSearchingManuscript(true);
    setSearchMode('snippets');
    try {
      const results = await onSearchManuscript(query);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearchingManuscript(false);
    }
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If there are exact/fuzzy chapter matches and we are in chapter mode, open the first matching chapter
      if (searchMode === 'chapters') {
        if (filteredChapters.length > 0) {
          onSelectChapter(filteredChapters[0].id);
          onClose();
        } else {
          // If no matching chapters, trigger full-text search
          handleSearchFullText();
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[15vh] px-4 z-[100] animate-fade-in select-none">
      <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-none w-full max-w-xl shadow-2xl flex flex-col text-[var(--foreground)] overflow-hidden">
        {/* Search header bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <Search size={16} className="text-[var(--foreground)] opacity-50" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchMode('chapters'); // Reset to chapter mode on query edit
            }}
            onKeyDown={handleKeyDownInput}
            placeholder={t('searchChaptersPlaceholder')}
            className="flex-1 bg-transparent border-none text-sm text-[var(--foreground)] focus:outline-none placeholder-[var(--foreground)]/45"
          />
          <button
            onClick={onClose}
            className="text-xs opacity-50 hover:opacity-100 transition-opacity cursor-pointer font-mono border border-[var(--border)] px-1.5 py-0.5 rounded-none bg-[var(--background)]"
          >
            ESC
          </button>
        </div>

        {/* Results Container */}
        <div className="flex-1 max-h-[50vh] overflow-y-auto p-2">
          {searchMode === 'chapters' ? (
            <div className="space-y-0.5">
              {filteredChapters.map((chapter, index) => {
                const isActive = chapter.id === activeChapterId;
                return (
                  <div
                    key={chapter.id}
                    onClick={() => {
                      onSelectChapter(chapter.id);
                      onClose();
                    }}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-xs rounded-none ${
                      isActive
                        ? 'bg-[var(--accent)] text-white'
                        : 'hover:bg-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    <Book size={14} className="opacity-70" />
                    <span className="font-semibold">{index + 1}.</span>
                    <span className="font-medium truncate flex-1">{chapter.title}</span>
                    {isActive && <span className="text-[10px] opacity-75 font-semibold">{t('activeChapter')}</span>}
                  </div>
                );
              })}

              {/* Toggle to Full text search option */}
              {query.trim() && (
                <div
                  onClick={handleSearchFullText}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--border)] text-[var(--foreground)] transition-colors text-xs border-t border-[var(--border)]/40 mt-1 rounded-none font-semibold text-[var(--accent)]"
                >
                  <Search size={14} />
                  <span>{t('searchAllChaptersFor')} &quot;{query}&quot;...</span>
                </div>
              )}

              {filteredChapters.length === 0 && !query.trim() && (
                <div className="text-center py-8 text-xs opacity-50">{t('noChaptersFound')}</div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 pb-1 border-b border-[var(--border)]/30 text-[10px] uppercase font-bold tracking-wider opacity-60">
                <span>{t('manuscriptSearchResults')}</span>
                <button
                  onClick={() => setSearchMode('chapters')}
                  className="hover:text-[var(--accent)] transition-colors cursor-pointer text-[9px]"
                >
                  {t('backToChapters')}
                </button>
              </div>

              {isSearchingManuscript ? (
                <div className="text-center py-12 text-xs opacity-50 animate-pulse">{t('searchingManuscript')}</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((res, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      onSelectSnippet(res.chapterId, query);
                      onClose();
                    }}
                    className="p-2.5 hover:bg-[var(--border)] cursor-pointer border-b border-[var(--border)]/30 transition-colors text-xs space-y-1 rounded-none flex flex-col"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--accent)] opacity-85">
                      <FileText size={11} />
                      <span>{res.chapterTitle}</span>
                    </div>
                    {/* Render snippet, highlighting query */}
                    <p
                      className="text-[11px] opacity-80 leading-relaxed truncate-2-lines italic"
                      dangerouslySetInnerHTML={{
                        __html: res.snippet.replace(
                          new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'),
                          '<mark class="bg-amber-300 dark:bg-amber-500/80 px-0.5 text-black font-semibold">$1</mark>'
                        ),
                      }}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-xs opacity-50">{t('noMatchesManuscript')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
