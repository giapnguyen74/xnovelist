import React from 'react';
import { useTranslation } from '../i18n/useTranslation';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-xl max-w-sm w-full p-5 shadow-lg">
        <h3 className="text-base font-semibold text-[var(--foreground)] mb-2">{title}</h3>
        <p className="text-sm opacity-80 text-[var(--foreground)] mb-6 leading-relaxed">{message}</p>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium rounded-md hover:bg-[var(--border)] text-[var(--foreground)] transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
