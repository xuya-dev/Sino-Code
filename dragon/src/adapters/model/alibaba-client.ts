import type { ModelRequest } from '../../ports/model-client.js'
import { BaseOpenAiClient } from './base-openai-client.js'

export class AlibabaClient extends BaseOpenAiClient {
  override readonly provider = 'alibaba'

  protected override customizeHeaders(
    headers: Record<string, string>,
    _stream: boolean,
    _endpointFormat: string
  ): void {
    headers['User-Agent'] = `dragon-alibaba/0.1.0`
  }

  protected override customizeRequestBody(
    body: Record<string, unknown>,
    request: ModelRequest
  ): void {
    const model = request.model?.trim() || this.config.model
    if (this.modelSupportsThinking(model) && body.temperature !== undefined) {
      delete body.temperature
    }
  }

  protected override async classifyHttpError(
    status: number,
    text: string
  ): Promise<{ message: string; code: string }> {
    const body = text.slice(0, 500)
    if (status === 400 && /invalid.?api.?key|InvalidApiKey/i.test(text)) {
      return { message: `Bailian invalid API key: ${body}`, code: 'bailian_invalid_api_key' }
    }
    if (status === 429) {
      if (/rate.?limit|throttl/i.test(text)) {
        return { message: `Bailian rate limited: ${body}`, code: 'rate_limited' }
      }
      return { message: `Bailian quota exceeded: ${body}`, code: 'bailian_quota_exceeded' }
    }
    if (status >= 500) {
      return { message: `Bailian server error (HTTP ${status}): ${body}`, code: `bailian_http_${status}` }
    }
    return { message: `Bailian request failed (HTTP ${status}): ${body}`, code: `http_${status}` }
  }

}
