import React, { useEffect, useState, useCallback } from 'react';
import { RotateCcw, Trash2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { ProjectStorage } from '../storage/ProjectStorage';

interface Tombstone {
  id: string;
  title: string;
  deletedAt: string;
}

interface RestoreDeletedChaptersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  storage: ProjectStorage;
  projectId: string;
  activeChapterOrder: string[];
  onRestoreChapter: (id: string, title: string) => Promise<void>;
}

export default function RestoreDeletedChaptersDialog({
  isOpen,
  onClose,
  storage,
  projectId,
  activeChapterOrder,
  onRestoreChapter,
}: RestoreDeletedChaptersDialogProps) {
  const { t } = useTranslation();
  const [tombstones, setTombstones] = useState<Tombstone[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const loadTombstones = useCallback(async () => {
    if (!storage || !projectId) return;
    setLoading(true);
    try {
      const prefix = `projects/${projectId}/`;
      const allFiles = await storage.listFiles();
      
      const historyIndexRe = new RegExp(`^${prefix}\\.history/Artifacts/chapter-([^/]+)/index\\.json$`);
      const list: Tombstone[] = [];

      for (const file of allFiles) {
        const match = file.match(historyIndexRe);
        if (match) {
          const cid = match[1];
          // If this chapter is NOT in the active chapterOrder, it is a tombstone
          if (!activeChapterOrder.includes(cid)) {
            try {
              const indexStr = await storage.readFile(file);
              if (indexStr) {
                const indexData = JSON.parse(indexStr);
                const snaps = indexData.snapshots || [];
                
                const preDeleteSnap = snaps.find((s: any) => s.type === 'pre-delete');
                const lastSnap = snaps[snaps.length - 1];
                
                let title = 'Untitled Chapter';
                let deletedAt = new Date().toISOString();
                
                if (preDeleteSnap) {
                  deletedAt = preDeleteSnap.createdAt;
                } else if (lastSnap) {
                  deletedAt = lastSnap.createdAt;
                }
                
                // Fetch chapter title from the last snapshot content if possible
                const snapToRead = preDeleteSnap || lastSnap;
                if (snapToRead) {
                  const snapPath = `${prefix}.history/Artifacts/chapter-${cid}/${snapToRead.id}.md`;
                  const content = await storage.readFile(snapPath);
                  if (content) {
                    const titleMatch = content.match(/^#\s+(.*)$/m);
                    if (titleMatch && titleMatch[1]) {
                      title = titleMatch[1].trim();
                    }
                  }
                }
                
                list.push({ id: cid, title, deletedAt });
              }
            } catch (err) {
              console.error('Failed to parse tombstone history:', cid, err);
            }
          }
        }
      }
      
      // Sort descending by deletedAt
      setTombstones(list.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()));
    } catch (err) {
      console.error('Failed to load tombstones:', err);
    } finally {
      setLoading(false);
    }
  }, [storage, projectId, activeChapterOrder]);

  useEffect(() => {
    if (isOpen) {
      loadTombstones();
      setStatus(null);
    }
  }, [isOpen, loadTombstones]);

  if (!isOpen) return null;

  const handleRestore = async (tomb: Tombstone) => {
    try {
      setStatus(`Restoring "${tomb.title}"...`);
      await onRestoreChapter(tomb.id, tomb.title);
      setStatus(t('restoreSuccess'));
      setTimeout(() => {
        setStatus(null);
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
      setStatus('Restore failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none animate-fade-in">
      <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-none max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-2">
            <Trash2 size={16} className="text-red-500" />
            {t('restoreDeletedTitle')}
          </h3>
          <button
            onClick={onClose}
            className="text-sm opacity-50 hover:opacity-100 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="text-center text-xs opacity-50 p-8">Loading deleted chapters...</div>
          ) : tombstones.length === 0 ? (
            <div className="text-center text-xs opacity-50 p-8 py-12">{t('noDeletedChapters')}</div>
          ) : (
            tombstones.map((tomb) => (
              <div
                key={tomb.id}
                className="flex items-center justify-between p-3 rounded-none border border-[var(--border)] bg-[var(--sidebar-bg)] hover:border-[var(--accent)]/30 transition-all"
              >
                <div className="flex flex-col gap-0.5 text-xs text-[var(--foreground)] min-w-0 pr-2">
                  <span className="font-bold truncate">{tomb.title}</span>
                  <span className="opacity-60 text-[10px]">
                    {t('deletedOn')}: {new Date(tomb.deletedAt).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleRestore(tomb)}
                  className="flex items-center gap-1 text-[10px] font-bold bg-[var(--accent)] text-white hover:opacity-90 px-2.5 py-1.5 rounded transition-all cursor-pointer shrink-0"
                >
                  <RotateCcw size={10} />
                  Restore
                </button>
              </div>
            ))
          )}
        </div>

        {status && (
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--accent)] p-2.5 bg-[var(--accent)]/10 rounded-none border border-[var(--accent)]/20 animate-pulse">
            <AlertCircle size={13} />
            <span>{status}</span>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-none bg-[var(--border)] text-[var(--foreground)] hover:opacity-85 transition-opacity cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
