import type { ModelRequest } from '../../ports/model-client.js'
import { BaseOpenAiClient, type OpenAiCompatConfig } from './base-openai-client.js'
import { probeDeepSeekReachable } from './model-error-probe.js'

/**
 * DeepSeek model client.
 *
 * Extends the generic OpenAI-compatible base with DeepSeek-specific
 * optimizations: profile-driven thinking, native cache-hit/miss tracking,
 * cost estimation, and reachability probing.
 */
export class DeepSeekClient extends BaseOpenAiClient {
  override readonly provider = 'deepseek'

  protected override customizeHeaders(
    headers: Record<string, string>,
    _stream: boolean,
    _endpointFormat: string
  ): void {
    headers['User-Agent'] = `dragon-deepseek/0.1.0`
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
    if (status === 429) {
      return {
        message: `model request was rate limited (HTTP 429): ${body}`,
        code: 'rate_limited'
      }
    }
    if (status >= 500) {
      const probe = await probeDeepSeekReachable({
        baseUrl: this.config.baseUrl,
        fetchImpl: (this as unknown as { config: OpenAiCompatConfig }).config.fetchImpl ?? fetch
      })
      return {
        message: `model request failed with DeepSeek HTTP ${status}: ${body} ${probe.message}`,
        code: probe.reachable ? `deepseek_http_${status}` : 'deepseek_unreachable'
      }
    }
    return { message: `model request failed with status ${status}: ${body}`, code: `http_${status}` }
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

}
