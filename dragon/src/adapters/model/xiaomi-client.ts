import type { ModelRequest } from '../../ports/model-client.js'
import { BaseOpenAiClient } from './base-openai-client.js'

export class XiaomiClient extends BaseOpenAiClient {
  override readonly provider = 'xiaomi'

  protected override customizeHeaders(
    headers: Record<string, string>,
    _stream: boolean,
    _endpointFormat: string
  ): void {
    headers['User-Agent'] = `dragon-xiaomi/0.1.0`
    if (headers['Authorization']?.startsWith('Bearer ')) {
      const apiKey = headers['Authorization'].slice('Bearer '.length)
      headers['api-key'] = apiKey
    }
  }

  protected override customizeRequestBody(
    body: Record<string, unknown>,
    request: ModelRequest
  ): void {
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
      return { message: `MiMo authentication failed: ${body}`, code: 'mimo_auth_failed' }
    }
    if (status === 402) {
      return { message: `MiMo insufficient balance: ${body}`, code: 'mimo_insufficient_balance' }
    }
    if (status === 429) {
      return { message: `MiMo rate limited (HTTP 429): ${body}`, code: 'rate_limited' }
    }
    if (status >= 500) {
      return { message: `MiMo server error (HTTP ${status}): ${body}`, code: `mimo_http_${status}` }
    }
    return { message: `MiMo request failed (HTTP ${status}): ${body}`, code: `http_${status}` }
  }

  protected override shouldRetryWithoutStreamUsage(
    status: number,
    text: string,
    body: Record<string, unknown>
  ): boolean {
    if (status !== 400 && status !== 422) return false
    if (!Object.prototype.hasOwnProperty.call(body, 'stream_options')) return false
    return /\b(stream_options|include_usage)\b/i.test(text)
  }

  protected override mapUsageCacheFields(usage: Record<string, unknown>): { cacheHit: number; cacheMiss: number; hasNativeCache: boolean } {
    return { cacheHit: 0, cacheMiss: Number(usage.prompt_tokens ?? 0) || 0, hasNativeCache: false }
  }
}
