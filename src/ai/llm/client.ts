import { WorkspaceAIConfig, ProviderId, OpenAIProviderConfig, AnthropicProviderConfig, OpenRouterProviderConfig, LocalAIProviderConfig } from '../../storage/aiConfig';
import { CallModel, ChatRequest, ChatResponse, DebugSink } from '../types';
import { stripThinking } from './parseJson';
import { stripBeatTokens } from '../beats';

const FALLBACK_MODELS: Record<ProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  openrouter: 'google/gemini-2.5-flash',
  local: '',
};

/**
 * We do NOT cap output for OpenAI-style providers (openai / openrouter / local):
 * `max_tokens` is omitted so the model runs to its natural stop or context
 * limit — novel generation, like a code agent, wants room. Anthropic is the one
 * exception: its API *requires* `max_tokens`, so we send this value when an
 * action doesn't specify one. It's a safe default for current Claude models;
 * a per-model ceiling (output limits differ) can refine it later.
 */
const ANTHROPIC_DEFAULT_MAX_TOKENS = 8192;

/**
 * Request timeouts (a safety net against a silently dead endpoint, not a budget).
 * Local servers can take minutes on the *first* request while the model loads
 * into memory, so they get a much longer leash than cloud providers. Override
 * per call with `req.timeoutMs`.
 */
const CLOUD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const LOCAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes — covers cold model load

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
 * background Level 1 tools). `override` lets a single call target a specific
 * provider/model — used by the Agent panel's per-request model picker.
 */
export function makeCallModel(
  config: WorkspaceAIConfig,
  preferFast = false,
  override?: { providerId?: string; model?: string },
  debug?: DebugSink
): CallModel {
  return async (req: ChatRequest): Promise<ChatResponse> => {
    const overridePid = override?.providerId as ProviderId | undefined;
    const pid =
      overridePid && providerReady(config, overridePid) ? overridePid : resolveProvider(config);
    if (!pid) {
      throw new Error('No AI provider is configured. Configure one in Settings.');
    }
    const p = config.providers[pid];
    if (!p) {
      throw new Error(`Provider config for ${pid} is missing.`);
    }
    const model =
      req.model ||
      override?.model ||
      (preferFast ? p.fastModel : undefined) ||
      p.defaultModel ||
      FALLBACK_MODELS[pid];

    const sanitizedSystem = stripBeatTokens(req.system || '');
    const sanitizedUser = stripBeatTokens(req.user || '');

    let endpoint = '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: Record<string, unknown>;

    if (pid === 'anthropic') {
      const ap = p as AnthropicProviderConfig;
      endpoint = 'https://api.anthropic.com/v1/messages';
      headers['anthropic-version'] = '2023-06-01';
      // Required for direct browser calls to the Anthropic API.
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      headers['x-api-key'] = (ap.apiKey || '').trim();
      body = {
        model,
        system: sanitizedSystem,
        messages: [{ role: 'user', content: sanitizedUser }],
        temperature: req.temperature ?? 0.5,
        // Anthropic requires max_tokens; send the action's value or the default.
        max_tokens: req.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
      };
    } else {
      if (pid === 'local') {
        const lp = p as LocalAIProviderConfig;
        const baseUrl = (lp.baseUrl || '').trim().replace(/\/$/, '');
        endpoint = `${baseUrl}/chat/completions`;
        const apiKey = (lp.apiKey || '').trim();
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        if (lp.headers && typeof lp.headers === 'object') {
          Object.entries(lp.headers).forEach(([k, v]) => (headers[k] = String(v)));
        }
      } else if (pid === 'openrouter') {
        const op = p as OpenRouterProviderConfig;
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        headers['Authorization'] = `Bearer ${(op.apiKey || '').trim()}`;
        headers['HTTP-Referer'] = 'https://xnovelist.app';
        headers['X-Title'] = 'xnovelist';
      } else {
        const op = p as OpenAIProviderConfig;
        endpoint = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${(op.apiKey || '').trim()}`;
      }
      body = {
        model,
        messages: [
          { role: 'system', content: sanitizedSystem },
          { role: 'user', content: sanitizedUser },
        ],
        temperature: req.temperature ?? 0.5,
      };
      // No artificial cap for OpenAI-style providers: omit max_tokens so the
      // model runs to its natural stop / context limit. Only sent if an action
      // explicitly requests a ceiling.
      if (req.maxTokens) body.max_tokens = req.maxTokens;
    }

    const timeoutMs = req.timeoutMs ?? (pid === 'local' ? LOCAL_TIMEOUT_MS : CLOUD_TIMEOUT_MS);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
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
      if (err instanceof Error && err.name === 'AbortError') {
        const mins = Math.round(timeoutMs / 60000);
        throw new Error(
          `AI request timed out after ${mins} minute${mins === 1 ? '' : 's'}.` +
            (pid === 'local' ? ' A local model can be slow on its first request while it loads.' : '')
        );
      }
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
    let rawText = '';
    let providerReasoning = '';
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    if (pid === 'anthropic') {
      // Content is an array of blocks; with extended thinking the first block is
      // a `thinking` block, so find the `text` block rather than reading [0].
      const blocks: Array<{ type?: string; text?: string; thinking?: string }> = data?.content || [];
      rawText = blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join('').trim();
      providerReasoning = blocks
        .filter((b) => b.type === 'thinking')
        .map((b) => b.thinking || '')
        .join('\n\n')
        .trim();
      inputTokens = data?.usage?.input_tokens;
      outputTokens = data?.usage?.output_tokens;
    } else {
      // OpenAI-style. Some reasoning models expose chain-of-thought in a side
      // field (`reasoning` / `reasoning_content`); the answer is in `content`.
      const msg = data?.choices?.[0]?.message || {};
      rawText = (msg.content as string) || '';
      providerReasoning = ((msg.reasoning as string) || (msg.reasoning_content as string) || '').trim();
      inputTokens = data?.usage?.prompt_tokens;
      outputTokens = data?.usage?.completion_tokens;
    }

    // Strip inline <think>…</think> wrappers (local reasoning models) out of the
    // usable text, and fold any captured thinking into the reasoning channel.
    const { clean, thinking } = stripThinking(rawText);
    const reasoning = [providerReasoning, thinking].filter(Boolean).join('\n\n');

    if (debug) {
      if (reasoning) debug.reasoning += (debug.reasoning ? '\n\n---\n\n' : '') + reasoning;
      debug.raw += (debug.raw ? '\n\n---\n\n' : '') + rawText;
    }

    return { text: clean, reasoning: reasoning || undefined, inputTokens, outputTokens };
  };
}

/** Crude local token estimate (character-count fallback, ~3.8 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length || 0) / 3.8);
}
