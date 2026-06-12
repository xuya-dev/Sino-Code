import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  defaultDragonRuntimeSettings,
  defaultModelProviderSettings,
  type ModelProviderProfileV1
} from '@shared/app-settings'
import { AgentsSettingsSection } from './settings-section-agents'
import { ProvidersSettingsSection, modelProvidersSettingsPatch } from './settings-section-providers'

const labels: Record<string, string> = {
  agentsQuickBase: 'Base',
  agentsQuickSkill: 'Skills',
  agentsQuickMcp: 'MCP',
  agentsQuickPermissions: 'Permissions',
  agents: 'Runtime',
  runtimeSettings: 'Runtime',
  dragonProvider: 'Provider',
  dragonProviderDesc: 'Provider description',
  modelProviderEndpointFormat: 'Endpoint format',
  modelEndpointChatCompletions: '/v1/chat/completions',
  modelEndpointResponses: '/v1/responses',
  modelEndpointMessages: '/v1/messages',
  endpointFormatChatCompletions: '/v1/chat/completions',
  endpointFormatResponses: '/v1/responses',
  endpointFormatMessages: '/v1/messages',
  dragonApiKey: 'Provider API key',
  dragonApiKeyDesc: 'Provider API key description',
  dragonApiKeyPlaceholder: 'Inherit API key',
  dragonApiKeyInherited: 'Inherited API key',
  dragonApiKeyMissing: 'Missing API key',
  dragonApiKeyOverride: 'Override API key',
  dragonBaseUrl: 'Provider base URL',
  dragonBaseUrlDesc: 'Provider base URL description',
  dragonBaseUrlPlaceholder: 'Inherit base URL',
  dragonBaseUrlOfficial: 'Official base URL',
  dragonBaseUrlInherited: 'Inherited base URL',
  dragonBaseUrlOverride: 'Override base URL',
  dragonAssistantAdvanced: 'Runtime advanced settings',
  dragonAssistantAdvancedDesc: 'Runtime advanced settings description',
  autoStart: 'Auto start',
  autoStartDesc: 'Auto start description',
  port: 'Port',
  portDesc: 'Port description',
  dragonBinary: 'Runtime binary',
  dragonBinaryDesc: 'Runtime binary description',
  dragonBinaryPlaceholder: 'Bundled runtime',
  dragonDataDir: 'Data dir',
  dragonDataDirDesc: 'Data dir description',
  dragonTokenEconomy: 'Token-saving mode',
  dragonTokenEconomyDesc: 'Token-saving mode description',
  dragonTokenEconomySavings: 'Saved {{tokens}} / {{cost}}',
  dragonTokenEconomySavingsLoading: 'Loading savings',
  dragonTokenEconomySavingsEmpty: 'Savings empty',
  dragonTokenEconomyAdvanced: 'Token-saving advanced settings',
  dragonTokenEconomyAdvancedDesc: 'Token-saving advanced settings description',
  dragonTokenEconomyOptions: 'Token-saving options',
  dragonTokenEconomyOptionsDesc: 'Token-saving options description',
  dragonCompressToolDescriptions: 'Compress tool descriptions',
  dragonCompressToolResults: 'Compress tool results',
  dragonConciseResponses: 'Concise responses',
  dragonHistoryHygiene: 'History guard',
  dragonHistoryHygieneDesc: 'History guard description',
  dragonHistoryMaxResultLines: 'Max result lines',
  dragonHistoryMaxResultBytes: 'Max result bytes',
  dragonHistoryMaxResultTokens: 'Max result tokens',
  dragonHistoryMaxArgumentBytes: 'Max argument bytes',
  dragonHistoryMaxArgumentTokens: 'Max argument tokens',
  dragonHistoryMaxArrayItems: 'Max array items',
  runtimeToken: 'Runtime token',
  runtimeTokenDesc: 'Runtime token description',
  showSecret: 'Show',
  hideSecret: 'Hide',
  dragonInsecure: 'Insecure',
  dragonInsecureDesc: 'Insecure description',
  dragonInsecureForcedDesc: 'Insecure forced',
  dragonAdvanced: 'Advanced runtime settings',
  dragonAdvancedDetails: 'Storage, model context, and tool guards',
  dragonAdvancedDetailsDesc: 'Per-model context policy comes from models.profiles',
  dragonStorageBackend: 'Storage backend',
  dragonStorageBackendDesc: 'Storage backend description',
  dragonStorageHybrid: 'Hybrid storage',
  dragonStorageFile: 'Pure JSONL file storage',
  dragonStorageSqlitePath: 'SQLite path',
  dragonStorageSqlitePathDesc: 'SQLite path description',
  dragonStorageSqlitePathPlaceholder: 'Automatic SQLite path',
  dragonModelContextProfile: 'Current model context policy',
  dragonModelContextProfileDesc: 'Current model context policy description',
  dragonModelContextModel: 'Matched model',
  dragonModelContextWindow: 'Context window',
  dragonModelContextSoft: 'Model soft threshold',
  dragonModelContextHard: 'Model hard threshold',
  dragonModelContextSourceConfigured: 'Configured model details',
  dragonModelContextSourceFallback: 'Fallback model config',
  dragonCompactionThresholds: 'Fallback compaction thresholds',
  dragonCompactionThresholdsDesc: 'Fallback compaction thresholds description',
  dragonCompactionSoftThreshold: 'Fallback soft threshold',
  dragonCompactionHardThreshold: 'Fallback hard threshold',
  dragonCompactionSummary: 'Compaction summary',
  dragonCompactionSummaryDesc: 'Compaction summary description',
  dragonCompactionSummaryMode: 'Summary mode',
  dragonCompactionSummaryHeuristic: 'Heuristic summary',
  dragonCompactionSummaryModel: 'Model summary',
  dragonCompactionSummaryTimeout: 'Summary timeout',
  dragonCompactionSummaryMaxTokens: 'Summary max tokens',
  dragonCompactionSummaryInputBytes: 'Summary input bytes',
  dragonToolStorm: 'Tool storm',
  dragonToolStormDesc: 'Tool storm description',
  dragonToolStormLimits: 'Tool storm limits',
  dragonToolStormLimitsDesc: 'Tool storm limits description',
  dragonToolStormWindowSize: 'Tool storm window',
  dragonToolStormThreshold: 'Tool storm threshold',
  dragonToolArgumentRepair: 'Tool argument repair',
  dragonToolArgumentRepairDesc: 'Tool argument repair description',
  dragonDiagnostics: 'Runtime status',
  dragonDiagnosticsAdvanced: 'Detailed diagnostics',
  dragonDiagnosticsAdvancedDesc: 'Detailed diagnostics description',
  dragonRuntimeCapabilities: 'Runtime capabilities',
  dragonRuntimeCapabilitiesDesc: 'Runtime capabilities description',
  dragonRuntimeModel: 'Current model',
  dragonRuntimeModelUnset: 'Not configured',
  dragonRuntimePid: 'Runtime PID',
  dragonDiagnosticsRefresh: 'Refresh diagnostics',
  dragonToolDiagnostics: 'Tool diagnostics',
  dragonToolDiagnosticsDesc: 'Tool diagnostics description',
  dragonDiagnosticsProviders: 'Providers',
  dragonDiagnosticsMcpServers: 'MCP servers',
  dragonDiagnosticsSkills: 'Discovered Skills',
  dragonDiagnosticsAttachments: 'Attachments',
  dragonMemoryRecords: 'Memory records',
  dragonMemoryRecordsDesc: 'Memory records description',
  dragonMemoryEmpty: 'No memories',
  dragonMemoryDisable: 'Disable memory',
  dragonMemoryDelete: 'Delete memory',
  dragonMemoryDisabled: 'Disabled',
  skill: 'Skill',
  skillsLocation: 'Skill location',
  skillsLocationDesc: 'Skill location description',
  skillsPath: 'Skills path',
  skillsPathDesc: 'Skills path description',
  skillsRootUnavailable: 'Unavailable',
  skillsScanDirs: 'Scan dirs',
  skillsScanDirsDesc: 'Scan dirs description',
  skillsActions: 'Skill actions',
  skillsActionsDesc: 'Skill actions description',
  skillsOpenRoot: 'Open root',
  skillsOpenPlugins: 'Open plugins',
  mcp: 'MCP',
  mcpSearchEnabled: 'MCP search enabled',
  mcpSearchEnabledDesc: 'MCP search description',
  mcpAdvanced: 'MCP advanced settings',
  mcpAdvancedDesc: 'MCP advanced settings description',
  mcpSearchMode: 'MCP search mode',
  mcpSearchModeDesc: 'MCP search mode description',
  mcpSearchModeAuto: 'Auto mode',
  mcpSearchModeSearch: 'Search mode',
  mcpSearchModeDirect: 'Direct mode',
  mcpSearchLimits: 'MCP search limits',
  mcpSearchLimitsDesc: 'MCP search limits description',
  mcpSearchAutoThreshold: 'Auto threshold',
  mcpSearchTopKDefault: 'Default results',
  mcpSearchTopKMax: 'Max results',
  mcpSearchMinScore: 'Minimum score',
  mcpSearchDiagnostics: 'MCP search diagnostics',
  mcpSearchDiagnosticsDesc: 'MCP search diagnostics description',
  mcpSearchStatus: 'MCP search status',
  mcpSearchActive: 'Active',
  mcpSearchInactive: 'Inactive',
  mcpSearchIndexed: 'Indexed',
  mcpSearchAdvertised: 'Advertised',
  configFilePath: 'External tool config path',
  mcpPathDesc: 'MCP JSON path description',
  mcpEditor: 'MCP editor',
  mcpEditorDesc: 'Model and API credentials do not live in this MCP file',
  mcpFileStatusReady: 'MCP config ready',
  mcpFileStatusMissing: 'MCP config missing',
  loading: 'Loading',
  mcpActions: 'MCP actions',
  mcpRuntimeHint: 'MCP runtime hint',
  mcpSave: 'Save MCP config',
  mcpReload: 'Reload MCP config',
  mcpOpenDir: 'Open MCP directory',
  permissions: 'Permissions',
  approvalPolicy: 'Approval policy',
  approvalPolicyDesc: 'Approval policy description',
  approvalAuto: 'Auto',
  approvalOnRequest: 'On request',
  approvalUntrusted: 'Untrusted',
  approvalSuggest: 'Suggest',
  approvalNever: 'Never',
  sandboxMode: 'Sandbox mode',
  sandboxModeDesc: 'Sandbox description',
  sandboxWorkspaceWrite: 'Workspace write',
  sandboxReadOnly: 'Read only',
  sandboxFullAccess: 'Full access',
  sandboxExternal: 'External sandbox'
}

function t(key: string): string {
  return labels[key] ?? key
}

function baseCtx(): Record<string, unknown> {
  const noop = () => undefined
  const asyncNoop = async () => undefined
  const ref = { current: null }
  const dragon = {
    ...defaultDragonRuntimeSettings(),
    autoStart: true,
    runtimeToken: '',
    insecure: true
  }
  return {
    t,
    tCommon: t,
    form: { claw: { skills: { extraDirs: ['/tmp/project/.agents/skills'] } } },
    dragon,
    activeApiKey: '',
    update: noop,
    updateDragon: noop,
    updateSharedCredential: noop,
    sharedApiKey: '',
    sharedBaseUrl: '',
    showApiKey: false,
    setShowApiKey: noop,
    showRuntimeToken: false,
    setShowRuntimeToken: noop,
    portError: '',
    locale: 'en',
    openOnboardingPreview: noop,
    pickWorkspace: asyncNoop,
    resetWorkspaceToDefault: noop,
    workspacePickerError: '',
    guiUpdateInfo: null,
    checkingGuiUpdate: false,
    downloadingGuiUpdate: false,
    installingGuiUpdate: false,
    guiUpdateDownloaded: false,
    guiUpdateProgress: null,
    guiUpdateError: null,
    checkGuiUpdate: asyncNoop,
    downloadGuiUpdate: asyncNoop,
    installGuiUpdate: asyncNoop,
    logPath: '',
    logDirOpenError: '',
    setLogDirOpenError: noop,
    pickWriteWorkspace: asyncNoop,
    resetWriteWorkspaceToDefault: noop,
    writeWorkspacePickerError: '',
    writeInlineBaseUrlInherited: false,
    effectiveWriteInlineBaseUrl: '',
    writeInlineModelInherited: false,
    effectiveWriteInlineModel: '',
    setWriteDebugModalOpen: noop,
    loadWriteDebugEntries: asyncNoop,
    scrollToAgentSection: noop,
    agentsSectionRef: ref,
    skillSectionRef: ref,
    mcpSectionRef: ref,
    permissionsSectionRef: ref,
    selectedSkillRoot: {
      id: 'workspace',
      label: 'Workspace',
      path: '/tmp/project/.agents/skills',
      available: true
    },
    skillRootOptions: [
      {
        id: 'workspace',
        label: 'Workspace',
        path: '/tmp/project/.agents/skills',
        available: true
      }
    ],
    skillRootId: 'workspace',
    setSkillRootId: noop,
    skillNotice: null,
    openSkillRoot: asyncNoop,
    openPlugins: noop,
    mcpConfigPath: '/tmp/project/.dragon/mcp.json',
    mcpConfigExists: true,
    mcpConfigText: '{"mcpServers":{}}',
    setMcpConfigText: noop,
    mcpLoading: false,
    mcpBusy: false,
    mcpNotice: null,
    saveMcpConfig: asyncNoop,
    loadMcpConfig: asyncNoop,
    openMcpConfigDir: asyncNoop,
    runtimeInfo: null,
    toolDiagnostics: null,
    memoryRecords: [],
    runtimeDiagnosticsBusy: false,
    runtimeDiagnosticsNotice: null,
    refreshDragonDiagnostics: asyncNoop,
    disableMemoryRecord: asyncNoop,
    deleteMemoryRecord: asyncNoop,
    pickClawWorkspace: asyncNoop,
    resetClawWorkspaceToDefault: noop,
    clawWorkspacePickerError: '',
    splitSettingsList: (value: string) => value.split('\n').filter(Boolean),
    listSettingsText: (value: string[]) => value.join('\n')
  }
}

describe('AgentsSettingsSection runtime diagnostics smoke', () => {
  it('builds a single patch when adding and selecting a model provider', () => {
    const provider = defaultModelProviderSettings()
    const customProvider = {
      id: 'custom-provider-2',
      name: 'Custom Provider',
      apiKey: '',
      baseUrl: 'https://api.example.com/v1',
      endpointFormat: 'responses',
      models: []
    } satisfies ModelProviderProfileV1

    const patch = modelProvidersSettingsPatch({
      provider,
      providers: [...provider.providers, customProvider],
      dragon: { providerId: customProvider.id }
    })

    expect(patch.provider?.providers).toEqual([...provider.providers, customProvider])
    expect(patch.agents?.dragon?.providerId).toBe(customProvider.id)
  })

  it('keeps selected auto route models in the provider patch', () => {
    const provider = defaultModelProviderSettings()
    const customProvider = {
      id: 'custom-provider-2',
      name: 'Custom Provider',
      apiKey: '',
      baseUrl: 'https://api.example.com/v1',
      endpointFormat: 'responses',
      models: ['main-model', 'fast-model'],
      mainModelId: 'main-model',
      fastModelId: 'fast-model'
    } satisfies ModelProviderProfileV1

    const patch = modelProvidersSettingsPatch({
      provider,
      providers: [customProvider],
      dragon: { providerId: customProvider.id }
    })

    expect(patch.provider?.providers?.[0]).toMatchObject({
      id: 'custom-provider-2',
      mainModelId: 'main-model',
      fastModelId: 'fast-model'
    })
  })

  it('builds a single patch when removing the active model provider', () => {
    const provider = defaultModelProviderSettings()

    const patch = modelProvidersSettingsPatch({
      provider: {
        ...provider,
        providers: [
          ...provider.providers,
          {
            id: 'custom-provider-2',
            name: 'Custom Provider',
            apiKey: '',
            baseUrl: 'https://api.example.com/v1',
            endpointFormat: 'responses',
            models: []
          }
        ]
      },
      providers: provider.providers,
      dragon: { providerId: '' }
    })

    expect(patch.provider?.providers).toEqual(provider.providers)
    expect(patch.agents?.dragon?.providerId).toBe('')
  })

  it('renders custom model provider id as editable', () => {
    const provider = defaultModelProviderSettings()
    const customProvider = {
      id: 'custom-provider-2',
      name: 'Custom Provider',
      apiKey: '',
      baseUrl: 'https://api.example.com/v1',
      endpointFormat: 'messages',
      models: []
    } satisfies ModelProviderProfileV1
    const html = renderToStaticMarkup(createElement(ProvidersSettingsSection, {
      ctx: {
        ...baseCtx(),
        provider: {
          ...provider,
          providers: [...provider.providers, customProvider]
        },
        dragon: {
          ...defaultDragonRuntimeSettings(),
          providerId: customProvider.id
        }
      }
    }))
    const providerIdInput = html.match(/<input[^>]+value="custom-provider-2"[^>]*>/)?.[0]

    expect(providerIdInput).toBeTruthy()
    expect(providerIdInput).not.toContain('readOnly')
    expect(providerIdInput).not.toContain('readonly')
    expect(html).toContain('Endpoint format')
    expect(html).toContain('/v1/messages')
    expect(html).toContain('aria-haspopup="listbox"')
  })

  it('keeps advanced agent controls behind collapsed disclosures', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).toContain('Runtime advanced settings')
    expect(html).not.toContain('Model description')
    expect(html).toContain('Token-saving advanced settings')
    expect(html).toContain('MCP advanced settings')
    expect(html).not.toContain('<details open')
  })

  it('renders pure JSONL as a selectable storage backend', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).toContain('Storage backend')
    expect(html).toContain('Hybrid storage')
    expect(html).toContain('aria-haspopup="listbox"')
    expect(html).not.toContain('<select')
  })

  it('uses fallback compaction thresholds when the provider model has no max context', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).toContain('Current model context policy')
    expect(html).toContain('Not configured')
    expect(html).toContain('Fallback model config')
    expect(html).toContain('Fallback compaction thresholds')
  })

  it('shows configured provider max context when the model detail defines it', () => {
    const provider = defaultModelProviderSettings()
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, {
      ctx: {
        ...baseCtx(),
        form: {
          claw: { skills: { extraDirs: ['/tmp/project/.agents/skills'] } },
          provider: {
            ...provider,
            providers: [{
              id: 'zhipu',
              name: 'Zhipu',
              apiKey: '',
              baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
              endpointFormat: 'chat_completions',
              models: ['glm-4.6'],
              modelDetails: {
                'glm-4.6': {
                  id: 'glm-4.6',
                  maxContext: 128000
                }
              }
            }]
          }
        },
        dragon: {
          ...defaultDragonRuntimeSettings(),
          providerId: 'zhipu',
          model: 'glm-4.6'
        }
      }
    }))

    expect(html).toContain('Configured model details')
    expect(html).toContain('128,000')
    expect(html).toContain('125,440')
    expect(html).toContain('126,720')
  })

  it('uses the selected provider route model for context when the runtime model is stale', () => {
    const provider = defaultModelProviderSettings()
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, {
      ctx: {
        ...baseCtx(),
        form: {
          claw: { skills: { extraDirs: ['/tmp/project/.agents/skills'] } },
          provider: {
            ...provider,
            providers: [{
              id: 'zhipu',
              name: 'Zhipu',
              apiKey: '',
              baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
              endpointFormat: 'chat_completions',
              models: ['glm-5.1'],
              mainModelId: 'glm-5.1',
              modelDetails: {
                'glm-5.1': {
                  id: 'glm-5.1',
                  name: 'GLM 5.1',
                  maxContext: 128000
                }
              }
            }]
          }
        },
        dragon: {
          ...defaultDragonRuntimeSettings(),
          providerId: 'zhipu',
          model: 'deepseek-v4-pro'
        }
      }
    }))

    expect(html).toContain('GLM 5.1')
    expect(html).toContain('128,000')
    expect(html).not.toContain('deepseek-v4-pro')
  })

  it('renders MCP, Skill, web, attachment, and memory diagnostics', () => {
    const provider = defaultModelProviderSettings()
    const ctx = {
      ...baseCtx(),
      form: {
        claw: { skills: { extraDirs: ['/tmp/project/.agents/skills'] } },
        provider: {
          ...provider,
          providers: [{
            id: 'zhipu',
            name: 'Zhipu AI',
            apiKey: 'sk-zhipu',
            baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
            endpointFormat: 'chat_completions',
            models: ['glm-5.1'],
            mainModelId: 'glm-5.1',
            modelDetails: {
              'glm-5.1': {
                id: 'glm-5.1',
                name: 'GLM 5.1'
              }
            }
          }]
        }
      },
      dragon: {
        ...defaultDragonRuntimeSettings(),
        providerId: 'zhipu',
        model: 'glm-5.1'
      },
      runtimeInfo: {
        pid: 123,
        capabilities: {
          model: { id: 'deepseek-v4-pro' },
          mcp: { status: 'available', configuredServers: 2, connectedServers: 2 },
          web: { status: 'available', provider: 'brave-search' },
          skills: { status: 'available' },
          subagents: { status: 'available' },
          attachments: { status: 'available' },
          memory: { status: 'available' }
        }
      },
      toolDiagnostics: {
        providers: [{ id: 'builtin' }, { id: 'mcp' }, { id: 'web' }, { id: 'memory' }],
        mcpServers: [{ id: 'github' }],
        skills: { skills: [{ id: 'skill_docs' }] },
        attachments: { count: 1 }
      },
      memoryRecords: [
        {
          id: 'mem_1',
          content: 'Prefer pnpm for this workspace',
          scope: 'workspace',
          tags: ['tooling']
        }
      ]
    }

    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx }))

    expect(html).toContain('Runtime status')
    expect(html).toContain('MCP')
    expect(html).toContain('available')
    expect(html).toContain('GLM 5.1')
    expect(html).not.toContain('deepseek-v4-pro')
    expect(html).toContain('2/2')
    expect(html).toContain('brave-search')
    expect(html).toContain('Providers')
    expect(html).toContain('MCP servers')
    expect(html).toContain('Discovered Skills')
    expect(html).toContain('Prefer pnpm for this workspace')
    expect(html).toContain('mem_1')
    expect(html).toContain('Disable memory')
    expect(html).toContain('Delete memory')
  })

  it('shows the runtime model as not configured when no provider model can be resolved', () => {
    const ctx = {
      ...baseCtx(),
      runtimeInfo: {
        pid: 123,
        capabilities: {
          model: { id: 'deepseek-v4-pro' }
        }
      }
    }

    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx }))

    expect(html).toContain('Not configured')
    expect(html).not.toContain('deepseek-v4-pro')
  })

  it('describes MCP config as an external-tool JSON file instead of model credentials', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).toContain('External tool config path')
    expect(html).toContain('/tmp/project/.dragon/mcp.json')
    expect(html).toContain('Model and API credentials do not live in this MCP file')
    expect(html).not.toContain('DeepSeek auth')
    expect(html).not.toContain('Base URL are stored in this file')
    expect(html).not.toContain('config.toml')
  })
})
