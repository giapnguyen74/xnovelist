import { testConnection, TestResult } from '../testConnection';
import { LocalAIProviderConfig } from '../../storage/aiConfig';

/**
 * Checks a raw input base URL and returns a suggested correction if it looks malformed,
 * e.g., missing 'http://' scheme or '/v1' path suffix.
 */
export function suggestLocalBaseUrlCorrection(input: string): string | null {
  const clean = input.trim();
  if (!clean) return null;

  // Case 1: Missing scheme entirely (e.g. "localhost:11434" or "127.0.0.1:1234")
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|[^/:]+:\d+)/i.test(clean)) {
    const hasPath = clean.includes('/');
    if (!hasPath) {
      return `http://${clean}/v1`;
    } else if (!clean.endsWith('/v1') && !clean.endsWith('/v1/')) {
      const host = clean.split('/')[0];
      return `http://${host}/v1`;
    }
    return `http://${clean}`;
  }

  // Case 2: Has scheme but missing /v1 path suffix (e.g. "http://localhost:11434")
  if (/^https?:\/\/[^/]+$/i.test(clean)) {
    return `${clean}/v1`;
  }

  return null;
}

/**
 * Tries to fetch models from the local server's `/models` endpoint to populate the dropdown.
 */
export async function fetchLocalModels(
  baseUrl: string,
  apiKey?: string,
  headers?: Record<string, string>
): Promise<string[]> {
  try {
    let cleanUrl = baseUrl.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    };

    if (headers && typeof headers === 'object') {
      Object.entries(headers).forEach(([k, v]) => {
        requestHeaders[k] = String(v);
      });
    }

    // Try standard completions endpoint path, most models endpoints live under baseUrl (e.g. /v1/models)
    const response = await fetch(`${cleanUrl}/models`, {
      method: 'GET',
      headers: requestHeaders,
    });

    if (!response.ok) {
      throw new Error();
    }

    const json = await response.json();
    // OpenAI /v1/models format is { data: [ { id: '...' } ] }
    // Ollama /api/tags format is { models: [ { name: '...' } ] }
    const list = json?.data || json?.models || [];
    return list
      .map((item: any) => item.id || item.name || item.model || String(item))
      .filter(Boolean);
  } catch (error) {
    console.warn('Failed to fetch models from local AI server. This is normal if the server is offline or lacks a /models endpoint.');
    return [];
  }
}

/**
 * Performs a round-trip connection test for Local AI.
 */
export async function testLocalAIConnection(
  config: LocalAIProviderConfig
): Promise<TestResult> {
  return testConnection('local', config);
}
