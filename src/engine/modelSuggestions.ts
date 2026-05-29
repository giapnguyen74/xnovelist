/**
 * Curated model id suggestions per provider, split by tier.
 *
 * The lists are intentionally short — a starter set, not an exhaustive
 * catalogue. The model inputs in the UI accept free-text, so writers who
 * want a different model (or an older snapshot, or a community fine-tune)
 * just type the id directly. These suggestions are for the "I don't know
 * which one to pick" case.
 *
 * Update strategy: when a provider releases a flagship that meaningfully
 * outclasses the current default, drop the worst entry and add the new one.
 * Don't grow the list past 6 — it's a curated guide, not a model browser.
 */

import { ProviderId } from '../storage/aiConfig';

export interface ModelSuggestionSet {
  /** Quality models — used for Capabilities the writer sees output from. */
  defaults: string[];
  /** Cheap / fast models — used for background L1 Capabilities. */
  fast: string[];
}

export const MODEL_SUGGESTIONS: Record<ProviderId, ModelSuggestionSet> = {
  // Hidden in v0.3 (see SHOW_SUBSCRIPTION_OAUTH_PROVIDERS flag) but the list
  // is kept ready for the moment OAuth ships with real registered clients.
  openai: {
    defaults: ['gpt-4o', 'gpt-4.1', 'o3'],
    fast: ['gpt-4o-mini', 'gpt-4.1-mini'],
  },
  anthropic: {
    defaults: ['claude-sonnet-4.5', 'claude-3-5-sonnet-20241022'],
    fast: ['claude-3-5-haiku-20241022'],
  },

  // The two currently-visible providers.
  openrouter: {
    defaults: [
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
      'meta-llama/llama-3.1-70b-instruct',
    ],
    fast: [
      'anthropic/claude-3.5-haiku',
      'openai/gpt-4o-mini',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.1-8b-instruct',
    ],
  },
  local: {
    // Most-common Ollama / LM Studio tags. Free-text override does most of
    // the work here — the actual id depends on what the writer has pulled.
    defaults: ['llama3.1:70b', 'qwen2.5:32b', 'mistral-large'],
    fast: ['llama3.1:8b', 'qwen2.5:7b', 'phi3.5'],
  },
};
