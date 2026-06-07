'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Languages,
  CheckSquare,
  Scissors,
  Eye,
  MessageSquareCode,
  ChevronDown,
  UserPlus,
  MapPin,
  Feather
} from 'lucide-react';
import { actionsForLevel } from '../ai/registry';

interface SelectionAIToolbarProps {
  selectionText: string;
  onSelectAction: (actionId: string) => void;
  onDismiss: () => void;
  aiLevel: number;
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  fix_grammar: CheckSquare,
  rephrase: Languages,
  shorten: Scissors,
  polish_dialogue: MessageSquareCode,
  vivid_detail: Eye,
  capture_characters: UserPlus,
  capture_locations: MapPin,
  capture_style: Feather,
};

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

export default function SelectionAIToolbar({
  selectionText,
  onSelectAction,
  onDismiss,
  aiLevel,
}: SelectionAIToolbarProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Capture position when mounting
  useEffect(() => {
    const rect = getSelectionRect();
    setPos(rect);
  }, [selectionText]);

  // Dismiss on click outside
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
      onDismiss();
    }
  }, [onDismiss]);

  useEffect(() => {
    const id = setTimeout(() => document.addEventListener('mousedown', handleMouseDown), 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseDown]);

  // Dismiss on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onDismiss]);

  if (!pos) return null;

  // Retrieve selection-scoped actions unlocked at active level
  const selectionActions = actionsForLevel(aiLevel).filter((a) => a.scope === 'selection');

  if (selectionActions.length === 0) return null;

  // Sort: primaryOrder actions first
  const primaryOrder = ['fix_grammar', 'rephrase', 'capture_characters', 'shorten'];
  const sortedActions = [...selectionActions].sort((a, b) => {
    const idxA = primaryOrder.indexOf(a.id);
    const idxB = primaryOrder.indexOf(b.id);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  const showMore = sortedActions.length > 4;
  const primaryActions = showMore ? sortedActions.slice(0, 3) : sortedActions;
  const secondaryActions = showMore ? sortedActions.slice(3) : [];

  // Dynamic width based on button count
  const TOOLBAR_W = showMore ? 340 : Math.min(480, primaryActions.length * 105 + 50);
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const left = Math.max(8, Math.min(pos.left - TOOLBAR_W / 2, viewportW - TOOLBAR_W - 8));
  const top = pos.top;

  const content = (
    <div
      ref={toolbarRef}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translateY(calc(-100% - 10px))',
        zIndex: 9999,
      }}
      className="bg-[var(--sidebar-bg)]/95 backdrop-blur-md border border-[var(--border)] rounded-full shadow-2xl shadow-black/20 text-[var(--foreground)] text-xs flex items-center p-1.5 gap-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 relative">
        <div className="pl-2 pr-1 opacity-50 shrink-0">
          <Sparkles size={13} className="text-[var(--accent)]" />
        </div>
        {primaryActions.map((act) => {
          const Icon = ICON_MAP[act.id] || Sparkles;
          return (
            <button
              key={act.id}
              onClick={() => {
                onSelectAction(act.id);
                onDismiss();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] font-semibold transition-all cursor-pointer text-[10px] shrink-0 border border-transparent hover:border-[var(--accent)]/25"
            >
              <Icon size={12} className="shrink-0" />
              <span>{act.label}</span>
            </button>
          );
        })}
        
        {showMore && (
          <>
            {/* Divider */}
            <div className="w-[1px] h-4 bg-[var(--border)] mx-1 shrink-0" />

            {/* More dropdown trigger */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] font-semibold transition-all cursor-pointer text-[10px] border border-transparent ${
                  isMoreOpen ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20' : 'hover:border-[var(--accent)]/25'
                }`}
              >
                <span>More</span>
                <ChevronDown size={12} className={`transition-transform shrink-0 ${isMoreOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMoreOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-[var(--sidebar-bg)] border border-[var(--border)] rounded-lg shadow-xl py-1 min-w-[140px] z-[10000] animate-fade-in">
                  {secondaryActions.map((act) => {
                    const Icon = ICON_MAP[act.id] || Sparkles;
                    return (
                      <button
                        key={act.id}
                        onClick={() => {
                          onSelectAction(act.id);
                          onDismiss();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] text-left cursor-pointer transition-colors text-[10px] font-semibold"
                      >
                        <Icon size={12} className="shrink-0 opacity-70" />
                        <span>{act.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {/* Down arrow pointing to selection */}
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
    </div>
  );

  return createPortal(content, document.body);
}
