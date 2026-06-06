import { testConnection, TestResult } from '../testConnection';
import { AnthropicProviderConfig } from '../../storage/aiConfig';

/**
 * Round-trip ping against the configured Anthropic model.
 */
export async function testAnthropicConnection(
  config: AnthropicProviderConfig
): Promise<TestResult> {
  return testConnection('anthropic', config);
}
