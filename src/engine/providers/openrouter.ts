import { testConnection, TestResult } from '../testConnection';
import { OpenRouterProviderConfig } from '../../storage/aiConfig';

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  promptPrice: number;     // per 1M tokens
  completionPrice: number; // per 1M tokens
}

/**
 * Fetches the active list of models from OpenRouter.
 * This endpoint is public and does not require an API key to read.
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from OpenRouter: HTTP ${response.status}`);
    }

    const json = await response.json();
    const data = json?.data || [];

    return data.map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      contextLength: m.context_length || 4096,
      promptPrice: parseFloat(m.pricing?.prompt || '0') * 1000000,
      completionPrice: parseFloat(m.pricing?.completion || '0') * 1000000,
    }));
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    // Return a sensible default static list in case of network failures
    return [
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextLength: 1048576, promptPrice: 0.075, completionPrice: 0.30 },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', contextLength: 131072, promptPrice: 0.54, completionPrice: 0.81 },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextLength: 200000, promptPrice: 3.0, completionPrice: 15.0 },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', contextLength: 128000, promptPrice: 0.15, completionPrice: 0.60 },
    ];
  }
}

/**
 * Performs a round-trip connection test for OpenRouter.
 */
export async function testOpenRouterConnection(
  config: OpenRouterProviderConfig
): Promise<TestResult> {
  return testConnection('openrouter', config);
}
