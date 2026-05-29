/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState } from 'react';
import { Download, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { ProjectStorage } from '../storage/ProjectStorage';
import { Document, Packer, Paragraph, HeadingLevel, ImageRun, AlignmentType } from 'docx';
import { takeSnapshot } from '../storage/snapshots';
import ConfirmDialog from './ConfirmDialog';
import { Project } from '../storage/schemas';

interface ExportImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  storage: ProjectStorage;
  chapterOrder: string[];
  chapters: { id: string; title: string }[];
  project: Project;
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
  project,
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
      setStatus(t('exportingStatus'));
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
      setStatus(t('backupSaved'));
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setStatus(t('exportFailed'));
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
          setStatus(t('importFailed'));
          return;
        }
        setPendingImport(data);
        setStatus(null);
      } catch {
        setStatus(t('importFailedJson'));
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
      setStatus(t('takingPreImportSnapshots'));

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

      setStatus(t('importingBackup'));
      for (const [path, content] of Object.entries(data)) {
        await storage.writeFile(path, content);
      }

      setStatus(t('importSuccess'));
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setStatus(t('importFailedWrite'));
    }
  };

  // DOCX Export
  const handleExportDOCX = async () => {
    try {
      setStatus(t('compilingDocx'));
      const prefix = `projects/${project.id}/`;
      
      const children: any[] = [];

      // 1. Render Title Page
      children.push(
        new Paragraph({
          text: '',
          spacing: { before: 2880 }, // Spacer
        })
      );

      children.push(
        new Paragraph({
          text: project.title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
        })
      );

      if (project.series) {
        children.push(
          new Paragraph({
            text: `${project.series}${project.seriesIndex ? ` (Book ${project.seriesIndex})` : ''}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 },
          })
        );
      }

      children.push(
        new Paragraph({
          text: `By ${project.author || 'Anonymous'}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 960 },
        })
      );

      // Embedded Cover Image if set
      if (project.coverImage) {
        try {
          const base64Data = project.coverImage.split(',')[1];
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: bytes.buffer,
                  transformation: {
                    width: 180,
                    height: 240,
                  },
                  type: 'png',
                } as any),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 },
            })
          );
        } catch (e) {
          console.error('Failed to parse cover image for DOCX', e);
        }
      }

      // Page break after title page
      children.push(
        new Paragraph({
          text: '',
          pageBreakBefore: true,
        })
      );

      // Scene divider text based on project preferences
      const sceneDividerText = (() => {
        switch (project.typography?.sceneDivider) {
          case 'boxes': return '◆   ◆   ◆';
          case 'stars': return '★   ★   ★';
          case 'lines': return '————————————';
          case 'asterisk':
          default: return '*   *   *';
        }
      })();

      const useChicago = project.typography?.chicagoStyle ?? false;

      // 2. Render Chapters
      for (let i = 0; i < chapterOrder.length; i++) {
        const id = chapterOrder[i];
        const chapter = chapters.find((c) => c.id === id);
        if (!chapter) continue;

        const content = await storage.readFile(`${prefix}Artifacts/chapter-${id}.md`);
        if (!content) continue;

        // Clean markdown headings, spacing etc.
        const lines = content
          .replace(/#+\s+.*?\n/g, '') // strip titles
          .split('\n')
          .map((p) => p.trim());

        // Chapter Header Paragraph
        children.push(
          new Paragraph({
            text: chapter.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 1440, after: 720 },
            pageBreakBefore: true, // Force page break before each chapter!
          })
        );

        let justAfterDivider = true; // First paragraph of chapter is not indented

        for (const line of lines) {
          if (!line) continue;

          // Check if line is a scene divider
          if (line === '---' || line === '***' || line === '* * *' || line === '___') {
            children.push(
              new Paragraph({
                text: sceneDividerText,
                alignment: AlignmentType.CENTER,
                spacing: { before: 480, after: 480 },
              })
            );
            justAfterDivider = true; // Paragraph after scene divider is not indented
          } else {
            const isIndent = useChicago && !justAfterDivider;
            children.push(
              new Paragraph({
                text: line,
                spacing: useChicago ? { before: 0, after: 0, line: 360 } : { before: 0, after: 120, line: 240 },
                indent: isIndent ? { firstLine: 720 } : undefined, // 720 dxa = 0.5 inches
                alignment: AlignmentType.LEFT,
              })
            );
            justAfterDivider = false;
          }
        }
      }

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1440,    // 1 inch
                  bottom: 1440, // 1 inch
                  left: 1440,   // 1 inch
                  right: 1440,  // 1 inch
                },
              },
            },
            children,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title.replace(/\s+/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(t('docxExported'));
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setStatus(t('docxFailed'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none animate-fade-in">
      <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-none max-w-sm w-full p-6 shadow-xl space-y-5">
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground)]">{t('export')}</h3>
          <button
            onClick={onClose}
            className="text-sm opacity-50 hover:opacity-100 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* JSON Export */}
          <button
            onClick={handleExportJSON}
            className="w-full flex items-center justify-between p-3 rounded-none border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-xs text-[var(--foreground)] font-semibold cursor-pointer bg-transparent"
          >
            <span className="flex items-center gap-2">
              <Download size={15} className="text-[var(--accent)]" />
              {t('downloadJsonBackup')}
            </span>
          </button>

          {/* JSON Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between p-3 rounded-none border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-xs text-[var(--foreground)] font-semibold cursor-pointer bg-transparent"
          >
            <span className="flex items-center gap-2">
              <Upload size={15} className="text-[var(--accent)]" />
              {t('importJsonBackup')}
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
            className="w-full flex items-center justify-between p-3 rounded-none border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-xs text-[var(--foreground)] font-semibold cursor-pointer bg-transparent"
          >
            <span className="flex items-center gap-2">
              <FileText size={15} className="text-green-600" />
              {t('compileToDOCX')}
            </span>
          </button>
        </div>

        {status && (
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--accent)] p-2 bg-[var(--accent)]/10 rounded-none border border-[var(--accent)]/20">
            <CheckCircle2 size={13} />
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

      {/* Replace-on-import confirmation. */}
      <ConfirmDialog
        isOpen={pendingImport !== null}
        title={t('replaceCurrentData')}
        message={t('replaceCurrentDataMsg').replace('{count}', String(pendingImport ? Object.keys(pendingImport).length : 0))}
        onConfirm={confirmImport}
        onCancel={() => { setPendingImport(null); setStatus(null); }}
      />
    </div>
  );
}
