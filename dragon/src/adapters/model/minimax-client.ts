import type { ModelRequest } from '../../ports/model-client.js'
import { BaseOpenAiClient } from './base-openai-client.js'

export class MiniMaxClient extends BaseOpenAiClient {
  override readonly provider = 'minimax'

  protected override customizeHeaders(
    headers: Record<string, string>,
    _stream: boolean,
    _endpointFormat: string
  ): void {
    headers['User-Agent'] = `dragon-minimax/0.1.0`
  }

  protected override customizeRequestBody(
    body: Record<string, unknown>,
    request: ModelRequest
  ): void {
    if (Object.prototype.hasOwnProperty.call(body, 'thinking')) return
    const model = request.model?.trim() || this.config.model
    if (this.modelSupportsThinking(model)) {
      body.thinking = { type: 'adaptive' }
      body.reasoning_split = true
    }
  }

  protected override async classifyHttpError(
    status: number,
    text: string
  ): Promise<{ message: string; code: string }> {
    const body = text.slice(0, 500)
    if (status === 401 || /"status_code"\s*:\s*1004/.test(text)) {
      return { message: `MiniMax authentication failed: ${body}`, code: 'minimax_auth_failed' }
    }
    if (status === 402 || /"status_code"\s*:\s*1008/.test(text)) {
      return { message: `MiniMax insufficient balance: ${body}`, code: 'minimax_insufficient_balance' }
    }
    if (status === 429 || /"status_code"\s*:\s*1002/.test(text)) {
      return { message: `MiniMax rate limited (HTTP 429): ${body}`, code: 'rate_limited' }
    }
    if (/"status_code"\s*:\s*1039/.test(text)) {
      return { message: `MiniMax token limit exceeded: ${body}`, code: 'minimax_token_limit' }
    }
    if (status >= 500 || /"status_code"\s*:\s*1013/.test(text)) {
      return { message: `MiniMax server error (HTTP ${status}): ${body}`, code: `minimax_http_${status}` }
    }
    return { message: `MiniMax request failed (HTTP ${status}): ${body}`, code: `http_${status}` }
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
