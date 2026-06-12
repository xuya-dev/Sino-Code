import { BaseOpenAiClient } from './base-openai-client.js'

/**
 * Generic OpenAI-compatible model client.
 * Used as the fallback when no provider-specific client is matched.
 */
export class OpenAiCompatClient extends BaseOpenAiClient {
  readonly provider = 'openai-compat'
}
