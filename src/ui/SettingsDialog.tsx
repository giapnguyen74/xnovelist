import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { Project } from '../storage/schemas';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onUpdateProject: (updated: Partial<Project>) => void;
  theme: 'light' | 'dark';
  onChangeTheme: (theme: 'light' | 'dark') => void;
}

export default function SettingsDialog({
  isOpen,
  onClose,
  project,
  onUpdateProject,
  theme,
  onChangeTheme,
}: SettingsDialogProps) {
  const { t, lang, setLang } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
          <h3 className="text-base font-semibold text-[var(--foreground)]">{t('settings')}</h3>
          <button
            onClick={onClose}
            className="text-sm opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        {/* Project info */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs uppercase opacity-75 mb-1">{t('title')}</label>
            <input
              type="text"
              value={project.title}
              onChange={(e) => onUpdateProject({ title: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-xs uppercase opacity-75 mb-1">{t('author')}</label>
            <input
              type="text"
              value={project.author}
              onChange={(e) => onUpdateProject({ author: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase opacity-75 mb-1">{t('targetWords')}</label>
              <input
                type="number"
                value={project.targetWordCount}
                onChange={(e) => onUpdateProject({ targetWordCount: parseInt(e.target.value) || 50000 })}
                className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs uppercase opacity-75 mb-1">{t('theme')}</label>
              <select
                value={theme}
                onChange={(e) => onChangeTheme(e.target.value as 'light' | 'dark')}
                className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="light">{t('light')}</option>
                <option value="dark">{t('dark')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase opacity-75 mb-1">{t('language')}</label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as 'en' | 'vi')}
                className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase opacity-75 mb-1">{t('proseLanguage')}</label>
              <select
                value={project.language}
                onChange={(e) => onUpdateProject({ language: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </div>
          </div>
        </div>

        {/* AI Info */}
        <div className="p-3 bg-[var(--sidebar-bg)] rounded-lg text-xs opacity-75">
          <span className="font-semibold block mb-1">AI Mode</span>
          <span>AI features are not yet available. This is a secure, local-first v0.1 AI-Free layout.</span>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-md bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
