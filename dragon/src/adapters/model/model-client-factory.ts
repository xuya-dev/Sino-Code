import type { ModelClient } from '../../ports/model-client.js'
import type { OpenAiCompatConfig } from './base-openai-client.js'
import { DeepSeekClient } from './deepseek-client.js'
import { OpenAiCompatClient } from './openai-compat-client.js'
import { ZhipuClient } from './zhipu-client.js'
import { MiniMaxClient } from './minimax-client.js'
import { MoonshotClient } from './moonshot-client.js'
import { AlibabaClient } from './alibaba-client.js'
import { TencentClient } from './tencent-client.js'
import { XiaomiClient } from './xiaomi-client.js'

type ClientFactory = (config: OpenAiCompatConfig) => ModelClient

const PROVIDER_REGISTRY: Record<string, ClientFactory> = {
  deepseek: (c) => new DeepSeekClient(c),
  zhipu:    (c) => new ZhipuClient(c),
  minimax:  (c) => new MiniMaxClient(c),
  moonshot: (c) => new MoonshotClient(c),
  alibaba:  (c) => new AlibabaClient(c),
  tencent:  (c) => new TencentClient(c),
  xiaomi:   (c) => new XiaomiClient(c),
}

/**
 * Create a model client appropriate for the given configuration.
 * Matches the `providerId` against known provider names.
 * Falls back to a generic OpenAI-compatible client when `providerId`
 * is empty or unknown.
 */
export function createModelClient(config: OpenAiCompatConfig): ModelClient {
  const id = config.providerId?.trim().toLowerCase()
  if (id && PROVIDER_REGISTRY[id]) return PROVIDER_REGISTRY[id](config)
  return new OpenAiCompatClient(config)
}
