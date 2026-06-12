import { describe, expect, it } from 'vitest'
import {
  defaultClawSettings,
  defaultKeyboardShortcuts,
  defaultDragonRuntimeSettings,
  defaultModelProviderSettings,
  defaultScheduleSettings,
  defaultWriteSettings,
  mergeModelProviderSettings,
  normalizeModelProviderSettings,
  resolveDragonRuntimeSettings,
  type AppSettingsV1
} from './app-settings'

function settings(): AppSettingsV1 {
  return {
    version: 1,
    locale: 'en',
    theme: 'system',
    uiFontScale: 'small',
    provider: {
      ...defaultModelProviderSettings(),
      providers: [
        ...defaultModelProviderSettings().providers,
        {
          id: 'custom',
          name: 'Custom Provider',
          apiKey: 'sk-custom',
          baseUrl: 'https://custom.example/v1',
          endpointFormat: 'messages',
          models: ['custom-model']
        }
      ]
    },
    agents: {
      dragon: {
        ...defaultDragonRuntimeSettings(),
        providerId: 'custom',
        model: 'custom-model'
      }
    },
    workspaceRoot: '/tmp/workspace',
    log: { enabled: false, retentionDays: 7 },
    notifications: { turnComplete: true },
    appBehavior: { openAtLogin: false, startMinimized: false, closeToTray: false },
    keyboardShortcuts: defaultKeyboardShortcuts(),
    write: defaultWriteSettings(),
    claw: defaultClawSettings(),
    schedule: defaultScheduleSettings(),
    guiUpdate: { channel: 'stable' },
    codePromptPrefix: ''
  }
}

describe('model provider settings', () => {
  it('does not create a default provider', () => {
    const provider = defaultModelProviderSettings()

    expect(provider).toEqual({
      apiKey: '',
      baseUrl: '',
      providers: []
    })
    expect(resolveDragonRuntimeSettings({
      ...settings(),
      provider,
      agents: {
        dragon: {
          ...defaultDragonRuntimeSettings(),
          apiKey: 'sk-orphan',
          baseUrl: 'https://orphan.example/v1'
        }
      }
    })).toEqual(expect.objectContaining({
      apiKey: '',
      baseUrl: ''
    }))

    expect(resolveDragonRuntimeSettings({
      ...settings(),
      agents: {
        dragon: {
          ...defaultDragonRuntimeSettings(),
          providerId: '',
          model: 'custom-model'
        }
      }
    })).toEqual(expect.objectContaining({
      apiKey: '',
      baseUrl: ''
    }))
  })

  it('resolves Dragon runtime credentials from the selected provider', () => {
    const runtime = resolveDragonRuntimeSettings(settings())

    expect(runtime.apiKey).toBe('sk-custom')
    expect(runtime.baseUrl).toBe('https://custom.example/v1')
    expect(runtime.endpointFormat).toBe('messages')
  })

  it('uses the selected provider route model as the Dragon runtime fallback model', () => {
    const state = settings()
    state.agents.dragon.model = ''
    state.provider.providers[0] = {
      ...state.provider.providers[0],
      models: ['fast-model', 'main-model'],
      mainModelId: 'main-model',
      fastModelId: 'fast-model'
    }

    expect(resolveDragonRuntimeSettings(state).model).toBe('main-model')

    state.provider.providers[0] = {
      ...state.provider.providers[0],
      mainModelId: undefined
    }
    expect(resolveDragonRuntimeSettings(state).model).toBe('fast-model')
  })

  it('keeps an explicit Dragon runtime model only when it belongs to the selected provider', () => {
    const state = settings()
    state.provider.providers[0] = {
      ...state.provider.providers[0],
      models: ['fast-model', 'main-model', 'explicit-model'],
      mainModelId: 'main-model',
      fastModelId: 'fast-model'
    }

    state.agents.dragon.model = 'explicit-model'
    expect(resolveDragonRuntimeSettings(state).model).toBe('explicit-model')

    state.agents.dragon.model = 'stale-other-provider-model'
    expect(resolveDragonRuntimeSettings(state).model).toBe('main-model')
  })

  it('ignores stale DeepSeek runtime model overrides after switching providers', () => {
    const state = settings()
    state.provider.providers[0] = {
      ...state.provider.providers[0],
      models: ['glm-5.1', 'glm-5-flash'],
      mainModelId: 'glm-5.1',
      fastModelId: 'glm-5-flash'
    }
    state.agents.dragon.model = 'deepseek-v4-pro'

    expect(resolveDragonRuntimeSettings(state).model).toBe('glm-5.1')
  })

  it('keeps auto routing models only when they belong to the provider model list', () => {
    const provider = normalizeModelProviderSettings({
      providers: [
        {
          id: 'custom',
          name: 'Custom',
          apiKey: 'sk-custom',
          baseUrl: 'https://custom.example/v1',
          endpointFormat: 'chat_completions',
          models: ['main-model', 'fast-model'],
          mainModelId: 'main-model',
          fastModelId: 'missing-model'
        }
      ]
    }).providers[0]

    expect(provider?.mainModelId).toBe('main-model')
    expect(provider?.fastModelId).toBeUndefined()
  })

  it('preserves both configured auto routing models when valid', () => {
    const provider = normalizeModelProviderSettings({
      providers: [
        {
          id: 'custom',
          name: 'Custom',
          apiKey: 'sk-custom',
          baseUrl: 'https://custom.example/v1',
          endpointFormat: 'chat_completions',
          models: ['main-model', 'fast-model'],
          mainModelId: 'main-model',
          fastModelId: 'fast-model'
        }
      ]
    }).providers[0]

    expect(provider?.mainModelId).toBe('main-model')
    expect(provider?.fastModelId).toBe('fast-model')
  })

  it('preserves configured model display names', () => {
    const provider = normalizeModelProviderSettings({
      providers: [
        {
          id: 'custom',
          name: 'Custom',
          apiKey: 'sk-custom',
          baseUrl: 'https://custom.example/v1',
          endpointFormat: 'chat_completions',
          models: ['glm-5.1'],
          modelDetails: {
            'glm-5.1': { id: 'glm-5.1', name: ' GLM 5.1 ' }
          }
        }
      ]
    }).providers[0]

    expect(provider?.modelDetails?.['glm-5.1']?.name).toBe(' GLM 5.1 ')
  })

  it('preserves configured tiered model pricing', () => {
    const provider = normalizeModelProviderSettings({
      providers: [
        {
          id: 'minimax',
          name: 'MiniMax',
          apiKey: 'sk-minimax',
          baseUrl: 'https://api.minimaxi.com/v1',
          endpointFormat: 'chat_completions',
          models: ['MiniMax-M3'],
          modelDetails: {
            'MiniMax-M3': {
              id: 'MiniMax-M3',
              priceInput: ' 0.3 ',
              priceOutput: ' 1.2 ',
              priceInputCacheRead: ' 0.06 ',
              priceInputCacheWrite: ' 0.375 ',
              priceTiers: [
                {
                  minInputTokens: 512001,
                  priceInput: '0.6',
                  priceOutput: '2.4',
                  priceInputCacheRead: '0.12',
                  priceInputCacheWrite: '0.375'
                }
              ]
            }
          }
        }
      ]
    }).providers[0]

    expect(provider?.modelDetails?.['MiniMax-M3']?.priceTiers).toEqual([
      {
        minInputTokens: 512001,
        priceInput: '0.6',
        priceOutput: '2.4',
        priceInputCacheRead: '0.12',
        priceInputCacheWrite: '0.375'
      }
    ])
  })

  it('preserves configured model order while normalizing providers', () => {
    const provider = normalizeModelProviderSettings({
      providers: [
        {
          id: 'custom',
          name: 'Custom',
          apiKey: 'sk-custom',
          baseUrl: 'https://custom.example/v1',
          endpointFormat: 'chat_completions',
          models: ['glm-5', 'glm-5.1', 'fast-model', 'glm-5']
        }
      ]
    }).providers[0]

    expect(provider?.models).toEqual(['glm-5', 'glm-5.1', 'fast-model'])
  })

  it('removes legacy implicit DeepSeek models unless model details explicitly configure them', () => {
    const normalized = normalizeModelProviderSettings({
      providers: [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          apiKey: 'sk-deepseek',
          baseUrl: 'https://api.deepseek.com',
          endpointFormat: 'chat_completions',
          models: [
            'deepseek-chat',
            'deepseek-reasoner',
            'deepseek-v4-pro',
            'deepseek-v4-flash',
            'custom-deepseek-model'
          ],
          modelDetails: {
            'deepseek-v4-pro': { id: 'deepseek-v4-pro' }
          }
        }
      ]
    }).providers[0]

    expect(normalized?.models).toEqual(['deepseek-v4-pro', 'custom-deepseek-model'])
  })

  it('preserves auto routing models through provider settings merge', () => {
    const current = normalizeModelProviderSettings({
      providers: [
        {
          id: 'custom',
          name: 'Custom',
          apiKey: 'sk-custom',
          baseUrl: 'https://custom.example/v1',
          endpointFormat: 'chat_completions',
          models: ['main-model', 'fast-model']
        }
      ]
    })

    const merged = mergeModelProviderSettings(current, {
      providers: [
        {
          ...current.providers[0],
          mainModelId: 'main-model',
          fastModelId: 'fast-model'
        }
      ]
    })

    expect(merged.providers[0]?.mainModelId).toBe('main-model')
    expect(merged.providers[0]?.fastModelId).toBe('fast-model')
  })
})
