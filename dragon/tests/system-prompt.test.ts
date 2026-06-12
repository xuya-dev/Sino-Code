import { describe, expect, it } from 'vitest'
import {
  buildDragonSystemPrompt,
  dragonPinnedConstraints,
  isDeepSeekBetaEndpoint
} from '../src/prompt/dragon-system-prompt.js'

describe('dragon system prompt', () => {
  it('omits DeepSeek beta prompt-cache instructions by default', () => {
    const prompt = buildDragonSystemPrompt()
    const pinned = dragonPinnedConstraints({ promptCache: false })

    expect(prompt).toContain('You are Dragon')
    expect(prompt).not.toContain('DeepSeek beta prompt-cache behavior')
    expect(prompt).not.toContain('prompt_cache_hit_tokens')
    expect(pinned).not.toContain('system: keep the stable Dragon prefix byte-stable for DeepSeek beta prompt-cache reuse')
  })

  it('includes prompt-cache instructions for DeepSeek beta endpoints', () => {
    const prompt = buildDragonSystemPrompt({ promptCache: true })
    const pinned = dragonPinnedConstraints({ promptCache: true })

    expect(prompt).toContain('DeepSeek beta prompt-cache behavior')
    expect(prompt).toContain('prompt_cache_hit_tokens')
    expect(pinned).toContain('system: keep the stable Dragon prefix byte-stable for DeepSeek beta prompt-cache reuse')
  })

  it('detects only DeepSeek beta endpoints for prompt-cache prompting', () => {
    expect(isDeepSeekBetaEndpoint({
      providerId: 'deepseek',
      baseUrl: 'https://api.deepseek.com/beta'
    })).toBe(true)
    expect(isDeepSeekBetaEndpoint({
      providerId: 'custom',
      baseUrl: 'https://api.deepseek.com/beta'
    })).toBe(true)
    expect(isDeepSeekBetaEndpoint({
      providerId: 'deepseek',
      baseUrl: 'https://api.deepseek.com'
    })).toBe(false)
    expect(isDeepSeekBetaEndpoint({
      providerId: 'custom',
      baseUrl: 'https://model.example/beta'
    })).toBe(false)
  })
})
