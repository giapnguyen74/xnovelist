import React from 'react';
import { Sparkles, Settings, BookOpen, Search, HelpCircle, ArrowRight, Bot } from 'lucide-react';
import { WorkspaceAIConfig } from '../storage/aiConfig';

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceAI: WorkspaceAIConfig;
  onOpenPreferences: () => void;
}

export default function AIPanel({
  isOpen,
  onClose,
  workspaceAI,
  onOpenPreferences,
}: AIPanelProps) {
  if (!isOpen) return null;

  // Check if any provider is configured / ready
  const isReady = (pid: string): boolean => {
    const providers = workspaceAI.providers as Record<string, any>;
    const config = providers[pid];
    if (!config) return false;
    if (pid === 'openai') return !!(config.accessToken || config.apiKey);
    if (pid === 'anthropic') return !!config.accessToken;
    if (pid === 'openrouter') return !!config.apiKey;
    if (pid === 'local') return !!(config.baseUrl && config.defaultModel);
    return false;
  };

  const activeProviderId = (workspaceAI.defaultProviderId && workspaceAI.defaultProviderId !== 'openai' && workspaceAI.defaultProviderId !== 'anthropic')
    ? workspaceAI.defaultProviderId
    : (['openrouter', 'local'] as const).find(isReady);

  const hasActiveProvider = !!activeProviderId;
  const activeProviderConfig = activeProviderId ? (workspaceAI.providers as Record<string, any>)[activeProviderId] : null;
  const activeModel = activeProviderConfig?.defaultModel || '';

  const getProviderName = (pid: string) => {
    if (pid === 'openai') return 'OpenAI';
    if (pid === 'anthropic') return 'Claude';
    if (pid === 'openrouter') return 'OpenRouter';
    if (pid === 'local') return 'Local AI';
    return pid;
  };

  return (
    <div className="w-80 h-full border-l border-[var(--border)] bg-[var(--sidebar-bg)] select-none flex flex-col justify-between text-xs text-[var(--foreground)] animate-slide-in relative z-30 shrink-0">
      
      {/* Panel Header */}
      <div className="h-[53px] px-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-[var(--foreground)]">
          <Sparkles size={13} className="text-[var(--accent)] animate-pulse" />
          <span>AI Co-Writer</span>
        </div>
        <button
          onClick={onClose}
          className="text-sm opacity-55 hover:opacity-100 font-bold p-1"
          title="Close Sidebar (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasActiveProvider ? (
          /* Empty State: No configured provider */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 my-auto">
            <div className="p-3 rounded-full bg-[var(--border)]/30 text-[var(--foreground)] opacity-60">
              <Bot size={28} />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-semibold text-xs text-[var(--foreground)]">AI Connection Required</h4>
              <p className="text-[10px] opacity-60 leading-normal">
                To use the AI Co-Writer sidebar, configure an AI provider credentials file in your preferences.
              </p>
            </div>
            <button
              onClick={onOpenPreferences}
              className="w-full py-2 px-3 border border-[var(--border)] hover:bg-[var(--border)]/40 transition-all font-semibold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer bg-white dark:bg-[#1a1a19]"
            >
              <Settings size={13} />
              Open Workspace Preferences
            </button>
          </div>
        ) : (
          /* Active State: Co-Writer placeholder tools */
          <div className="space-y-4 animate-fade-in">
            {/* Active Provider Pill */}
            <div className="p-3 bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[9px] uppercase tracking-wider opacity-60">Active Provider</span>
                <span className="font-bold text-xs">{getProviderName(activeProviderId!)}</span>
                {activeModel && (
                  <span className="text-[9px] font-mono opacity-50 truncate max-w-[12rem]">{activeModel}</span>
                )}
              </div>
              <button
                onClick={onOpenPreferences}
                className="p-1.5 hover:bg-[var(--border)]/40 rounded transition-colors"
                title="Workspace Preferences"
              >
                <Settings size={13} />
              </button>
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* Capability Options Placeholders */}
            <div className="space-y-2">
              <div className="font-semibold text-[10px] uppercase tracking-widest opacity-60 mb-1">Capabilities</div>

              <div className="p-3 border border-[var(--border)] rounded bg-white/40 dark:bg-black/10 hover:border-[var(--accent)] transition-all cursor-pointer flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <BookOpen size={15} className="opacity-60 group-hover:text-[var(--accent)]" />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold">Find Bible Items</span>
                    <span className="text-[9px] opacity-50">Scan chapter for entity matches</span>
                  </div>
                </div>
                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent)]" />
              </div>

              <div className="p-3 border border-[var(--border)] rounded bg-white/40 dark:bg-black/10 hover:border-[var(--accent)] transition-all cursor-pointer flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <Search size={15} className="opacity-60 group-hover:text-[var(--accent)]" />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold">Summarise Chapter</span>
                    <span className="text-[9px] opacity-50">Generate draft synopsis card</span>
                  </div>
                </div>
                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent)]" />
              </div>
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* Q&A Chat Input */}
            <div className="space-y-2">
              <label className="block font-semibold text-[10px] uppercase tracking-widest opacity-60">Manuscript Q&A</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask a question about your draft..."
                  className="w-full px-3 py-2 border border-[var(--border)] bg-transparent focus:outline-none focus:border-[var(--accent)] text-xs text-[var(--foreground)]"
                  disabled
                />
                <div className="text-[8px] opacity-45 mt-1 font-semibold italic">Chat is locked at Level {workspaceAI.level}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--sidebar-bg)] shrink-0 flex items-center justify-between text-[9px] opacity-50 select-none">
        <span>Workspace Level: L{workspaceAI.level}</span>
        <span className="flex items-center gap-0.5">
          <HelpCircle size={10} />
          Antigravity v0.3
        </span>
      </div>

    </div>
  );
}
