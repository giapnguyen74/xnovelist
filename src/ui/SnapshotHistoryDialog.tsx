import React, { useEffect, useState, useCallback } from 'react';
import { History, RotateCcw, AlertTriangle, Camera } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { ProjectStorage } from '../storage/ProjectStorage';
import { listSnapshots, restoreSnapshot, takeSnapshot } from '../storage/snapshots';
import { SnapshotIndex } from '../storage/schemas';
import ConfirmDialog from './ConfirmDialog';

interface SnapshotHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  storage: ProjectStorage;
  /** Project ID — required so snapshots are read/written under projects/<id>/.history/... */
  projectId: string;
  chapterId: string;
  onRestored: (newMarkdown: string) => void;
}

export default function SnapshotHistoryDialog({
  isOpen,
  onClose,
  storage,
  projectId,
  chapterId,
  onRestored,
}: SnapshotHistoryDialogProps) {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<SnapshotIndex['snapshots']>([]);
  const [status, setStatus] = useState<string | null>(null);
  // Track which snapshot the user is being asked to confirm restoring.
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const loadSnaps = useCallback(async () => {
    const list = await listSnapshots(storage, chapterId, projectId);
    // Sort descending by creation date
    setSnapshots([...list].reverse());
  }, [storage, chapterId, projectId]);

  useEffect(() => {
    if (isOpen && chapterId) {
      loadSnaps();
    }
  }, [isOpen, chapterId, loadSnaps]);

  if (!isOpen) return null;

  const handleSnapshotNow = async () => {
    try {
      setStatus(t('takingSnapshot'));
      await takeSnapshot(storage, chapterId, 'manual', 'Manual snapshot', undefined, projectId);
      await loadSnaps();
      setStatus(t('snapshotTaken'));
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus(t('snapshotFailed'));
    }
  };

  const performRestore = async (id: string) => {
    setConfirmRestoreId(null);
    try {
      setStatus(t('restoringSnapshot'));
      const restoredText = await restoreSnapshot(storage, chapterId, id, projectId);
      onRestored(restoredText);
      await loadSnaps(); // pre-restore snapshot was just created — refresh
      setStatus(t('restored'));
      setTimeout(() => {
        setStatus(null);
        onClose();
      }, 1000);
    } catch {
      setStatus(t('restoreFailed'));
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleSnapshotNow}
              className="flex items-center gap-1 text-[11px] font-semibold border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--sidebar-bg)] px-2.5 py-1 rounded transition-colors"
              title="Take a manual snapshot of the current chapter"
            >
              <Camera size={12} />
              {t('snapshotNow')}
            </button>
            <button onClick={onClose} className="text-sm opacity-50 hover:opacity-100 ml-2">✕</button>
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
          {snapshots.length === 0 ? (
            <div className="text-center text-xs opacity-50 p-8">{t('noSnapshots')}</div>
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
                  onClick={() => setConfirmRestoreId(s.id)}
                  className="flex items-center gap-1 text-[11px] font-semibold bg-[var(--accent)] text-white hover:opacity-90 px-2.5 py-1 rounded transition-opacity"
                >
                  <RotateCcw size={12} />
                  {t('restore')}
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
            {t('close')}
          </button>
        </div>
      </div>

      {/* Restore confirmation — replaces the current chapter contents */}
      <ConfirmDialog
        isOpen={confirmRestoreId !== null}
        title={t('restoreSnapshotTitle')}
        message={t('restoreSnapshotMsg')}
        onConfirm={() => confirmRestoreId && performRestore(confirmRestoreId)}
        onCancel={() => setConfirmRestoreId(null)}
      />
    </div>
  );
}
