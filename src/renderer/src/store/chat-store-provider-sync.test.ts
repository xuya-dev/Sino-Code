import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defaultClawSettings,
  defaultDragonRuntimeSettings,
  defaultKeyboardShortcuts,
  defaultModelProviderSettings,
  defaultScheduleSettings,
  defaultWriteSettings,
  type AppSettingsV1
} from '@shared/app-settings'
import { rendererRuntimeClient } from '../agent/runtime-client'
import { providerAutoComposerModelId } from './chat-store-helpers'
import { syncDragonProviderForComposerModel } from './chat-store-provider-sync'

function settings(dragon: Partial<AppSettingsV1['agents']['dragon']> = {}): AppSettingsV1 {
  return {
    version: 1,
    locale: 'en',
    theme: 'system',
    uiFontScale: 'small',
    provider: {
      ...defaultModelProviderSettings(),
      providers: [
        {
          id: 'zhipu',
          name: 'Zhipu AI',
          apiKey: 'sk-zhipu',
          baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
          endpointFormat: 'chat_completions',
          models: ['glm-5.1', 'glm-flash'],
          mainModelId: 'glm-5.1',
          fastModelId: 'glm-flash',
          modelDetails: {
            'glm-5.1': { id: 'glm-5.1', name: 'GLM 5.1' }
          }
        }
      ]
    },
    agents: {
      dragon: {
        ...defaultDragonRuntimeSettings(),
        ...dragon
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

const groups = [
  {
    providerId: 'zhipu',
    label: 'Zhipu AI',
    modelIds: ['glm-5.1', 'glm-flash'],
    modelLabels: {
      'glm-5.1': 'GLM 5.1'
    }
  }
]

describe('syncDragonProviderForComposerModel', () => {
  afterEach(() => {
    rendererRuntimeClient.invalidateSettings()
    vi.unstubAllGlobals()
  })

  it('syncs a concrete composer model into runtime provider and model settings', async () => {
    const getSettings = vi.fn(async () => settings({ providerId: 'deepseek', model: 'deepseek-v4-pro' }))
    const setSettings = vi.fn(async () => settings({ providerId: 'zhipu', model: 'glm-5.1' }))
    vi.stubGlobal('window', { sinoCode: { getSettings, setSettings } })

    await expect(syncDragonProviderForComposerModel('glm-5.1', groups)).resolves.toBe(true)

    expect(setSettings).toHaveBeenCalledWith({
      agents: {
        dragon: {
          providerId: 'zhipu',
          model: 'glm-5.1'
        }
      }
    })
  })

  it('syncs provider-scoped AUTO into runtime provider and auto model settings', async () => {
    const getSettings = vi.fn(async () => settings({ providerId: 'zhipu', model: 'glm-5.1' }))
    const setSettings = vi.fn(async () => settings({ providerId: 'zhipu', model: 'auto' }))
    vi.stubGlobal('window', { sinoCode: { getSettings, setSettings } })

    await expect(syncDragonProviderForComposerModel(providerAutoComposerModelId('zhipu'), groups)).resolves.toBe(true)

    expect(setSettings).toHaveBeenCalledWith({
      agents: {
        dragon: {
          providerId: 'zhipu',
          model: 'auto'
        }
      }
    })
  })
})
