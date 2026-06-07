import React, { useEffect, useState, useCallback } from 'react';
import { History, RotateCcw, AlertTriangle, Camera } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { ProjectStorage } from '../storage/ProjectStorage';
import { listSnapshots, restoreSnapshot, takeSnapshot } from '../storage/snapshots';
import { SnapshotIndex } from '../storage/schemas';
import ConfirmDialog from './ConfirmDialog';

interface SnapshotHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  storage: ProjectStorage;
  /** Project ID — required so snapshots are read/written under projects/<id>/.history/... */
  projectId: string;
  chapterId: string;
  onRestored: (newMarkdown: string) => void;
}

export default function SnapshotHistoryPanel({
  isOpen,
  onClose,
  storage,
  projectId,
  chapterId,
  onRestored,
}: SnapshotHistoryPanelProps) {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<SnapshotIndex['snapshots']>([]);
  const [status, setStatus] = useState<string | null>(null);
  // Track which snapshot the user is being asked to confirm restoring.
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const loadSnaps = useCallback(async () => {
    if (!chapterId || !projectId) return;
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
    <div className="w-80 h-full border-l border-[var(--border)] bg-[var(--sidebar-bg)] select-none flex flex-col text-xs text-[var(--foreground)] animate-slide-in relative z-30 shrink-0">
      {/* Header */}
      <div className="h-[53px] px-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest">
          <History size={14} className="text-[var(--accent)]" />
          <span>{t('snapshots')}</span>
        </div>
        <button
          onClick={onClose}
          className="text-sm opacity-55 hover:opacity-100 font-bold p-1 cursor-pointer"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Snapshot toolbar */}
      <div className="p-3 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between gap-2 shrink-0">
        <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
          Create new backup
        </span>
        <button
          onClick={handleSnapshotNow}
          className="flex items-center gap-1.5 text-[10px] font-bold bg-[var(--accent)] text-white hover:opacity-90 px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm"
          title="Take a manual snapshot of the current chapter"
        >
          <Camera size={12} />
          {t('snapshotNow')}
        </button>
      </div>

      {/* Snapshots List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {snapshots.length === 0 ? (
          <div className="text-center text-xs opacity-50 p-8 py-12">
            <History size={24} className="mx-auto opacity-35 mb-2 animate-pulse" />
            {t('noSnapshots')}
          </div>
        ) : (
          snapshots.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--editor-bg)] shadow-xs transition-all hover:border-[var(--accent)]/30 group"
            >
              <div className="flex flex-col gap-0.5 text-xs text-[var(--foreground)]">
                <span className="font-bold text-[11px]">{new Date(s.createdAt).toLocaleString()}</span>
                <span className="opacity-70 font-mono text-[10px] mt-1 break-all bg-[var(--sidebar-bg)] p-1.5 rounded border border-[var(--border)]/30 leading-normal">
                  [{s.type}] {s.label || ''}
                </span>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setConfirmRestoreId(s.id)}
                  className="flex items-center gap-1 text-[10px] font-bold border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white px-2.5 py-1 rounded transition-all cursor-pointer"
                >
                  <RotateCcw size={10} />
                  {t('restore')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {status && (
        <div className="m-3 flex items-center gap-1.5 text-xs text-[var(--accent)] p-2.5 bg-[var(--accent-light)] border border-[var(--accent)]/10 rounded-md shrink-0">
          <AlertTriangle size={14} className="shrink-0 animate-bounce" />
          <span>{status}</span>
        </div>
      )}

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
