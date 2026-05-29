import React, { useRef, useState } from 'react';
import { Download, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { ProjectStorage } from '../storage/ProjectStorage';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { takeSnapshot } from '../storage/snapshots';
import ConfirmDialog from './ConfirmDialog';

interface ExportImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  storage: ProjectStorage;
  chapterOrder: string[];
  chapters: { id: string; title: string }[];
}

/** Validate the parsed JSON shape before we trust it. */
function isValidBackup(data: unknown): data is Record<string, string> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const rec = data as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (keys.length === 0) return false;
  // Every value must be a string (the path-keyed storage format)
  for (const k of keys) {
    if (typeof rec[k] !== 'string') return false;
  }
  // Must contain at least one recognisable project artifact
  const looksLikeXnovelist = keys.some(
    (k) => k === 'projects.json' || /^projects\//.test(k) || /^Artifacts\//.test(k) || k === 'Project.json'
  );
  return looksLikeXnovelist;
}

export default function ExportImportDialog({
  isOpen,
  onClose,
  storage,
  chapterOrder,
  chapters,
}: ExportImportDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  // Backup data parsed from the file, held until the user confirms replace.
  const [pendingImport, setPendingImport] = useState<Record<string, string> | null>(null);

  if (!isOpen) return null;

  // JSON Export: dumps all files inside IndexedDB
  const handleExportJSON = async () => {
    try {
      setStatus('Exporting...');
      const paths = await storage.listFiles();
      const backup: Record<string, string> = {};

      for (const p of paths) {
        const content = await storage.readFile(p);
        if (content !== null) {
          backup[p] = content;
        }
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xnovelist-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Backup saved!');
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setStatus('Export failed!');
    }
  };

  // JSON Import — Step 1: read & validate the file, then stage for confirmation.
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so picking the same file again triggers a fresh import.
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!isValidBackup(data)) {
          setStatus('Import failed — file does not look like an xnovelist backup.');
          return;
        }
        setPendingImport(data);
        setStatus(null);
      } catch {
        setStatus('Import failed — invalid JSON.');
      }
    };
    reader.readAsText(file);
  };

  // JSON Import — Step 2: user confirmed. Take pre-import snapshots of every
  // existing chapter, then overlay the backup contents.
  const confirmImport = async () => {
    if (!pendingImport) return;
    const data = pendingImport;
    setPendingImport(null);

    try {
      setStatus('Taking pre-import snapshots…');

      // Walk every project currently in storage and snapshot each chapter.
      const allKeys = await storage.listFiles();
      // Match either single-project layout (Artifacts/chapter-<id>.md) or
      // multi-project layout (projects/<pid>/Artifacts/chapter-<id>.md).
      const chapterPathRe = /^(?:projects\/([^/]+)\/)?Artifacts\/chapter-([^/]+)\.md$/;
      for (const path of allKeys) {
        const m = path.match(chapterPathRe);
        if (!m) continue;
        const projId = m[1];
        const chapId = m[2];
        const content = (await storage.readFile(path)) ?? '';
        await takeSnapshot(
          storage,
          chapId,
          'pre-import',
          'Pre-import safety snapshot',
          content,
          projId
        ).catch(() => { /* ignore individual snapshot failures */ });
      }

      setStatus('Importing backup…');
      for (const [path, content] of Object.entries(data)) {
        await storage.writeFile(path, content);
      }

      setStatus('Import successful — reloading…');
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setStatus('Import failed during write — partial state may remain.');
    }
  };

  // DOCX Export
  const handleExportDOCX = async () => {
    try {
      setStatus('Compiling DOCX...');
      const sections = [];

      for (const id of chapterOrder) {
        const chapter = chapters.find((c) => c.id === id);
        if (!chapter) continue;

        const content = await storage.readFile(`Artifacts/chapter-${id}.md`);
        if (!content) continue;

        // Simple Markdown cleaning for plaintext / simple paragraphs
        const cleanContent = content
          .replace(/#+\s+.*?\n/g, '') // strip title heading
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean);

        const docParagraphs = [
          new Paragraph({
            text: chapter.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          }),
          ...cleanContent.map((pText) => new Paragraph({ text: pText, spacing: { after: 120 } })),
          new Paragraph({ text: '', spacing: { after: 240 } }), // spacing spacer
        ];

        sections.push({
          properties: {},
          children: docParagraphs,
        });
      }

      const doc = new Document({ sections });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manuscript.docx';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('DOCX exported!');
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setStatus('DOCX Compilation failed!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-xl max-w-sm w-full p-6 shadow-xl space-y-5">
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
          <h3 className="text-base font-semibold text-[var(--foreground)]">{t('export')}</h3>
          <button
            onClick={onClose}
            className="text-sm opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* JSON Export */}
          <button
            onClick={handleExportJSON}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-sm text-[var(--foreground)] font-medium"
          >
            <span className="flex items-center gap-2">
              <Download size={16} className="text-[var(--accent)]" />
              Download JSON Backup
            </span>
          </button>

          {/* JSON Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-sm text-[var(--foreground)] font-medium"
          >
            <span className="flex items-center gap-2">
              <Upload size={16} className="text-[var(--accent)]" />
              Import JSON Backup
            </span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            accept=".json"
            className="hidden"
          />

          {/* DOCX Export */}
          <button
            onClick={handleExportDOCX}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-sm text-[var(--foreground)] font-medium"
          >
            <span className="flex items-center gap-2">
              <FileText size={16} className="text-green-600" />
              Compile to DOCX
            </span>
          </button>
        </div>

        {status && (
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--accent)] p-2 bg-[var(--accent-light)] rounded-md">
            <CheckCircle2 size={14} />
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

      {/* Replace-on-import confirmation. */}
      <ConfirmDialog
        isOpen={pendingImport !== null}
        title="Replace current data?"
        message={`The backup contains ${pendingImport ? Object.keys(pendingImport).length : 0} entries and will overwrite anything stored under the same paths. A pre-import snapshot of every chapter will be taken first so you can roll back. Continue?`}
        onConfirm={confirmImport}
        onCancel={() => { setPendingImport(null); setStatus(null); }}
      />
    </div>
  );
}
