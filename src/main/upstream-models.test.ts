import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  defaultClawSettings,
  defaultKeyboardShortcuts,
  defaultDragonRuntimeSettings,
  defaultModelProviderSettings,
  defaultScheduleSettings,
  defaultWriteSettings,
  type AppSettingsV1
} from '../shared/app-settings'
import { fetchUpstreamModelIds, readConfiguredDragonModelIds } from './upstream-models'

function settings(dataDir: string, model = 'settings-model'): AppSettingsV1 {
  const provider = defaultModelProviderSettings()
  return {
    version: 1,
    locale: 'en',
    theme: 'system',
    uiFontScale: 'small',
    provider: {
      ...provider,
      providers: [
        ...provider.providers,
        {
          id: 'custom-provider',
          name: 'Custom Provider',
          apiKey: 'sk-custom',
          baseUrl: 'https://custom.example/v1',
          endpointFormat: 'responses',
          models: ['custom-provider-model'],
          modelDetails: {
            'custom-provider-model': {
              id: 'custom-provider-model',
              name: 'Custom Model'
            }
          }
        }
      ]
    },
    agents: {
      dragon: {
        ...defaultDragonRuntimeSettings(),
        dataDir,
        model,
        providerId: 'custom-provider'
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

describe('upstream model picker list', () => {
  it('includes configured provider models only', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'sino-code-models-'))
    await mkdir(dataDir, { recursive: true })
    await writeFile(
      join(dataDir, 'config.json'),
      JSON.stringify({
        contextCompaction: {
          modelProfiles: {
            'legacy-model': {}
          }
        },
        models: {
          profiles: {
            'custom-model': {
              aliases: ['vendor/custom-model']
            }
          }
        }
      }),
      'utf8'
    )

    const ids = await readConfiguredDragonModelIds(settings(dataDir))

    expect(ids).toEqual([
      'auto',
      'custom-provider-model'
    ])
  })

  it('falls back to configured model ids when upstream cannot be queried', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'sino-code-models-'))
    await mkdir(dataDir, { recursive: true })
    await writeFile(
      join(dataDir, 'config.json'),
      JSON.stringify({
        models: {
          profiles: {
            'deepseek-v4-flash': {
              aliases: ['deepseek-chat', 'deepseek-reasoner']
            }
          }
        }
      }),
      'utf8'
    )
    const result = await fetchUpstreamModelIds(settings(dataDir, 'local-only-model'), '')

    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      expect(result.modelIds).toContain('custom-provider-model')
      expect(result.modelIds).not.toContain('local-only-model')
      expect(result.modelIds).not.toContain('deepseek-chat')
      expect(result.modelIds).not.toContain('deepseek-reasoner')
      expect(result.modelGroups).toEqual([
        expect.objectContaining({
          providerId: 'custom-provider',
          label: 'Custom Provider',
          modelIds: expect.arrayContaining(['custom-provider-model']),
          modelLabels: {
            'custom-provider-model': 'Custom Model'
          }
        })
      ])
    }
  })
})
