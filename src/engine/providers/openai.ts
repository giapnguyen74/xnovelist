import { testConnection, TestResult } from '../testConnection';
import { OpenAIProviderConfig } from '../../storage/aiConfig';

/**
 * Round-trip ping against the configured OpenAI model.
 */
export async function testOpenAIConnection(
  config: OpenAIProviderConfig
): Promise<TestResult> {
  return testConnection('openai', config);
}
