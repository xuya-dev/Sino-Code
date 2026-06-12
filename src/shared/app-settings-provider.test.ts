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

  it('keeps an explicit Dragon runtime model before provider route fallback', () => {
    const state = settings()
    state.agents.dragon.model = 'explicit-model'
    state.provider.providers[0] = {
      ...state.provider.providers[0],
      models: ['fast-model', 'main-model'],
      mainModelId: 'main-model',
      fastModelId: 'fast-model'
    }

    expect(resolveDragonRuntimeSettings(state).model).toBe('explicit-model')
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

    expect(normalized?.models).toEqual(['custom-deepseek-model', 'deepseek-v4-pro'])
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
