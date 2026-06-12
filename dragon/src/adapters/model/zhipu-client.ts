import type { ModelRequest } from '../../ports/model-client.js'
import { BaseOpenAiClient } from './base-openai-client.js'

export class ZhipuClient extends BaseOpenAiClient {
  override readonly provider = 'zhipu'

  protected override customizeHeaders(
    headers: Record<string, string>,
    _stream: boolean,
    _endpointFormat: string
  ): void {
    headers['User-Agent'] = `dragon-zhipu/0.1.0`
  }

  protected override customizeRequestBody(
    body: Record<string, unknown>,
    request: ModelRequest
  ): void {
    const model = request.model?.trim() || this.config.model
    if (
      this.modelSupportsThinking(model) &&
      !Object.prototype.hasOwnProperty.call(body, 'thinking')
    ) {
      body.thinking = { type: 'enabled' }
    }
    if (
      !Object.prototype.hasOwnProperty.call(body, 'tool_stream') &&
      request.tools.length > 0
    ) {
      body.tool_stream = true
    }
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
