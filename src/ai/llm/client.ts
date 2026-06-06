import { WorkspaceAIConfig, ProviderId, OpenAIProviderConfig, AnthropicProviderConfig, OpenRouterProviderConfig, LocalAIProviderConfig } from '../../storage/aiConfig';
import { CallModel, ChatRequest, ChatResponse } from '../types';

const FALLBACK_MODELS: Record<ProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  openrouter: 'google/gemini-2.5-flash',
  local: '',
};

/** Is a provider configured enough to make a call? */
export function providerReady(config: WorkspaceAIConfig, pid: ProviderId): boolean {
  const p = config.providers[pid];
  if (!p) return false;
  if (pid === 'local') {
    const lp = p as LocalAIProviderConfig;
    return !!(lp.baseUrl && lp.defaultModel);
  }
  const ap = p as OpenAIProviderConfig | AnthropicProviderConfig | OpenRouterProviderConfig;
  return !!ap.apiKey;
}

/** Resolve which provider a call should use: the configured default, else the first ready one. */
export function resolveProvider(config: WorkspaceAIConfig): ProviderId | null {
  if (config.defaultProviderId && providerReady(config, config.defaultProviderId)) {
    return config.defaultProviderId;
  }
  return (['openai', 'anthropic', 'openrouter', 'local'] as ProviderId[]).find((pid) =>
    providerReady(config, pid)
  ) ?? null;
}

/**
 * Build a provider-agnostic `callModel` from the workspace config. The request
 * shaping mirrors `src/engine/testConnection.ts`, generalised for real prompts.
 * `preferFast` picks the provider's `fastModel` when available (used by the
 * background Level 1 tools).
 */
export function makeCallModel(config: WorkspaceAIConfig, preferFast = false): CallModel {
  return async (req: ChatRequest): Promise<ChatResponse> => {
    const pid = resolveProvider(config);
    if (!pid) {
      throw new Error('No AI provider is configured. Configure one in Settings.');
    }
    const p = config.providers[pid];
    if (!p) {
      throw new Error(`Provider config for ${pid} is missing.`);
    }
    const model =
      req.model ||
      (preferFast ? p.fastModel : undefined) ||
      p.defaultModel ||
      FALLBACK_MODELS[pid];

    let endpoint = '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: Record<string, unknown>;

    if (pid === 'anthropic') {
      const ap = p as AnthropicProviderConfig;
      endpoint = 'https://api.anthropic.com/v1/messages';
      headers['anthropic-version'] = '2023-06-01';
      // Required for direct browser calls to the Anthropic API.
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      headers['x-api-key'] = ap.apiKey;
      body = {
        model,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        temperature: req.temperature ?? 0.5,
        max_tokens: req.maxTokens ?? 2048,
      };
    } else {
      if (pid === 'local') {
        const lp = p as LocalAIProviderConfig;
        const baseUrl = (lp.baseUrl || '').trim().replace(/\/$/, '');
        endpoint = `${baseUrl}/chat/completions`;
        if (lp.apiKey) headers['Authorization'] = `Bearer ${lp.apiKey}`;
        if (lp.headers && typeof lp.headers === 'object') {
          Object.entries(lp.headers).forEach(([k, v]) => (headers[k] = String(v)));
        }
      } else if (pid === 'openrouter') {
        const op = p as OpenRouterProviderConfig;
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        headers['Authorization'] = `Bearer ${op.apiKey}`;
        headers['HTTP-Referer'] = 'https://xnovelist.app';
        headers['X-Title'] = 'xnovelist';
      } else {
        const op = p as OpenAIProviderConfig;
        endpoint = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${op.apiKey}`;
      }
      body = {
        model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        temperature: req.temperature ?? 0.5,
        max_tokens: req.maxTokens ?? 2048,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') throw new Error('AI request timed out after 120 seconds.');
      throw new Error('Could not reach the AI endpoint. Check the base URL and your network.');
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      let verbatim = '';
      try {
        const j = await response.json();
        verbatim = j?.error?.message || j?.error || JSON.stringify(j);
      } catch {
        verbatim = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(verbatim.length > 300 ? `${verbatim.slice(0, 297)}...` : verbatim);
    }

    const data = await response.json();
    let text = '';
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    if (pid === 'anthropic') {
      text = data?.content?.[0]?.text || '';
      inputTokens = data?.usage?.input_tokens;
      outputTokens = data?.usage?.output_tokens;
    } else {
      text = data?.choices?.[0]?.message?.content || '';
      inputTokens = data?.usage?.prompt_tokens;
      outputTokens = data?.usage?.completion_tokens;
    }
    return { text: text.trim(), inputTokens, outputTokens };
  };
}

/** Crude local token estimate (character-count fallback, ~3.8 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length || 0) / 3.8);
}
