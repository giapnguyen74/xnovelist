import React, { useState } from 'react';
import { Chapter } from '../storage/schemas';
import { BookOpen, Trash2, History, Plus } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface OutlineGridProps {
  chapters: Chapter[];
  chapterOrder: string[];
  wordCounts: Record<string, number>;
  chaptersWithHistory: Set<string>;
  onSelectChapter: (id: string) => void;
  onCreateChapter: () => void;
  onRenameChapter: (id: string, title: string) => void;
  onUpdateChapterSynopsis: (id: string, synopsis: string) => void;
  onUpdateChapterStatus: (id: string, status: Chapter['status']) => void;
  onDeleteChapter: (id: string) => void;
  onReorderChapters: (newOrder: string[]) => void;
  onOpenHistory: (id: string) => void;
}

export default function OutlineGrid({
  chapters,
  chapterOrder,
  wordCounts,
  chaptersWithHistory,
  onSelectChapter,
  onCreateChapter,
  onRenameChapter,
  onUpdateChapterSynopsis,
  onUpdateChapterStatus,
  onDeleteChapter,
  onReorderChapters,
  onOpenHistory,
}: OutlineGridProps) {
  const { t } = useTranslation();
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  
  const [editingSynId, setEditingSynId] = useState<string | null>(null);
  const [editingSynValue, setEditingSynValue] = useState('');

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const orderedChapters = chapterOrder
    .map((id) => chapters.find((c) => c.id === id))
    .filter((c): c is Chapter => !!c);

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newOrder = [...chapterOrder];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, removed);
    onReorderChapters(newOrder);
    setDraggedIndex(null);
  };

  // Inline Title editing
  const startEditingTitle = (chapter: Chapter) => {
    setEditingTitleId(chapter.id);
    setEditingTitleValue(chapter.title);
  };

  const commitTitle = (id: string) => {
    if (editingTitleValue.trim()) {
      onRenameChapter(id, editingTitleValue.trim());
    }
    setEditingTitleId(null);
  };

  // Inline Synopsis editing
  const startEditingSynopsis = (chapter: Chapter) => {
    setEditingSynId(chapter.id);
    setEditingSynValue(chapter.synopsis || '');
  };

  const commitSynopsis = (id: string) => {
    onUpdateChapterSynopsis(id, editingSynValue.trim());
    setEditingSynId(null);
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--editor-bg)] p-6 md:p-8 select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Title */}
        <div className="pb-3 border-b border-[var(--border)] flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wider text-[var(--foreground)] font-sans">{t('manuscriptOutline')}</h2>
            <p className="text-xs opacity-70">{t('outlineSubtitle')}</p>
          </div>
          <button
            onClick={onCreateChapter}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white hover:opacity-90 font-bold rounded-none text-xs transition-opacity shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            {t('addChapterBtn')}
          </button>
        </div>

        {/* Outline Grid cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orderedChapters.map((chapter, index) => {
            const wordCount = wordCounts[chapter.id] || 0;
            const hasHistory = chaptersWithHistory.has(chapter.id);
            const status = chapter.status || 'draft';

            return (
              <div
                key={chapter.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className="group bg-white dark:bg-[#1e1e1d] border border-[var(--border)] p-4 flex flex-col justify-between space-y-4 hover:shadow-md hover:border-[var(--accent)]/50 transition-all rounded-none relative cursor-default hover:cursor-grab active:cursor-grabbing"
              >
                
                {/* Top header details inside card */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="text-[10px] font-bold font-mono text-[var(--accent)] opacity-60 select-none">
                        Ch.{index + 1}
                      </span>
                      {editingTitleId === chapter.id ? (
                        <input
                          type="text"
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          onBlur={() => commitTitle(chapter.id)}
                          onKeyDown={(e) => e.key === 'Enter' && commitTitle(chapter.id)}
                          autoFocus
                          className="w-full px-2 py-1 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm font-serif font-bold focus:outline-none focus:border-[var(--accent)]"
                        />
                      ) : (
                        <h3
                          onClick={() => startEditingTitle(chapter)}
                          className="font-serif font-bold text-sm text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors line-clamp-1 cursor-text hover:underline"
                          title={t('renameChapter')}
                        >
                          {chapter.title}
                        </h3>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Snapshot history dot indicator */}
                      {hasHistory && (
                        <span
                          className="w-2 h-2 rounded-full bg-amber-500 animate-pulse cursor-help"
                          title={t('hasSnapshotHistory')}
                        />
                      )}

                      {/* Status Chip Select */}
                      <select
                        value={status}
                        onChange={(e) => onUpdateChapterStatus(chapter.id, e.target.value as Chapter['status'])}
                        className={`text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-none border border-transparent cursor-pointer outline-none transition-colors ${
                          status === 'final'
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 border-emerald-500/20'
                            : status === 'revised'
                              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 border-amber-500/20'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 border-neutral-700/20'
                        }`}
                      >
                        <option value="draft">{t('statusDraft')}</option>
                        <option value="revised">{t('statusRevised')}</option>
                        <option value="final">{t('statusFinal')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Inline Synopsis box */}
                  <div className="min-h-[90px] border border-dashed border-[var(--border)]/60 bg-[var(--editor-bg)]/40 p-2 text-xs relative group/syn">
                    {editingSynId === chapter.id ? (
                      <textarea
                        value={editingSynValue}
                        onChange={(e) => setEditingSynValue(e.target.value)}
                        onBlur={() => commitSynopsis(chapter.id)}
                        className="w-full h-[85px] bg-transparent text-[var(--foreground)] focus:outline-none resize-none text-[11px] leading-relaxed"
                        placeholder={t('synopsisPlaceholder')}
                        autoFocus
                      />
                    ) : (
                      <p
                        onClick={() => startEditingSynopsis(chapter)}
                        className="text-[11px] opacity-75 leading-relaxed cursor-text line-clamp-5 whitespace-pre-wrap select-text h-[85px]"
                        title={t('renameChapter')}
                      >
                        {chapter.synopsis || (
                          <span className="italic opacity-45 block">{t('noSynopsis')}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer words & hover actions */}
                <div className="flex items-center justify-between border-t border-[var(--border)]/30 pt-3 text-[10px] uppercase font-bold tracking-wider opacity-60">
                  <span>{wordCount.toLocaleString()} {t('wordCount')}</span>
                  
                  {/* Actions inside Card */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenHistory(chapter.id)}
                      className="p-1 hover:text-[var(--accent)] hover:opacity-100 transition-all cursor-pointer"
                      title={t('snapshots')}
                    >
                      <History size={13} />
                    </button>
                    <button
                      onClick={() => onSelectChapter(chapter.id)}
                      className="p-1 hover:text-[var(--accent)] hover:opacity-100 transition-all cursor-pointer"
                      title={t('write')}
                    >
                      <BookOpen size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteChapter(chapter.id)}
                      className="p-1 text-red-500 hover:opacity-100 transition-all cursor-pointer"
                      title={t('deleteChapter')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}

          {/* Add chapter card tile */}
          <div
            onClick={onCreateChapter}
            className="group cursor-pointer flex flex-col justify-center items-center p-6 border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 hover:opacity-100 transition-all rounded-none opacity-60 text-center min-h-[220px]"
          >
            <Plus size={28} className="text-[var(--accent)] mb-2" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">{t('newChapterCard')}</span>
            <span className="text-[10px] opacity-70 mt-1 max-w-[150px] leading-relaxed block">{t('addNextChapter')}</span>
          </div>

        </div>

      </div>
    </div>
  );
}
