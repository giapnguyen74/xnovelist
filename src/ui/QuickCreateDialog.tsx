'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Check } from 'lucide-react';

interface QuickCreateDialogProps {
  selectionText: string;
  onExecuteWriteOp: (opId: string, args: unknown) => Promise<void>;
  onDismiss: () => void;
}

/** Words required in a selection to NOT show this dialog (AI threshold). */
export const MIN_AI_SELECTION_WORDS = 10;

/** Returns true when the selection is short enough to trigger Quick Create. */
export function isSmallSelection(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length < MIN_AI_SELECTION_WORDS;
}

type CreateType = 'character' | 'location';

interface FormState {
  type: CreateType;
  name: string;
  role: string;   // role for character, significance for location
  notes: string;
}

/**
 * Reads the current DOM selection rect and returns a {top, left} in viewport
 * coordinates for positioning the dialog just above the selection.
 */
function getSelectionRect(): { top: number; left: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  return {
    top: rect.top + window.scrollY,
    left: rect.left + rect.width / 2 + window.scrollX,
  };
}

export default function QuickCreateDialog({
  selectionText,
  onExecuteWriteOp,
  onDismiss,
}: QuickCreateDialogProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null); // name that was just saved
  const dialogRef = useRef<HTMLDivElement>(null);

  // Capture position right when the component mounts (selection still active)
  useEffect(() => {
    const rect = getSelectionRect();
    setPos(rect);
  }, [selectionText]);

  // Dismiss on click outside the dialog
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onDismiss();
    }
  }, [onDismiss]);

  useEffect(() => {
    // slight delay so our own open-click doesn't instantly dismiss
    const id = setTimeout(() => document.addEventListener('mousedown', handleMouseDown), 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseDown]);

  // Also dismiss on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onDismiss]);

  if (!pos) return null;

  const DIALOG_W = 220;
  // Position above the selection midpoint; clamp to viewport
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const left = Math.max(8, Math.min(pos.left - DIALOG_W / 2, viewportW - DIALOG_W - 8));
  // We'll use a CSS transform to place it above; use `top` as the anchor, then
  // subtract ABOVE the selection with translateY(-100%) - 8px gap
  const top = pos.top;

  const handleSave = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    try {
      if (form.type === 'character') {
        await onExecuteWriteOp('character_add', {
          name: form.name.trim(),
          role: form.role.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
      } else {
        await onExecuteWriteOp('location_add', {
          name: form.name.trim(),
          significance: form.role.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
      }
      setSaved(form.name.trim());
      setForm(null);
      setTimeout(onDismiss, 900);
    } catch {
      // keep form open so user can retry
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div
      ref={dialogRef}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: `${DIALOG_W}px`,
        transform: 'translateY(calc(-100% - 10px))',
        zIndex: 9999,
      }}
      className="bg-[var(--sidebar-bg)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/30 text-[var(--foreground)] text-xs overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Arrow pointing down */}
      <div
        style={{
          position: 'absolute',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 12,
          height: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            background: 'var(--border)',
            transform: 'rotate(45deg)',
            margin: '-5px auto 0',
          }}
        />
      </div>

      {saved ? (
        <div className="flex items-center gap-1.5 px-3 py-2.5 text-[10px] text-green-600 dark:text-green-400">
          <Check size={12} /> Saved &ldquo;{saved}&rdquo;
        </div>
      ) : form === null ? (
        /* ── Picker ── */
        <div className="p-2 space-y-1.5">
          <div className="text-[8px] font-bold uppercase tracking-widest opacity-50 px-1">
            Add to Story Bible
          </div>
          <div className="text-[9px] italic opacity-60 px-1 truncate">
            &ldquo;{selectionText.trim()}&rdquo;
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setForm({ type: 'character', name: selectionText.trim(), role: '', notes: '' })}
              className="flex-1 py-1.5 rounded-lg bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/25 text-[10px] font-semibold text-[var(--accent)] transition-colors cursor-pointer"
            >
              + Character
            </button>
            <button
              onClick={() => setForm({ type: 'location', name: selectionText.trim(), role: '', notes: '' })}
              className="flex-1 py-1.5 rounded-lg bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/25 text-[10px] font-semibold text-[var(--accent)] transition-colors cursor-pointer"
            >
              + Location
            </button>
          </div>
        </div>
      ) : (
        /* ── Form ── */
        <div className="p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent)]">
              New {form.type === 'character' ? 'Character' : 'Location'}
            </span>
            <button
              onClick={() => setForm(null)}
              className="opacity-40 hover:opacity-80 text-[11px] cursor-pointer leading-none"
            >
              ←
            </button>
          </div>

          <div className="space-y-1.5">
            <div>
              <label className="text-[8px] uppercase tracking-wider opacity-50 font-bold block mb-0.5">Name</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => f ? { ...f, name: e.target.value } : f)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                className="w-full px-2 py-1 text-[10px] bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-[8px] uppercase tracking-wider opacity-50 font-bold block mb-0.5">
                {form.type === 'character' ? 'Role' : 'Significance'}
              </label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm((f) => f ? { ...f, role: e.target.value } : f)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                placeholder="optional…"
                className="w-full px-2 py-1 text-[10px] bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-[8px] uppercase tracking-wider opacity-50 font-bold block mb-0.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => f ? { ...f, notes: e.target.value } : f)}
                rows={2}
                placeholder="optional…"
                className="w-full px-2 py-1 text-[10px] bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>
          </div>

          <button
            disabled={!form.name.trim() || saving}
            onClick={handleSave}
            className="w-full py-1.5 rounded-lg bg-[var(--accent)] text-white text-[10px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1 transition-opacity"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            Save
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
