import React, { useState } from 'react';
import { Plus, Trash2, Edit3, ArrowUp, ArrowDown, BookOpen } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface Chapter {
  id: string;
  title: string;
}

interface ChapterListProps {
  chapters: Chapter[];
  activeChapterId: string;
  chapterOrder: string[];
  wordCounts: Record<string, number>;
  onSelectChapter: (id: string) => void;
  onCreateChapter: () => void;
  onRenameChapter: (id: string, newTitle: string) => void;
  onDeleteChapter: (id: string) => void;
  onReorderChapters: (newOrder: string[]) => void;
}

export default function ChapterList({
  chapters,
  activeChapterId,
  chapterOrder,
  wordCounts,
  onSelectChapter,
  onCreateChapter,
  onRenameChapter,
  onDeleteChapter,
  onReorderChapters,
}: ChapterListProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const sortedChapters = [...chapterOrder]
    .map((id) => chapters.find((c) => c.id === id))
    .filter((c): c is Chapter => !!c);

  const handleStartRename = (c: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameChapter(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const newOrder = [...chapterOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      onReorderChapters(newOrder);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--border)] select-none">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <span className="font-semibold text-sm uppercase tracking-wider text-[var(--foreground)] opacity-70 flex items-center gap-2">
          <BookOpen size={16} />
          {t('outline')}
        </span>
        <button
          onClick={onCreateChapter}
          className="p-1 rounded-md hover:bg-[var(--border)] text-[var(--foreground)] transition-colors"
          title={t('addChapter')}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedChapters.length === 0 ? (
          <div className="text-center text-xs opacity-50 p-4">{t('noChapters')}</div>
        ) : (
          sortedChapters.map((chapter, index) => {
            const isActive = chapter.id === activeChapterId;
            const wCount = wordCounts[chapter.id] || 0;

            return (
              <div
                key={chapter.id}
                onClick={() => onSelectChapter(chapter.id)}
                className={`group flex flex-col p-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'hover:bg-[var(--border)] text-[var(--foreground)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  {editingId === chapter.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleSaveRename(chapter.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(chapter.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 bg-white text-black text-sm px-2 py-0.5 rounded border border-[var(--accent)] focus:outline-none"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="font-medium text-sm truncate flex-1 pr-2">
                      {chapter.title}
                    </span>
                  )}

                  <div className="hidden group-hover:flex items-center gap-1">
                    {index > 0 && (
                      <button
                        onClick={(e) => handleMove(index, 'up', e)}
                        className={`p-0.5 rounded hover:bg-black/10 transition-colors ${
                          isActive ? 'text-white' : 'text-[var(--foreground)] opacity-70'
                        }`}
                      >
                        <ArrowUp size={14} />
                      </button>
                    )}
                    {index < sortedChapters.length - 1 && (
                      <button
                        onClick={(e) => handleMove(index, 'down', e)}
                        className={`p-0.5 rounded hover:bg-black/10 transition-colors ${
                          isActive ? 'text-white' : 'text-[var(--foreground)] opacity-70'
                        }`}
                      >
                        <ArrowDown size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleStartRename(chapter, e)}
                      className={`p-0.5 rounded hover:bg-black/10 transition-colors ${
                        isActive ? 'text-white' : 'text-[var(--foreground)] opacity-70'
                      }`}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChapter(chapter.id);
                      }}
                      className={`p-0.5 rounded hover:bg-red-500/20 transition-colors ${
                        isActive ? 'text-white hover:bg-red-600' : 'text-red-500 hover:text-red-700'
                      }`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1 text-[11px] opacity-70">
                  <span>
                    {wCount} {t('wordCount')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
