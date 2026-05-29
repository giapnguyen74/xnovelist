/**
 * The combined Test + Choose pane that lives inside each provider card.
 *
 * Flow: pick a tier, pick or type a model id, optionally tweak the prompt,
 * click Send, see the prompt-and-reply trace from the actual provider.
 * If the writer likes the result, "Save as <tier> model" persists the choice.
 *
 * This is also the only place models are picked — there is no separate
 * defaultModel picker. Pick → test → save in one pane.
 */

import React, { useEffect, useState } from 'react';
import { Send, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { ProviderId } from '../storage/aiConfig';
import { testConnection, TestResult } from '../engine/testConnection';

type Tier = 'default' | 'fast';

interface ModelTestPaneProps {
  providerId: ProviderId;
  /** The saved provider config — used as the auth source for test calls and
   *  to read currently-saved defaultModel / fastModel. */
  providerConfig: Record<string, unknown>;
  /** Curated model id suggestions per tier for this provider. */
  suggestions: { defaults: string[]; fast: string[] };
  /** Optional additional ids to merge into the suggestions (e.g. fetched
   *  live from OpenRouter's /models or a Local AI server's /models). */
  extraSuggestions?: string[];
  /** Persists the chosen model into the provider config. */
  onSaveModel: (tier: Tier, modelId: string) => void;
}

export default function ModelTestPane({
  providerId,
  providerConfig,
  suggestions,
  extraSuggestions = [],
  onSaveModel,
}: ModelTestPaneProps) {
  const savedDefault = (providerConfig.defaultModel as string | undefined) || '';
  const savedFast = (providerConfig.fastModel as string | undefined) || '';

  const [tier, setTier] = useState<Tier>('default');
  const [modelId, setModelId] = useState<string>(savedDefault || suggestions.defaults[0] || '');
  const [prompt, setPrompt] = useState<string>('ping');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  // Switching tiers loads that tier's saved value into the model input — so
  // the writer can either iterate on the existing choice or pick a fresh one.
  useEffect(() => {
    const seed = tier === 'default' ? savedDefault : savedFast;
    if (seed) {
      setModelId(seed);
    } else {
      const tierSuggestions = tier === 'default' ? suggestions.defaults : suggestions.fast;
      if (tierSuggestions.length > 0) setModelId(tierSuggestions[0]);
    }
    setResult(null);
    // Intentionally only on tier change — typing into the input should not
    // be undone by a re-derivation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  const handleSend = async () => {
    if (!modelId.trim()) return;
    setTesting(true);
    setResult(null);
    try {
      const r = await testConnection(providerId, providerConfig, {
        modelId: modelId.trim(),
        userPrompt: prompt,
      });
      setResult(r);
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message || String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!modelId.trim()) return;
    onSaveModel(tier, modelId.trim());
  };

  // Combined list for the datalist. Curated tier-specific suggestions first,
  // then provider-supplied extras (de-duplicated).
  const datalistId = `models-${providerId}-${tier}`;
  const tierSuggestions = tier === 'default' ? suggestions.defaults : suggestions.fast;
  const combinedOptions = Array.from(new Set([...tierSuggestions, ...extraSuggestions]));

  const isModelSavedToTier =
    modelId.trim() === (tier === 'default' ? savedDefault : savedFast);

  return (
    <div className="border border-[var(--border)] rounded p-3 bg-[var(--background)]/40 space-y-3">
      <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest opacity-65">
        <Sparkles size={11} className="text-[var(--accent)]" />
        <span>Test &amp; Choose Model</span>
      </div>

      {/* Saved models summary */}
      <div className="text-[10px] grid grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-0.5 bg-[var(--sidebar-bg)]/40 border border-[var(--border)] px-2 py-1.5 rounded">
          <span className="opacity-55 text-[8px] uppercase font-bold tracking-wider">Saved Default</span>
          <span className="font-mono truncate" title={savedDefault}>{savedDefault || '(none)'}</span>
        </div>
        <div className="flex flex-col gap-0.5 bg-[var(--sidebar-bg)]/40 border border-[var(--border)] px-2 py-1.5 rounded">
          <span className="opacity-55 text-[8px] uppercase font-bold tracking-wider">Saved Fast</span>
          <span className="font-mono truncate" title={savedFast}>{savedFast || '(falls back to default)'}</span>
        </div>
      </div>

      {/* Tier */}
      <div className="flex items-center gap-3 text-[10px]">
        <span className="opacity-60 font-semibold">Tier:</span>
        {(['default', 'fast'] as Tier[]).map((t) => (
          <label key={t} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={tier === t}
              onChange={() => setTier(t)}
              className="accent-[var(--accent)]"
            />
            <span className="capitalize">{t}</span>
          </label>
        ))}
      </div>

      {/* Model input + suggestion datalist */}
      <div className="space-y-1">
        <label className="block text-[9px] font-bold uppercase opacity-60">Model</label>
        <input
          type="text"
          list={datalistId}
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          placeholder="Type a model id or pick a suggestion"
          className="w-full px-2.5 py-1.5 border border-[var(--border)] bg-[var(--background)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
        />
        <datalist id={datalistId}>
          {combinedOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </div>

      {/* Prompt input */}
      <div className="space-y-1">
        <label className="block text-[9px] font-bold uppercase opacity-60">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="w-full px-2.5 py-1.5 border border-[var(--border)] bg-[var(--background)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSend}
          disabled={testing || !modelId.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {testing ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
          {testing ? 'Sending...' : 'Send'}
        </button>
        <button
          onClick={handleSave}
          disabled={!modelId.trim() || isModelSavedToTier}
          title={isModelSavedToTier ? 'Already saved as this tier' : ''}
          className="px-3 py-1.5 text-[10px] font-semibold rounded border border-[var(--border)] hover:bg-[var(--border)]/40 text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isModelSavedToTier ? `Saved as ${tier}` : `Save as ${tier} model`}
        </button>
      </div>

      {/* Result */}
      {result && result.ok && (
        <div className="p-2 border border-green-500/20 bg-green-500/10 rounded space-y-1.5 text-[10px] animate-fade-in">
          <div className="flex items-center gap-1.5 text-green-700 dark:text-green-500 font-semibold">
            <CheckCircle2 size={12} className="shrink-0" />
            <span>Connected · {result.latencyMs} ms</span>
            {result.modelTested && (
              <span className="opacity-65 font-mono text-[9px] truncate">· {result.modelTested}</span>
            )}
          </div>
          <div className="font-mono text-[9px] opacity-80 border-t border-green-500/20 pt-1.5 space-y-0.5 select-text">
            {result.promptSent && (
              <div className="truncate">
                <span className="opacity-60">→ Sent:</span> &quot;{result.promptSent}&quot;
              </div>
            )}
            {result.reply && (
              <div className="truncate">
                <span className="opacity-60">← Got:</span> &quot;{result.reply}&quot;
              </div>
            )}
          </div>
        </div>
      )}

      {result && !result.ok && (
        <div className="p-2 border border-red-500/20 bg-red-500/10 rounded text-[10px] animate-fade-in space-y-1">
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500 font-semibold">
            <AlertCircle size={12} className="shrink-0" />
            <span>Connection Failed</span>
          </div>
          <div className="opacity-80 leading-normal select-text">{result.error}</div>
        </div>
      )}
    </div>
  );
}
