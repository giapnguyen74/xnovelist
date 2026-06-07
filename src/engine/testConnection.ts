import { ProviderId, OpenAIProviderConfig, AnthropicProviderConfig, OpenRouterProviderConfig, LocalAIProviderConfig } from '../storage/aiConfig';

export interface TestResult {
  ok: boolean;
  error?: string;
  latencyMs?: number;
  /** The model id we actually sent the request to. Used by the test pane to
   *  display "tested gpt-4o-mini ✓" even when the user typed a different
   *  string into the model box and then sent again. */
  modelTested?: string;
  /** The exact `user` message we sent — surfaced in the UI so the writer can
   *  eyeball that a real round-trip happened and what the model saw. */
  promptSent?: string;
  /** The exact assistant text we received back. */
  reply?: string;
}

/** Override knobs for the test playground: pick a specific model and tweak the
 *  prompt without touching the saved config. */
export interface TestOverrides {
  modelId?: string;
  userPrompt?: string;
  maxTokens?: number;
}

const TEST_SYSTEM_PROMPT = 'Respond with the single word: pong';
const TEST_USER_PROMPT = 'ping';

/**
 * Perform a real round-trip chat completion check to verify AI credentials, model accessibility,
 * and endpoint reachability.
 */
export async function testConnection(
  providerId: ProviderId,
  config: OpenAIProviderConfig | AnthropicProviderConfig | OpenRouterProviderConfig | LocalAIProviderConfig,
  overrides?: TestOverrides
): Promise<TestResult> {
  const userPrompt = overrides?.userPrompt?.trim() || TEST_USER_PROMPT;
  const startTime = performance.now();

  try {
    let endpoint = '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    let body: Record<string, unknown> = {};
    let modelId = '';

    // 1. Prepare Request details based on the selected provider
    if (providerId === 'openai') {
      const c = config as OpenAIProviderConfig;
      endpoint = 'https://api.openai.com/v1/chat/completions';
      modelId = overrides?.modelId || c.defaultModel || 'gpt-4o-mini';

      const apiKey = (c.apiKey || '').trim();
      if (!apiKey) {
        return { ok: false, error: 'Authentication failed. Re-paste your key.' };
      }
      headers['Authorization'] = `Bearer ${apiKey}`;

      body = {
        model: modelId,
        messages: [
          { role: 'system', content: TEST_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: overrides?.userPrompt ? 0.7 : 0,
        max_tokens: overrides?.maxTokens || (overrides?.userPrompt ? 4096 : 1024),
      };
    } else if (providerId === 'anthropic') {
      const c = config as AnthropicProviderConfig;
      endpoint = 'https://api.anthropic.com/v1/messages';
      modelId = overrides?.modelId || c.defaultModel || 'claude-3-5-haiku-20241022';

      headers['anthropic-version'] = '2023-06-01';
      const apiKey = (c.apiKey || '').trim();
      if (!apiKey) {
        return { ok: false, error: 'Authentication failed. Re-paste your key.' };
      }
      headers['x-api-key'] = apiKey;

      body = {
        model: modelId,
        system: TEST_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        temperature: overrides?.userPrompt ? 0.7 : 0,
        max_tokens: overrides?.maxTokens || (overrides?.userPrompt ? 4096 : 1024),
      };
    } else if (providerId === 'openrouter') {
      const c = config as OpenRouterProviderConfig;
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      modelId = overrides?.modelId || c.defaultModel || 'google/gemini-2.5-flash';

      const apiKey = (c.apiKey || '').trim();
      if (!apiKey) {
        return { ok: false, error: 'Authentication failed. Sign in again or re-paste your key.' };
      }
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['HTTP-Referer'] = 'https://xnovelist.app'; // Nice-to-have for OpenRouter rankings
      headers['X-Title'] = 'xnovelist';

      body = {
        model: modelId,
        messages: [
          { role: 'system', content: TEST_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: overrides?.userPrompt ? 0.7 : 0,
        max_tokens: overrides?.maxTokens || (overrides?.userPrompt ? 4096 : 1024),
      };
    } else if (providerId === 'local') {
      const c = config as LocalAIProviderConfig;
      let baseUrl = (c.baseUrl || '').trim();
      if (!baseUrl) {
        return { ok: false, error: 'Base URL is empty.' };
      }
      // Clean up base URL and append endpoint
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }
      endpoint = `${baseUrl}/chat/completions`;
      modelId = overrides?.modelId || c.defaultModel || '';

      const apiKey = (c.apiKey || '').trim();
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // Add custom headers if specified
      if (c.headers && typeof c.headers === 'object') {
        Object.entries(c.headers).forEach(([k, v]) => {
          headers[k] = String(v);
        });
      }

      body = {
        model: modelId,
        messages: [
          { role: 'system', content: TEST_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: overrides?.userPrompt ? 0.7 : 0,
        max_tokens: overrides?.maxTokens || (overrides?.userPrompt ? 4096 : 1024),
      };
    } else {
      return { ok: false, error: 'Unknown provider.' };
    }

    // 2. Perform Network Call. A local model can take minutes on its first
    //    request while it loads into memory, so give local a long leash.
    const timeoutMs = providerId === 'local' ? 30 * 60 * 1000 : 5 * 60 * 1000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    // 3. Process Status Codes & Map Errors
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'Authentication failed. Sign in again or re-paste your key.' };
    }

    if (response.status === 404) {
      return { ok: false, error: 'Model not found. Pick a different model in this row.' };
    }

    if (response.status === 429) {
      return { ok: false, error: 'Rate-limited. Try again in a moment.' };
    }

    if (!response.ok) {
      let verbatim = '';
      try {
        const errorJson = await response.json();
        verbatim = errorJson?.error?.message || errorJson?.error || JSON.stringify(errorJson);
      } catch {
        verbatim = `HTTP ${response.status} ${response.statusText}`;
      }
      const truncated = verbatim.length > 200 ? `${verbatim.slice(0, 197)}...` : verbatim;
      return { ok: false, error: truncated };
    }

    // 4. Parse Response Body Content
    const data = await response.json();
    let reply = '';

    if (providerId === 'anthropic') {
      // Content is an array of blocks; with extended thinking the first block is
      // a `thinking` block, so find the `text` block rather than reading [0].
      const blocks: Array<{ type?: string; text?: string }> = data?.content || [];
      reply = blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
    } else {
      reply = data?.choices?.[0]?.message?.content || '';
    }

    reply = reply.trim();

    if (!reply) {
      return {
        ok: false,
        error: 'The endpoint answered, but with no content. The model may not exist or may not support chat completions.',
      };
    }

    return {
      ok: true,
      latencyMs,
      modelTested: modelId,
      promptSent: userPrompt,
      reply,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      const mins = providerId === 'local' ? 30 : 5;
      return { ok: false, error: `Connection timed out after ${mins} minutes. Check the base URL and network.` };
    }
    return {
      ok: false,
      error: 'Could not reach the endpoint. Check the base URL and your network.',
    };
  }
}
