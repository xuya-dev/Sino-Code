import type { ModelRequest } from '../../ports/model-client.js'
import { BaseOpenAiClient } from './base-openai-client.js'

export class TencentClient extends BaseOpenAiClient {
  override readonly provider = 'tencent'

  protected override customizeRequestBody(
    body: Record<string, unknown>,
    request: ModelRequest
  ): void {
    const baseUrl = this.config.baseUrl.toLowerCase()
    if (baseUrl.includes('hunyuan.cloud.tencent.com')) {
      body.enable_enhancement = true
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
      return { message: `Tencent invalid API key: ${body}`, code: 'tencent_invalid_api_key' }
    }
    if (status === 402) {
      return { message: `Tencent insufficient balance: ${body}`, code: 'tencent_insufficient_balance' }
    }
    if (status === 429) {
      return { message: `Tencent rate limited (HTTP 429): ${body}`, code: 'rate_limited' }
    }
    if (status >= 500) {
      return { message: `Tencent server error (HTTP ${status}): ${body}`, code: `tencent_http_${status}` }
    }
    return { message: `Tencent request failed (HTTP ${status}): ${body}`, code: `http_${status}` }
  }

}
