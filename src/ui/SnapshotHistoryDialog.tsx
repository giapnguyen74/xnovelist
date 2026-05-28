import React, { useEffect, useState, useCallback } from 'react';
import { History, RotateCcw, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { ProjectStorage } from '../storage/ProjectStorage';
import { listSnapshots, restoreSnapshot } from '../storage/snapshots';
import { SnapshotIndex } from '../storage/schemas';

interface SnapshotHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  storage: ProjectStorage;
  chapterId: string;
  onRestored: (newMarkdown: string) => void;
}

export default function SnapshotHistoryDialog({
  isOpen,
  onClose,
  storage,
  chapterId,
  onRestored,
}: SnapshotHistoryDialogProps) {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<SnapshotIndex['snapshots']>([]);
  const [status, setStatus] = useState<string | null>(null);

  const loadSnaps = useCallback(async () => {
    const list = await listSnapshots(storage, chapterId);
    // Sort descending by creation date
    setSnapshots([...list].reverse());
  }, [storage, chapterId]);

  useEffect(() => {
    if (isOpen && chapterId) {
      loadSnaps();
    }
  }, [isOpen, chapterId, loadSnaps]);

  if (!isOpen) return null;

  const handleRestore = async (id: string) => {
    try {
      setStatus('Restoring snapshot...');
      const restoredText = await restoreSnapshot(storage, chapterId, id);
      onRestored(restoredText);
      setStatus('Restored!');
      setTimeout(() => {
        setStatus(null);
        onClose();
      }, 1000);
    } catch {
      setStatus('Restore failed!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none animate-fade-in">
      <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
          <h3 className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
            <History size={18} className="text-[var(--accent)]" />
            {t('snapshots')}
          </h3>
          <button onClick={onClose} className="text-sm opacity-50 hover:opacity-100">✕</button>
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
          {snapshots.length === 0 ? (
            <div className="text-center text-xs opacity-50 p-8">No snapshots for this chapter yet.</div>
          ) : (
            snapshots.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)]"
              >
                <div className="flex flex-col gap-0.5 text-xs text-[var(--foreground)]">
                  <span className="font-semibold">{new Date(s.createdAt).toLocaleString()}</span>
                  <span className="opacity-70 font-mono">[{s.type}] {s.label || ''}</span>
                </div>
                <button
                  onClick={() => handleRestore(s.id)}
                  className="flex items-center gap-1 text-[11px] font-semibold bg-[var(--accent)] text-white hover:opacity-90 px-2.5 py-1 rounded transition-opacity"
                >
                  <RotateCcw size={12} />
                  Restore
                </button>
              </div>
            ))
          )}
        </div>

        {status && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--accent)] p-2 bg-[var(--accent-light)] rounded-md">
            <AlertTriangle size={14} />
            <span>{status}</span>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-md bg-[var(--border)] text-[var(--foreground)] hover:opacity-85 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
