import React from 'react';
import { useTranslation } from '../i18n/useTranslation';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onChangeTheme: (theme: 'light' | 'dark') => void;
}

export default function SettingsDialog({
  isOpen,
  onClose,
  theme,
  onChangeTheme,
}: SettingsDialogProps) {
  const { t, lang, setLang } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none animate-fade-in">
      <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-none max-w-sm w-full p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground)]">{t('settings')}</h3>
          <button
            onClick={onClose}
            className="text-sm opacity-50 hover:opacity-100 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase opacity-75 mb-1 font-semibold">{t('theme')}</label>
            <select
              value={theme}
              onChange={(e) => onChangeTheme(e.target.value as 'light' | 'dark')}
              className="w-full px-3 py-1.5 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="light">{t('light')}</option>
              <option value="dark">{t('dark')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase opacity-75 mb-1 font-semibold">{t('language')}</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'en' | 'vi')}
              className="w-full px-3 py-1.5 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-none bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  );
}
