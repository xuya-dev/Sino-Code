import type { ModelRequest } from '../../ports/model-client.js'
import { BaseOpenAiClient } from './base-openai-client.js'

export class MoonshotClient extends BaseOpenAiClient {
  override readonly provider = 'moonshot'

  protected override customizeRequestBody(
    body: Record<string, unknown>,
    request: ModelRequest
  ): void {
    if (request.threadId) {
      body.prompt_cache_key = request.threadId
    }
    if (Object.prototype.hasOwnProperty.call(body, 'thinking')) return
    const model = request.model?.trim() || this.config.model
    if (this.modelSupportsThinking(model)) {
      body.thinking = { type: 'enabled' }
    }
  }

  protected override async classifyHttpError(
    status: number,
    text: string
  ): Promise<{ message: string; code: string }> {
    const body = text.slice(0, 500)
    if (status === 401) {
      return { message: `Moonshot invalid API key: ${body}`, code: 'moonshot_invalid_api_key' }
    }
    if (status === 403) {
      return { message: `Moonshot forbidden: ${body}`, code: 'moonshot_forbidden' }
    }
    if (status === 429) {
      if (/rate.?limit|throttl/i.test(text)) {
        return { message: `Moonshot rate limited: ${body}`, code: 'rate_limited' }
      }
      return { message: `Moonshot quota exceeded: ${body}`, code: 'moonshot_quota_exceeded' }
    }
    if (status >= 500) {
      return { message: `Moonshot server error (HTTP ${status}): ${body}`, code: `moonshot_http_${status}` }
    }
    return { message: `Moonshot request failed (HTTP ${status}): ${body}`, code: `http_${status}` }
  }

  protected override mapUsageCacheFields(usage: Record<string, unknown>): { cacheHit: number; cacheMiss: number; hasNativeCache: boolean } {
    const cached = Number(usage.cached_tokens ?? 0) || 0
    const prompt = Number(usage.prompt_tokens ?? 0) || 0
    return { cacheHit: cached, cacheMiss: prompt - cached, hasNativeCache: cached > 0 }
  }

}
