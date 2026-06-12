import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClawImChannelV1 } from '@shared/app-settings'
import { CLAW_MANAGED_INSTRUCTIONS_HEADING } from '@shared/app-settings'
import {
  MAX_TURN_MODEL_LABELS,
  MAX_CODE_WORKSPACE_ROOTS,
  clawThreadIdsFromChannels,
  clawThreadTitleLooksManaged,
  compactCodeWorkspaceRoots,
  composerModelDisplayLabel,
  composerRequestModel,
  hydrateBlockModelLabels,
  isAllowedComposerModel,
  isClawThread,
  modelDisplayNameForModel,
  newClawChannel,
  normalizeTurnModelMap,
  optimisticUserModelLabel,
  providerAutoComposerModelId,
  providerIdForComposerModel,
  providerIdFromComposerAutoModel,
  readStoredComposerModel,
  rememberTurnModel
} from './chat-store-helpers'

const TURN_MODEL_STORAGE_KEY = 'sinocode.turnModelLabel'
const COMPOSER_MODEL_STORAGE_KEY = 'sinocode.composerModel'

function createMemoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key)
    },
    setItem: (key, value) => {
      items.set(key, value)
    }
  }
}

function clawChannel(): ClawImChannelV1 {
  const now = '2026-06-01T00:00:00.000Z'
  return {
    id: 'channel-1',
    provider: 'feishu',
    label: 'Feishu Agent',
    enabled: true,
    model: 'auto',
    threadId: 'dragon-channel',
    workspaceRoot: '/Users/zxy/project',
    agentProfile: {
      name: '',
      description: '',
      identity: '',
      personality: '',
      userContext: '',
      replyRules: ''
    },
    conversations: [
      {
        id: 'conversation-1',
        chatId: 'chat-1',
        remoteThreadId: 'remote-1',
        latestMessageId: 'message-1',
        senderId: 'sender-1',
        senderName: 'Alex',
        localThreadId: 'dragon-conversation',
        workspaceRoot: '/Users/zxy/project',
        createdAt: now,
        updatedAt: now
      }
    ],
    createdAt: now,
    updatedAt: now
  }
}

describe('chat-store Claw helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('compacts code workspace roots while excluding write, temporary, and Claw roots', () => {
    expect(
      compactCodeWorkspaceRoots([
        '/Users/zxy/project-a',
        '/Users/zxy/project-a/',
        '/tmp/transient',
        '/Users/zxy/.sinocode/claw/agent/conversations/chat',
        '/Users/zxy/.sinocode/default_workspace',
        '~/.sinocode/write_workspace',
        '',
        '/Users/zxy/project-b'
      ])
    ).toEqual([
      '/Users/zxy/project-a',
      '/Users/zxy/.sinocode/default_workspace',
      '/Users/zxy/project-b'
    ])
  })

  it('deduplicates default workspace aliases', () => {
    expect(
      compactCodeWorkspaceRoots([
        '~/.sinocode/default_workspace',
        'C:\\Users\\zxy\\.sinocode\\default_workspace',
        'C:\\Users\\zxy\\.sinocode\\default_workspace\\'
      ])
    ).toEqual(['~/.sinocode/default_workspace'])
  })

  it('caps code workspace roots while keeping the newest unique roots first', () => {
    const roots = Array.from({ length: MAX_CODE_WORKSPACE_ROOTS + 4 }, (_, index) =>
      `/Users/zxy/project-${index}`
    )

    const compacted = compactCodeWorkspaceRoots([
      roots[0],
      roots[0].toUpperCase(),
      ...roots
    ])

    expect(compacted).toHaveLength(MAX_CODE_WORKSPACE_ROOTS)
    expect(compacted[0]).toBe('/Users/zxy/project-0')
    expect(compacted.at(-1)).toBe(`/Users/zxy/project-${MAX_CODE_WORKSPACE_ROOTS - 1}`)
    expect(compacted).not.toContain(`/Users/zxy/project-${MAX_CODE_WORKSPACE_ROOTS}`)
  })

  it('collects channel and conversation thread ids for Claw sessions', () => {
    const ids = clawThreadIdsFromChannels([clawChannel()])

    expect(ids.has('dragon-channel')).toBe(true)
    expect(ids.has('dragon-conversation')).toBe(true)
  })

  it('uses product default agent names for new Claw channels', () => {
    const feishu = newClawChannel('feishu')
    const weixin = newClawChannel('weixin')

    expect(feishu.label).toBe('feishu agent')
    expect(feishu.agentProfile.name).toBe('feishu agent')
    expect(weixin.label).toBe('weixin agent')
    expect(weixin.agentProfile.name).toBe('weixin agent')
  })

  it('recognizes Claw managed prompt summaries as Claw sessions', () => {
    expect(
      clawThreadTitleLooksManaged(`${CLAW_MANAGED_INSTRUCTIONS_HEADING} Sino Code scheduled-task tools`)
    ).toBe(true)
    expect(isClawThread({ id: 'dragon-leaked', title: '[Claw:Feishu Agent]' })).toBe(true)
  })

  it('recognizes Claw sessions by registered thread id', () => {
    expect(
      isClawThread(
        { id: 'dragon-conversation', title: 'hi' },
        [clawChannel()]
      )
    ).toBe(true)
  })

  it('normalizes and caps persisted turn model labels', () => {
    const raw: Record<string, unknown> = {
      'bad-key': 'bad-model',
      'thread-empty|item-empty': '',
      'thread-number|item-number': 42
    }
    for (let index = 0; index < MAX_TURN_MODEL_LABELS + 5; index += 1) {
      raw[`thread-${index}|item-${index}`] = ` model-${index} `
    }

    const normalized = normalizeTurnModelMap(raw)

    expect(Object.keys(normalized)).toHaveLength(MAX_TURN_MODEL_LABELS)
    expect(normalized['thread-0|item-0']).toBeUndefined()
    expect(normalized['thread-5|item-5']).toBe('model-5')
    expect(normalized['thread-empty|item-empty']).toBeUndefined()
    expect(normalized['thread-number|item-number']).toBeUndefined()
    expect(normalized['bad-key']).toBeUndefined()
  })

  it('persists turn model labels with trimming, pruning, and hydration support', () => {
    const raw: Record<string, string> = {}
    for (let index = 0; index < MAX_TURN_MODEL_LABELS; index += 1) {
      raw[`thread-${index}|item-${index}`] = `model-${index}`
    }
    localStorage.setItem(TURN_MODEL_STORAGE_KEY, JSON.stringify(raw))

    rememberTurnModel(' thread-new ', ' item-new ', ' deepseek-chat ')

    const stored = JSON.parse(localStorage.getItem(TURN_MODEL_STORAGE_KEY) ?? '{}') as Record<string, string>
    expect(Object.keys(stored)).toHaveLength(MAX_TURN_MODEL_LABELS)
    expect(stored['thread-0|item-0']).toBeUndefined()
    expect(stored['thread-new|item-new']).toBe('deepseek-chat')
    expect(
      hydrateBlockModelLabels('thread-new', [
        { kind: 'user', id: 'item-new', text: 'hello' },
        { kind: 'assistant', id: 'assistant-1', text: 'hi' }
      ])
    ).toEqual([
      { kind: 'user', id: 'item-new', text: 'hello', modelLabel: 'deepseek-chat' },
      { kind: 'assistant', id: 'assistant-1', text: 'hi' }
    ])
  })

  it('keeps provider-scoped auto valid only as a composer UI value', () => {
    const providerAuto = providerAutoComposerModelId('custom-provider')
    const groups = [
      {
        providerId: 'custom-provider',
        label: 'Custom Provider',
        modelIds: ['custom-main']
      }
    ]

    expect(providerIdFromComposerAutoModel(providerAuto)).toBe('custom-provider')
    expect(providerIdForComposerModel(providerAuto, groups)).toBe('custom-provider')
    expect(composerRequestModel(providerAuto)).toBe('auto')
    expect(optimisticUserModelLabel(providerAuto, undefined)).toBe('AUTO')
    expect(optimisticUserModelLabel(providerAuto, undefined, groups)).toBe('Custom Provider / AUTO')
    expect(isAllowedComposerModel(providerAuto, ['auto', 'custom-main'], groups)).toBe(true)
    expect(isAllowedComposerModel(providerAuto, ['auto', 'custom-main'], [
      {
        providerId: 'other-provider',
        label: 'Other Provider',
        modelIds: ['custom-main']
      }
    ])).toBe(false)
  })

  it('uses provider and configured model display names for turn labels', () => {
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

    expect(providerIdForComposerModel('glm-5.1', groups)).toBe('zhipu')
    expect(providerIdForComposerModel('auto', groups)).toBeNull()
    expect(composerModelDisplayLabel('glm-5.1', groups)).toBe('Zhipu AI / GLM 5.1')
    expect(composerModelDisplayLabel('glm-flash', groups)).toBe('Zhipu AI / glm-flash')
    expect(modelDisplayNameForModel('glm-5.1', groups)).toBe('GLM 5.1')
    expect(modelDisplayNameForModel('glm-flash', groups)).toBe('glm-flash')
    expect(modelDisplayNameForModel('auto', groups)).toBe('AUTO')
    expect(optimisticUserModelLabel('glm-5.1', undefined, groups)).toBe('Zhipu AI / GLM 5.1')
    expect(optimisticUserModelLabel('', 'auto', groups)).toBe('AUTO')
  })

  it('restores provider-scoped auto from storage only when the provider group still exists', () => {
    const providerAuto = providerAutoComposerModelId('custom-provider')
    localStorage.setItem(COMPOSER_MODEL_STORAGE_KEY, providerAuto)

    expect(readStoredComposerModel(['auto', 'custom-main'], [
      {
        providerId: 'custom-provider',
        label: 'Custom Provider',
        modelIds: ['custom-main']
      }
    ])).toBe(providerAuto)

    expect(readStoredComposerModel(['auto', 'custom-main'], [
      {
        providerId: 'other-provider',
        label: 'Other Provider',
        modelIds: ['custom-main']
      }
    ])).toBe('')
  })
})
