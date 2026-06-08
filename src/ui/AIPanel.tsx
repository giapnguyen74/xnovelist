import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Sparkles, Bot, Loader2, AlertTriangle, Check, Send, CheckCircle2, ChevronDown, FileText, TextSelect, Maximize2, Minimize2 } from 'lucide-react';
import { WorkspaceAIConfig } from '../storage/aiConfig';
import { actionsForLevel, findAction } from '../ai/registry';
import { ToolResult, ProposalResult, ToolContext } from '../ai/types';
import { findWriteOp } from '../ai/writeOps/registry';
import { Project } from '../storage/schemas';


export interface TranscriptCard {
  op: string;
  args: Record<string, unknown>;
  status: 'pending' | 'applied' | 'discarded';
  title: string;
  preview: string;
  kind: 'addition' | 'update' | 'edit';
  error?: string;
  loading?: boolean;
}

export interface TranscriptTurn {
  id: string;
  actionId: string;
  actionLabel: string;
  scope: 'chapter' | 'selection';
  scopeLabel?: string;
  model: string;
  guidance?: string;
  status: 'loading' | 'success' | 'error';
  error?: string;
  reasoning?: string;
  elapsedMs?: number;
  proposalResult?: ProposalResult;
  cards?: TranscriptCard[];
  input?: unknown; // Input parameters/context saved for retries
}

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceAI: WorkspaceAIConfig;
  onOpenPreferences: () => void;
  hasProject: boolean;
  project?: Project | null;
  activeChapterMarkdown?: string;
  selectionText?: string;
  activeSelection?: { from: number; to: number; text: string; textBefore: string; textAfter: string } | null;
  activeChapterId?: string;
  /** Runs an action through the runTool dispatcher. */
  runTool: (
    actionId: string,
    input: unknown,
    modelOverride?: { providerId?: string; model?: string }
  ) => Promise<ToolResult<ProposalResult>>;
  /** Executes a write-op on the project. */
  onExecuteWriteOp: (opId: string, args: unknown) => Promise<void>;
  transcript: TranscriptTurn[];
  setTranscript: React.Dispatch<React.SetStateAction<TranscriptTurn[]>>;
  selectedActionId?: string;
  onSelectActionId?: (id: string) => void;
  activeBeatId?: string | null;
  activeBeatData?: { type: string; length: number; intent: string; mode?: 'write_beat' | 'continue' } | null;
  getBeatSurroundingText?: (beatId: string) => { beforeText: string; afterText: string } | null;
}

const getArgString = (args: Record<string, unknown>, key: string): string => {
  return (args[key] as string) || '';
};

const getNestedArgString = (args: Record<string, unknown>, parentKey: string, key: string): string => {
  const parent = args[parentKey] as Record<string, unknown> | undefined;
  return (parent?.[key] as string) || '';
};

export default function AIPanel({
  isOpen,
  onClose,
  workspaceAI,
  onOpenPreferences,
  hasProject,
  project,
  activeChapterMarkdown,
  selectionText,
  activeSelection,
  activeChapterId,
  runTool,
  onExecuteWriteOp,
  transcript,
  setTranscript,
  selectedActionId: propSelectedActionId,
  onSelectActionId,
  activeBeatId,
  activeBeatData,
  getBeatSurroundingText,
}: AIPanelProps) {
  const [scope, setScope] = useState<'chapter' | 'selection'>('chapter');
  const [localSelectedActionId, setLocalSelectedActionId] = useState<string>('');
  
  const selectedActionId = propSelectedActionId !== undefined ? propSelectedActionId : localSelectedActionId;
  const setSelectedActionId = onSelectActionId !== undefined ? onSelectActionId : setLocalSelectedActionId;

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [guidance, setGuidance] = useState<string>('');
  const [params, setParams] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [guidanceExpanded, setGuidanceExpanded] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Sync guidance and params ONLY when activeBeatId changes (selecting a different beat)
  const prevBeatIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (activeBeatId !== prevBeatIdRef.current) {
      prevBeatIdRef.current = activeBeatId;
      if (activeBeatId) {
        if (activeBeatData) {
          setGuidance(activeBeatData.intent || '');
          setParams({
            type: activeBeatData.type || 'action',
            length: String(activeBeatData.length || '400'),
          });
        } else {
          setGuidance('');
          setParams({
            type: 'action',
            length: '400',
          });
        }
      } else {
        // Beat deselected — reset to blank
        setGuidance('');
        setParams({});
      }
      setGuidanceExpanded(false);
    }
  }, [activeBeatId, activeBeatData]);

  // Force scope to selection when a beat action is selected
  useEffect(() => {
    if (selectedActionId === 'write_beat' || selectedActionId === 'continue') {
      setScope('selection');
    }
  }, [selectedActionId]);

  const handleGuidanceChange = (val: string) => {
    setGuidance(val);
  };

  const handleParamChange = (name: string, val: string | number) => {
    setParams((prev) => ({ ...prev, [name]: val }));
  };

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (transcript.length > 0) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  // Set default scope based on selectionText presence — only large selections switch to AI selection mode
  useEffect(() => {
    if (selectionText && selectionText.trim()) {
      setScope('selection');
    } else {
      setScope('chapter');
    }
  }, [selectionText]);

  // Get configured models list
  const modelsList = useMemo(() => {
    const list: Array<{ id: string; providerId: string; name: string }> = [];
    const providers = workspaceAI.providers;
    if (providers.openai?.apiKey) {
      list.push({ id: providers.openai.defaultModel || 'gpt-4o-mini', providerId: 'openai', name: `OpenAI: ${providers.openai.defaultModel || 'gpt-4o-mini'}` });
    }
    if (providers.anthropic?.apiKey) {
      list.push({ id: providers.anthropic.defaultModel || 'claude-3-5-haiku-20241022', providerId: 'anthropic', name: `Claude: ${providers.anthropic.defaultModel || 'claude-3-5-haiku-20241022'}` });
    }
    if (providers.openrouter?.apiKey) {
      list.push({ id: providers.openrouter.defaultModel || 'google/gemini-2.5-flash', providerId: 'openrouter', name: `OpenRouter: ${providers.openrouter.defaultModel || 'google/gemini-2.5-flash'}` });
    }
    if (providers.local?.baseUrl) {
      list.push({ id: providers.local.defaultModel, providerId: 'local', name: `Local: ${providers.local.defaultModel}` });
    }
    return list;
  }, [workspaceAI]);

  // Set default selected model
  useEffect(() => {
    if (modelsList.length > 0 && !selectedModel) {
      setSelectedModel(modelsList[0].id);
    }
  }, [modelsList, selectedModel]);

  // Filter actions based on scope and active workspace level
  // When a beat caret is selected, only show the beat actions (write_beat and continue).
  // Otherwise, show actions matching the active scope (chapter/selection).
  const actions = useMemo(() => {
    return actionsForLevel(workspaceAI.level).filter((a) => {
      if (activeBeatId) {
        return a.id === 'write_beat' || a.id === 'continue';
      }
      if (a.id === 'write_beat' || a.id === 'continue') {
        return false;
      }
      return a.scope === scope;
    });
  }, [workspaceAI.level, scope, activeBeatId]);

  // Set default selected action
  useEffect(() => {
    if (actions.length > 0) {
      const exists = actions.some((a) => a.id === selectedActionId);
      if (!exists) {
        setSelectedActionId(actions[0].id);
      }
    } else {
      setSelectedActionId('');
    }
  }, [actions, selectedActionId, setSelectedActionId]);

  const selectedAction = useMemo(() => findAction(selectedActionId), [selectedActionId]);

  // Params depend on the chosen action — reset to that action's defaults whenever
  // the action changes.
  useEffect(() => {
    const next: Record<string, string | number> = {};
    (selectedAction?.params || []).forEach((p) => {
      if (p.default !== undefined) next[p.name] = p.default;
      else if (p.type === 'choice' && p.choices?.length) next[p.name] = p.choices[0];
      else if (p.type === 'number') next[p.name] = 0;
      else next[p.name] = '';
    });
    setParams(next);
  }, [selectedAction]);

  const hasReadyProvider = modelsList.length > 0;

  const getSelectionLineRange = () => {
    if (!selectionText || !activeChapterMarkdown) return '';
    const index = activeChapterMarkdown.indexOf(selectionText);
    if (index === -1) return '';
    const before = activeChapterMarkdown.slice(0, index);
    const startLine = before.split('\n').length;
    const linesCount = selectionText.split('\n').length;
    const endLine = startLine + linesCount - 1;
    return `#L${startLine}${endLine > startLine ? `–${endLine}` : ''}`;
  };

  const getChapterLabel = () => {
    if (!project || !activeChapterId) return '';
    const idx = (project.chapterOrder as string[] || []).indexOf(activeChapterId);
    return `ch${idx !== -1 ? idx + 1 : ''}`;
  };

  const currentSelectionLabel = () => {
    if (scope === 'chapter') return getChapterLabel();
    const range = getSelectionLineRange();
    return `${getChapterLabel()}${range ? ` ${range}` : ''}`.trim() || 'Selection';
  };

  if (!isOpen) return null;

  async function handleRetry(turn: TranscriptTurn) {
    if (submitting) return;
    setSubmitting(true);

    // Update existing turn to loading status
    updateTurn(turn.id, {
      status: 'loading',
      error: undefined,
      proposalResult: undefined,
      cards: undefined,
    });

    try {
      const chosen = modelsList.find((m) => m.id === turn.model);
      const modelOverride = chosen ? { providerId: chosen.providerId, model: chosen.id } : undefined;
      const t0 = Date.now();
      const res = await runTool(turn.actionId, turn.input, modelOverride);
      const elapsedMs = Date.now() - t0;

      if (!res.ok) {
        updateTurn(turn.id, {
          status: 'error',
          error: res.error || 'AI returned an error.',
          reasoning: res.reasoning,
          elapsedMs,
        });
        return;
      }

      const proposalResult = res.output;
      if (!proposalResult) {
        updateTurn(turn.id, {
          status: 'error',
          error: 'Action returned no results.',
        });
        return;
      }

      const mockContext = {
        prefix: `projects/${project?.id}/`,
        project: project,
      } as unknown as ToolContext;

      let cards: TranscriptCard[] = [];
      if (proposalResult.type === 'proposals') {
        cards = proposalResult.list.map((prop) => {
          const op = findWriteOp(prop.op);
          const desc = op
            ? op.describe(prop.args, mockContext)
            : { title: prop.op, preview: JSON.stringify(prop.args), kind: 'edit' as const };
          return {
            op: prop.op,
            args: (prop.args || {}) as Record<string, unknown>,
            status: 'pending' as const,
            title: desc.title,
            preview: desc.preview,
            kind: desc.kind,
          };
        });
      } else if (proposalResult.type === 'text' && proposalResult.suggestedOp) {
        const prop = proposalResult.suggestedOp;
        const op = findWriteOp(prop.op);
        const desc = op
          ? op.describe(prop.args, mockContext)
          : { title: prop.op, preview: JSON.stringify(prop.args), kind: 'edit' as const };
        cards = [{
          op: prop.op,
          args: (prop.args || {}) as Record<string, unknown>,
          status: 'pending' as const,
          title: desc.title,
          preview: desc.preview,
          kind: desc.kind,
        }];
      }

      updateTurn(turn.id, {
        status: 'success',
        proposalResult,
        cards,
        reasoning: res.reasoning,
        elapsedMs,
      });

    } catch (err) {
      const e = err as Error;
      updateTurn(turn.id, {
        status: 'error',
        error: e?.message || String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSend() {
    if (!selectedActionId || submitting) return;
    const action = findAction(selectedActionId);
    if (!action) return;

    const chapterId = activeChapterId || '';
    let input: any;
    if (selectedActionId === 'write_beat' || selectedActionId === 'continue') {
      if (!activeBeatId) {
        alert('Please click on a beat anchor in the editor first to select it.');
        return;
      }
      const surrounding = getBeatSurroundingText?.(activeBeatId);
      if (!surrounding) {
        alert('Could not find surrounding context for the active beat.');
        return;
      }
      input = {
        chapterId,
        beatId: activeBeatId,
        beforeText: surrounding.beforeText,
        afterText: surrounding.afterText,
        hint: guidance.trim() || undefined,
        params,
      };
    } else {
      const proseText = scope === 'selection' ? (selectionText || '') : (activeChapterMarkdown || '');
      input = {
        selection: scope === 'selection' && activeSelection ? {
          text: activeSelection.text,
          from: activeSelection.from,
          to: activeSelection.to,
          textBefore: activeSelection.textBefore,
          textAfter: activeSelection.textAfter,
        } : { text: proseText },
        chapterId,
        params,
        hint: guidance.trim() || undefined,
        guidance: guidance.trim() || undefined,
      };
    }

    setSubmitting(true);
    const turnId = `turn-${Date.now()}`;
    const newTurn: TranscriptTurn = {
      id: turnId,
      actionId: selectedActionId,
      actionLabel: action.label,
      scope,
      scopeLabel: currentSelectionLabel(),
      model: selectedModel,
      guidance: guidance.trim() || undefined,
      status: 'loading',
      input,
    };

    setTranscript((prev) => [...prev, newTurn]);
    if (selectedActionId !== 'write_beat' && selectedActionId !== 'continue') {
      setGuidance('');
      setGuidanceExpanded(false);
    }

    try {
      const chosen = modelsList.find((m) => m.id === selectedModel);
      const modelOverride = chosen ? { providerId: chosen.providerId, model: chosen.id } : undefined;
      const t0 = Date.now();
      const res = await runTool(selectedActionId, input, modelOverride);
      const elapsedMs = Date.now() - t0;

      if (!res.ok) {
        updateTurn(turnId, {
          status: 'error',
          error: res.error || 'AI returned an error.',
          reasoning: res.reasoning,
          elapsedMs,
        });
        return;
      }

      const proposalResult = res.output;
      if (!proposalResult) {
        updateTurn(turnId, {
          status: 'error',
          error: 'Action returned no results.',
        });
        return;
      }

      // Context mock to describe proposal title/preview
      const mockContext = {
        prefix: `projects/${project?.id}/`,
        project: project,
      } as unknown as ToolContext;

      let cards: TranscriptCard[] = [];
      if (proposalResult.type === 'proposals') {
        cards = proposalResult.list.map((prop) => {
          const op = findWriteOp(prop.op);
          const desc = op
            ? op.describe(prop.args, mockContext)
            : { title: prop.op, preview: JSON.stringify(prop.args), kind: 'edit' as const };
          return {
            op: prop.op,
            args: (prop.args || {}) as Record<string, unknown>,
            status: 'pending' as const,
            title: desc.title,
            preview: desc.preview,
            kind: desc.kind,
          };
        });
      } else if (proposalResult.type === 'text' && proposalResult.suggestedOp) {
        const prop = proposalResult.suggestedOp;
        const op = findWriteOp(prop.op);
        const desc = op
          ? op.describe(prop.args, mockContext)
          : { title: prop.op, preview: JSON.stringify(prop.args), kind: 'edit' as const };
        cards = [{
          op: prop.op,
          args: (prop.args || {}) as Record<string, unknown>,
          status: 'pending' as const,
          title: desc.title,
          preview: desc.preview,
          kind: desc.kind,
        }];
      }

      updateTurn(turnId, {
        status: 'success',
        proposalResult,
        cards,
        reasoning: res.reasoning,
        elapsedMs,
      });

    } catch (err) {
      const e = err as Error;
      updateTurn(turnId, {
        status: 'error',
        error: e?.message || String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  function updateTurn(turnId: string, updates: Partial<TranscriptTurn>) {
    setTranscript((prev) =>
      prev.map((t) => (t.id === turnId ? { ...t, ...updates } : t))
    );
  }

  function updateCardArgs(turnId: string, cardIdx: number, field: string, value: unknown) {
    setTranscript((prev) =>
      prev.map((t) => {
        if (t.id !== turnId || !t.cards) return t;
        const newCards = [...t.cards];
        const c = newCards[cardIdx];
        newCards[cardIdx] = {
          ...c,
          args: {
            ...c.args,
            [field]: value,
          },
        };
        return { ...t, cards: newCards };
      })
    );
  }

  function updateCardNestedArgs(turnId: string, cardIdx: number, parent: string, field: string, value: unknown) {
    setTranscript((prev) =>
      prev.map((t) => {
        if (t.id !== turnId || !t.cards) return t;
        const newCards = [...t.cards];
        const c = newCards[cardIdx];
        const parentObj = { ...((c.args[parent] as Record<string, unknown>) || {}) };
        parentObj[field] = value;
        newCards[cardIdx] = {
          ...c,
          args: {
            ...c.args,
            [parent]: parentObj,
          },
        };
        return { ...t, cards: newCards };
      })
    );
  }

  async function handleAcceptCard(turnId: string, cardIdx: number, card: TranscriptCard) {
    setTranscript((prev) =>
      prev.map((t) => {
        if (t.id !== turnId || !t.cards) return t;
        const newCards = [...t.cards];
        newCards[cardIdx] = { ...newCards[cardIdx], loading: true, error: undefined };
        return { ...t, cards: newCards };
      })
    );

    try {
      await onExecuteWriteOp(card.op, card.args);
      setTranscript((prev) =>
        prev.map((t) => {
          if (t.id !== turnId || !t.cards) return t;
          const newCards = [...t.cards];
          newCards[cardIdx] = { ...newCards[cardIdx], status: 'applied', loading: false };
          return { ...t, cards: newCards };
        })
      );
    } catch (err) {
      const e = err as Error;
      setTranscript((prev) =>
        prev.map((t) => {
          if (t.id !== turnId || !t.cards) return t;
          const newCards = [...t.cards];
          newCards[cardIdx] = {
            ...newCards[cardIdx],
            loading: false,
            error: e?.message || 'Apply failed.',
          };
          return { ...t, cards: newCards };
        })
      );
    }
  }

  function handleRejectCard(turnId: string, cardIdx: number) {
    setTranscript((prev) =>
      prev.map((t) => {
        if (t.id !== turnId || !t.cards) return t;
        const newCards = [...t.cards];
        newCards[cardIdx] = { ...newCards[cardIdx], status: 'discarded' };
        return { ...t, cards: newCards };
      })
    );
  }

  return (
    <div className="w-80 h-full border-l border-[var(--border)] bg-[var(--sidebar-bg)] select-none flex flex-col text-xs text-[var(--foreground)] animate-slide-in relative z-30 shrink-0">
      {/* Header */}
      <div className="h-[53px] px-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest">
          <Sparkles size={13} className="text-[var(--accent)]" />
          <span>Agent Panel</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebug((v) => !v)}
            className={`uppercase tracking-wider font-semibold text-[8px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
              showDebug ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'opacity-40 hover:opacity-70 hover:bg-[var(--border)]/40'
            }`}
            title="Show model reasoning when available"
          >
            Debug
          </button>
          <button onClick={onClose} className="text-sm opacity-55 hover:opacity-100 font-bold p-1" title="Close (Esc)">
            ✕
          </button>
        </div>
      </div>

      {/* Main Panel Content: Split into Transcript (top-scrollable) and Composer (bottom-sticky) */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Scrollable Transcript Feed */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {transcript.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-40 space-y-2">
              <Bot size={28} className="stroke-[1.5]" />
              <div className="text-[10px]">
                No actions run yet. Select an action below and click Send to get proposals.
              </div>
            </div>
          ) : (
            transcript.map((t) => (
              <div key={t.id} className="space-y-2 border-b border-[var(--border)]/30 pb-4 last:border-0 last:pb-0">
                {/* Request Summary */}
                <div className="flex items-start justify-between gap-1 text-[9px] bg-[var(--border)]/20 p-2 rounded text-[var(--foreground)]/70">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-[10px] text-[var(--foreground)]">{t.actionLabel}</div>
                    <div className="opacity-60 font-mono text-[8px]">
                      Scope: {t.scopeLabel} · Model: {t.model}
                    </div>
                    {t.guidance && (
                      <div className="text-[9px] italic text-[var(--foreground)]/80 mt-1 pl-1.5 border-l border-[var(--accent)]/50">
                        &ldquo;{t.guidance}&rdquo;
                      </div>
                    )}
                  </div>
                  {t.elapsedMs !== undefined && (
                    <span
                      className="shrink-0 font-mono text-[8px] px-1 py-0.5 rounded bg-[var(--border)]/30 opacity-70 tabular-nums"
                      title="Wall-clock time for the LLM response"
                    >
                      {t.elapsedMs < 1000
                        ? `${t.elapsedMs}ms`
                        : `${(t.elapsedMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </div>

                {/* Debug: model thinking (reasoning models) */}
                {showDebug && t.reasoning && (
                  <details className="text-[9px] bg-amber-500/5 border border-amber-500/20 rounded p-1.5" open>
                    <summary className="cursor-pointer font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[8px]">
                      Model thinking
                    </summary>
                    <pre className="whitespace-pre-wrap font-mono text-[9px] opacity-70 mt-1 max-h-40 overflow-y-auto select-text">
                      {t.reasoning}
                    </pre>
                  </details>
                )}

                {/* State Renderers */}
                {t.status === 'loading' && (
                  <div className="p-3 flex items-center justify-center gap-2 opacity-60">
                    <Loader2 size={13} className="animate-spin text-[var(--accent)]" />
                    <span className="text-[10px] animate-pulse">Running proposer...</span>
                  </div>
                )}

                {t.status === 'error' && (
                  <div className="space-y-2">
                    <div className="p-3 border border-red-500/20 bg-red-500/5 rounded text-[10px] text-red-600 dark:text-red-400 flex items-start gap-1.5 leading-normal">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>{t.error}</span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        disabled={submitting}
                        onClick={() => handleRetry(t)}
                        className="px-2 py-1 text-[9px] border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer transition-colors text-amber-600 dark:text-amber-400"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {t.status === 'success' && t.proposalResult && (
                  <div className="space-y-2 pl-1 border-l border-[var(--border)]">
                    {/* Empty proposals notice */}
                    {t.proposalResult.type === 'proposals' && (t.cards?.length ?? 0) === 0 && (
                      <div className="p-2 bg-black/5 dark:bg-white/5 text-[10px] opacity-60 rounded flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={12} /> No proposals from this passage.
                        </div>
                        <button
                          disabled={submitting}
                          onClick={() => handleRetry(t)}
                          className="px-2 py-0.5 text-[9px] border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer transition-colors text-amber-600 dark:text-amber-400 font-semibold"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Render Text Card */}
                    {t.proposalResult.type === 'text' && (
                      <div className="space-y-2">
                        <pre className="whitespace-pre-wrap font-sans text-[10px] leading-relaxed bg-white/50 dark:bg-black/20 p-2.5 rounded border border-[var(--border)] select-text">
                          {t.proposalResult.text}
                        </pre>
                      </div>
                    )}

                    {/* Render Report Card */}
                    {t.proposalResult.type === 'report' && (
                      <div className="space-y-2">
                        <div className="font-bold text-[9px] uppercase tracking-wider opacity-60">Continuity Flags</div>
                        {t.proposalResult.items.length === 0 ? (
                          <div className="p-2 bg-green-500/5 text-green-700 dark:text-green-400 text-[10px] rounded flex items-center gap-1.5">
                            <CheckCircle2 size={12} /> No contradictions found.
                          </div>
                        ) : (
                          t.proposalResult.items.map((item, idx) => (
                            <div key={idx} className="p-2 border border-[var(--border)] rounded bg-white/30 dark:bg-black/10 space-y-1 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className={`text-[8px] font-bold uppercase px-1 rounded ${
                                  item.severity === 'high' ? 'bg-red-500/20 text-red-700 dark:text-red-300' :
                                  item.severity === 'medium' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                                  'bg-gray-500/20 text-gray-700 dark:text-gray-300'
                                }`}>
                                  {item.severity} severity
                                </span>
                              </div>
                              <div className="font-medium text-[var(--foreground)]">{item.statement}</div>
                              <div className="opacity-60 italic pl-2 border-l border-[var(--border)]">
                                ⚠ Established fact: {item.conflict}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Render Write-Op Cards */}
                    {t.cards && t.cards.map((card, cardIdx) => (
                      <div
                        key={cardIdx}
                        className={`border rounded p-2.5 transition-all space-y-2 ${
                          card.status === 'applied' ? 'border-green-500/30 bg-green-500/5' :
                          card.status === 'discarded' ? 'border-[var(--border)] opacity-40 bg-black/5 dark:bg-white/5' :
                          'border-[var(--accent)]/30 bg-white/40 dark:bg-[#1e1e1d]/30 hover:border-[var(--accent)]/60'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-semibold text-[10px] text-[var(--foreground)]">{card.title}</div>
                          <span className="text-[7px] font-bold uppercase tracking-wider bg-[var(--border)] px-1 rounded opacity-60">
                            {card.op}
                          </span>
                        </div>

                        {/* Inline Editable Fields */}
                        {card.status === 'pending' && (
                          <div className="space-y-2 border-t border-[var(--border)]/40 pt-2 text-[10px]">
                            {/* character_add editor */}
                            {card.op === 'character_add' && (
                              <div className="space-y-1.5">
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Character Name</label>
                                <input
                                  type="text"
                                  value={getArgString(card.args, 'name')}
                                  onChange={(e) => updateCardArgs(t.id, cardIdx, 'name', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px]"
                                />
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Role</label>
                                <input
                                  type="text"
                                  value={getArgString(card.args, 'role')}
                                  onChange={(e) => updateCardArgs(t.id, cardIdx, 'role', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px]"
                                />
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Notes</label>
                                <textarea
                                  value={getArgString(card.args, 'notes')}
                                  rows={2}
                                  onChange={(e) => updateCardArgs(t.id, cardIdx, 'notes', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px] resize-none"
                                />
                              </div>
                            )}

                            {/* character_update editor */}
                            {card.op === 'character_update' && (
                              <div className="space-y-1.5">
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Role changes</label>
                                <input
                                  type="text"
                                  value={getNestedArgString(card.args, 'changes', 'role')}
                                  onChange={(e) => updateCardNestedArgs(t.id, cardIdx, 'changes', 'role', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px]"
                                />
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Notes changes</label>
                                <textarea
                                  value={getNestedArgString(card.args, 'changes', 'notes')}
                                  rows={2}
                                  onChange={(e) => updateCardNestedArgs(t.id, cardIdx, 'changes', 'notes', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px] resize-none"
                                />
                              </div>
                            )}

                            {/* location_add editor */}
                            {card.op === 'location_add' && (
                              <div className="space-y-1.5">
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Location Name</label>
                                <input
                                  type="text"
                                  value={getArgString(card.args, 'name')}
                                  onChange={(e) => updateCardArgs(t.id, cardIdx, 'name', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px]"
                                />
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Significance</label>
                                <textarea
                                  value={getArgString(card.args, 'significance')}
                                  rows={2}
                                  onChange={(e) => updateCardArgs(t.id, cardIdx, 'significance', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px] resize-none"
                                />
                              </div>
                            )}

                            {/* location_update editor */}
                            {card.op === 'location_update' && (
                              <div className="space-y-1.5">
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Significance changes</label>
                                <textarea
                                  value={getNestedArgString(card.args, 'changes', 'significance')}
                                  rows={2}
                                  onChange={(e) => updateCardNestedArgs(t.id, cardIdx, 'changes', 'significance', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px] resize-none"
                                />
                              </div>
                            )}

                            {/* style_set editor */}
                            {card.op === 'style_set' && (
                              <div className="space-y-1.5">
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Value</label>
                                <textarea
                                  value={getArgString(card.args, 'value')}
                                  rows={2}
                                  onChange={(e) => updateCardArgs(t.id, cardIdx, 'value', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px] resize-none"
                                />
                              </div>
                            )}

                            {/* append_continuity editor */}
                            {card.op === 'append_continuity' && (
                              <div className="space-y-1.5">
                                <label className="text-[8px] uppercase tracking-wider opacity-60 font-bold">Text to append</label>
                                <textarea
                                  value={getArgString(card.args, 'text')}
                                  rows={3}
                                  onChange={(e) => updateCardArgs(t.id, cardIdx, 'text', e.target.value)}
                                  className="w-full p-1 bg-white dark:bg-black/20 border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-[10px] resize-none"
                                />
                              </div>
                            )}

                            {/* replace_range editor — editable AI suggestion (original stays visible in the editor) */}
                            {card.op === 'replace_range' && (
                              <div className="space-y-1.5">
                                <label className="text-[8px] uppercase tracking-wider text-[var(--accent)] font-bold">AI suggestion</label>
                                <textarea
                                  value={getArgString(card.args, 'text')}
                                  rows={6}
                                  onChange={(e) => updateCardArgs(t.id, cardIdx, 'text', e.target.value)}
                                  className="w-full p-2 bg-white dark:bg-black/20 border border-[var(--accent)]/40 rounded focus:outline-none focus:border-[var(--accent)] text-xs font-serif leading-relaxed"
                                />
                              </div>
                            )}

                            {/* insert_beat editor — editable AI suggestion */}
                            {card.op === 'insert_beat' && (
                              <div className="space-y-1.5">
                                <label className="text-[8px] uppercase tracking-wider text-[var(--accent)] font-bold">AI suggestion</label>
                                <textarea
                                  value={getArgString(card.args, 'text')}
                                  rows={6}
                                  onChange={(e) => updateCardArgs(t.id, cardIdx, 'text', e.target.value)}
                                  className="w-full p-2 bg-white dark:bg-black/20 border border-[var(--accent)]/40 rounded focus:outline-none focus:border-[var(--accent)] text-xs font-serif leading-relaxed"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Readonly preview when applied/discarded */}
                        {card.status !== 'pending' && (
                          <div className="text-[10px] opacity-60 leading-snug truncate">
                            {card.op === 'insert_beat' || card.op === 'replace_range' ? (card.args.text as string) : card.preview}
                          </div>
                        )}

                        {/* Card Error message */}
                        {card.error && (
                          <div className="text-[9px] text-red-600 dark:text-red-400 font-medium leading-normal pl-1 border-l border-red-500">
                            Error: {card.error}
                          </div>
                        )}

                        {/* Actions bar (Accept / Reject) */}
                        <div className="flex items-center justify-between border-t border-[var(--border)]/30 pt-2 mt-2">
                          <span className="text-[9px] opacity-50 flex items-center gap-1.5">
                            {card.status === 'applied' && (
                              <>
                                <Check size={11} className="text-green-500 font-bold" />
                                <span className="text-green-600 dark:text-green-400 font-semibold uppercase text-[8px]">Applied</span>
                              </>
                            )}
                            {card.status === 'discarded' && (
                              <>
                                <span className="opacity-60 uppercase text-[8px] font-semibold">Discarded</span>
                              </>
                            )}
                            {card.status === 'pending' && 'Proposes mutation'}
                          </span>

                          {card.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <button
                                disabled={card.loading || submitting}
                                onClick={() => handleRetry(t)}
                                className="px-2 py-1 text-[9px] border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer transition-colors text-amber-600 dark:text-amber-400"
                              >
                                Retry
                              </button>
                              <button
                                disabled={card.loading}
                                onClick={() => handleRejectCard(t.id, cardIdx)}
                                className="px-2 py-1 text-[9px] border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer transition-colors"
                              >
                                {card.op === 'replace_range' ? 'Keep mine' : card.op === 'insert_beat' ? 'Discard' : 'Reject'}
                              </button>
                              <button
                                disabled={card.loading}
                                onClick={() => handleAcceptCard(t.id, cardIdx, card)}
                                className="px-2 py-1 text-[9px] font-semibold bg-[var(--accent)] text-white hover:opacity-90 rounded cursor-pointer flex items-center gap-1 transition-opacity disabled:opacity-50"
                              >
                                {card.loading && <Loader2 size={10} className="animate-spin" />}
                                {card.op === 'replace_range' ? 'Replace' : card.op === 'insert_beat' ? 'Insert' : 'Accept'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Dynamic Composer (Stick bottom) */}
        {!hasReadyProvider ? (
          <div className="p-4 border-t border-[var(--border)] bg-black/10 dark:bg-white/5 space-y-2 flex flex-col items-center justify-center text-center">
            <div className="p-2 rounded-full bg-[var(--border)] opacity-60">
              <Bot size={22} />
            </div>
            <h4 className="font-semibold text-[10px]">AI Connection Required</h4>
            <p className="text-[9px] opacity-60 leading-normal">
              Configure an AI provider in Workspace Preferences to unlock actions.
            </p>
            <button
              onClick={onOpenPreferences}
              className="w-full py-1.5 border border-[var(--border)] hover:bg-[var(--border)]/40 transition-all font-semibold text-[9px] flex items-center justify-center gap-1 cursor-pointer bg-white dark:bg-[#1a1a19]"
            >
              Configure Connections
            </button>
          </div>
        ) : !hasProject ? (
          <div className="p-4 border-t border-[var(--border)] text-center text-[10px] opacity-50 bg-black/10 dark:bg-white/5">
            Open a project to use Composer.
          </div>
        ) : actions.length === 0 ? (
          <div className="p-3 border-t border-[var(--border)] bg-black/10 dark:bg-white/5">
            <div className="p-2 border border-dashed border-[var(--border)] rounded text-[9px] opacity-60 italic text-center leading-normal">
              No actions at Level {workspaceAI.level} for {scope === 'selection' ? 'a selection' : 'the chapter'}.
              {scope === 'chapter' && ' Select text in the editor for selection actions.'}
            </div>
          </div>

        ) : (
          <div className="p-3 border-t border-[var(--border)] bg-black/10 dark:bg-white/5">
            {/* Goal box */}
            <div className="border border-[var(--border)] rounded-lg bg-white dark:bg-[#1a1a19] p-2 space-y-2">
              {/* Chips: action + context */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="relative">
                  <select
                    value={selectedActionId}
                    onChange={(e) => setSelectedActionId(e.target.value)}
                    className="appearance-none pl-2 pr-5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/25 text-[10px] font-semibold cursor-pointer focus:outline-none"
                    title="Choose action"
                  >
                    {actions.map((act) => (
                      <option key={act.id} value={act.id}>{act.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accent)]" />
                </div>

                <button
                  onClick={() => setScope((s) => (s === 'selection' ? 'chapter' : 'selection'))}
                  disabled={scope === 'chapter' && !selectionText?.trim()}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--border)]/40 border border-[var(--border)] text-[10px] font-mono font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:border-[var(--accent)]/50 transition-colors"
                  title={selectionText?.trim() ? 'Toggle Chapter / Selection scope' : 'Select text in the editor to scope to a selection'}
                >
                  {scope === 'selection' ? <TextSelect size={10} /> : <FileText size={10} />}
                  {currentSelectionLabel() || (scope === 'selection' ? 'Selection' : 'Chapter')}
                </button>
              </div>

              {/* Selection preview */}
              {scope === 'selection' && selectionText?.trim() && (
                <div className="text-[8px] opacity-50 truncate italic px-0.5">
                  &ldquo;{selectionText.slice(0, 60)}{selectionText.length > 60 ? '…' : ''}&rdquo;
                </div>
              )}

              {/* Guidance / goal text */}
              <div className="relative w-full">
                <textarea
                  value={guidance}
                  disabled={submitting}
                  onChange={(e) => handleGuidanceChange(e.target.value)}
                  rows={guidanceExpanded ? 12 : 2}
                  placeholder={selectedAction ? `${selectedAction.description} — add guidance (optional)…` : 'Add guidance (optional)…'}
                  className="w-full p-1.5 pr-8 bg-transparent border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] text-xs resize-none"
                />
                <button
                  type="button"
                  onClick={() => setGuidanceExpanded(!guidanceExpanded)}
                  className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-[var(--border)] text-[var(--foreground)] opacity-60 hover:opacity-100 transition-all cursor-pointer"
                  title={guidanceExpanded ? 'Collapse Guidance Input' : 'Expand Guidance Input'}
                >
                  {guidanceExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
              </div>

              {/* Dynamic params — depend on the chosen action */}
              {selectedAction?.params && selectedAction.params.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedAction.params.map((p) => (
                    <div key={p.name} className="flex items-center gap-1 text-[9px]">
                      <span className="opacity-60 font-semibold">{p.label}</span>
                      {p.type === 'choice' ? (
                        <select
                          value={String(params[p.name] ?? '')}
                          onChange={(e) => handleParamChange(p.name, e.target.value)}
                          className="bg-white dark:bg-[#1a1a19] border border-[var(--border)] rounded px-1 py-0.5 text-[9px] cursor-pointer focus:outline-none focus:border-[var(--accent)]"
                        >
                          {(p.choices || []).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : p.type === 'number' ? (
                        <input
                          type="number"
                          value={Number(params[p.name] ?? 0)}
                          onChange={(e) => handleParamChange(p.name, Number(e.target.value))}
                          className="w-14 bg-white dark:bg-[#1a1a19] border border-[var(--border)] rounded px-1 py-0.5 text-[9px] focus:outline-none focus:border-[var(--accent)]"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(params[p.name] ?? '')}
                          onChange={(e) => handleParamChange(p.name, e.target.value)}
                          className="w-24 bg-white dark:bg-[#1a1a19] border border-[var(--border)] rounded px-1 py-0.5 text-[9px] focus:outline-none focus:border-[var(--accent)]"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Toolbar: model + send */}
              <div className="flex items-center gap-1.5 border-t border-[var(--border)]/40 pt-2">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="flex-1 min-w-0 p-1 bg-transparent border border-[var(--border)] rounded text-[10px] cursor-pointer focus:outline-none focus:border-[var(--accent)]"
                  title="Model"
                >
                  {modelsList.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <button
                  disabled={submitting || !selectedActionId}
                  onClick={handleSend}
                  className="px-3 py-1.5 rounded bg-[var(--accent)] hover:opacity-95 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all shrink-0 text-[11px] font-semibold"
                  title="Send request"
                >
                  {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
