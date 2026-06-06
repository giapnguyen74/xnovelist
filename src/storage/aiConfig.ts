import { ProjectStorage } from './ProjectStorage';

/**
 * Each provider supports two model tiers:
 *   - `defaultModel` — used for quality-sensitive Capabilities (L2 rewrites,
 *      future L3+ generation). Writer sees the output, so picks a flagship.
 *   - `fastModel`    — used for background Capabilities (L1 summaries, Bible
 *      extraction, manuscript Q&A). Optional; falls back to defaultModel
 *      if unset.
 */
export interface OpenAIProviderConfig {
  apiKey: string;
  defaultModel?: string;
  fastModel?: string;
}

export interface AnthropicProviderConfig {
  apiKey: string;
  defaultModel?: string;
  fastModel?: string;
}

export interface OpenRouterProviderConfig {
  apiKey: string;
  defaultModel?: string;
  fastModel?: string;
}

export interface LocalAIProviderConfig {
  baseUrl: string;          // e.g. http://localhost:11434/v1
  apiKey?: string;          // optional bearer
  defaultModel: string;     // required
  fastModel?: string;
  headers?: Record<string, string>;  // escape hatch for self-hosters
}

export type ProviderId = 'openai' | 'anthropic' | 'openrouter' | 'local';

export type WorkspaceAIConfig = {
  /** The workspace-wide AI level. Default 0. */
  level: 0 | 1 | 2 | 3 | 4 | 5;

  /** Which provider every Capability uses by default. Required once level >= 1. */
  defaultProviderId?: ProviderId;

  providers: {
    openai?: OpenAIProviderConfig;
    anthropic?: AnthropicProviderConfig;
    openrouter?: OpenRouterProviderConfig;
    local?: LocalAIProviderConfig;
  };
};

export const DEFAULT_AI_CONFIG: WorkspaceAIConfig = {
  level: 0,
  providers: {}
};

const AI_CONFIG_PATH = 'workspace/ai.json';

/**
 * Loads the workspace-wide AI config from storage.
 * If the config doesn't exist, returns the default config.
 */
export async function loadAIConfig(storage: ProjectStorage): Promise<WorkspaceAIConfig> {
  try {
    const exists = await storage.exists(AI_CONFIG_PATH);
    if (!exists) {
      return { ...DEFAULT_AI_CONFIG };
    }
    const content = await storage.readFile(AI_CONFIG_PATH);
    if (!content) {
      return { ...DEFAULT_AI_CONFIG };
    }
    const parsed = JSON.parse(content) as WorkspaceAIConfig;
    // Basic migration/validation to ensure level is a valid number
    if (typeof parsed.level !== 'number' || parsed.level < 0 || parsed.level > 5) {
      parsed.level = 0;
    }
    if (!parsed.providers) {
      parsed.providers = {};
    }
    return parsed;
  } catch (error) {
    console.error('Failed to load AI config from storage', error);
    return { ...DEFAULT_AI_CONFIG };
  }
}

/**
 * Saves the workspace-wide AI config to storage.
 */
export async function saveAIConfig(storage: ProjectStorage, config: WorkspaceAIConfig): Promise<void> {
  try {
    const content = JSON.stringify(config, null, 2);
    await storage.writeFile(AI_CONFIG_PATH, content);
  } catch (error) {
    console.error('Failed to save AI config to storage', error);
    throw error;
  }
}
