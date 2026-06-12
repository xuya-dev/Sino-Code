import {
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_DRAGON_DATA_DIR,
  DEFAULT_DRAGON_MODEL,
  DEFAULT_DRAGON_PORT,
  DEFAULT_MODEL_ENDPOINT_FORMAT,
  DEFAULT_SANDBOX_MODE,
  type AppSettingsV1,
  type DragonContextCompactionSettingsV1,
  type DragonHistoryHygieneSettingsV1,
  type DragonMcpSearchSettingsV1,
  type DragonRuntimeTuningSettingsV1,
  type DragonRuntimeSettingsPatchV1,
  type DragonRuntimeSettingsV1,
  type DragonSettingsEnvelopePatchV1,
  type DragonSettingsEnvelopeV1,
  type DragonStorageSettingsV1,
  type DragonTokenEconomySettingsV1,
  type ModelProviderSettingsV1,
  type ApprovalPolicy,
  type SandboxMode
} from './app-settings-types'
import {
  normalizeModelProviderSettings,
  resolveDragonRuntimeSettings
} from './app-settings-provider'

const LEGACY_COREAGENT_DATA_DIR = '~/.sinocode/coreagent'
const LEGACY_DRAGON_DEFAULT_MODEL = 'deepseek-chat'
const LEGACY_LOCAL_HTTP_DEFAULT_PORT = 7878

type LegacyLocalHttpRuntimeSettingsV1 = {
  binaryPath: string
  port: number
  autoStart: boolean
  apiKey: string
  baseUrl: string
  runtimeToken: string
  extraCorsOrigins: string[]
  approvalPolicy: ApprovalPolicy
  sandboxMode: SandboxMode
}

type LegacyReasoningEffort = 'low' | 'medium' | 'high' | 'max'
type LegacyReasoningEditMode = 'review' | 'auto' | 'yolo' | 'plan'

type LegacyReasoningRuntimeSettingsV1 = {
  binaryPath: string
  autoStart: boolean
  apiKey: string
  baseUrl: string
  model: string
  reasoningEffort: LegacyReasoningEffort
  editMode: LegacyReasoningEditMode
}

/**
 * Dragon runtime settings. Mirrors the `dragon serve` CLI
 * options. It is the only active agent settings object the GUI
 * stores after legacy settings have been migrated.
 */
function legacyLocalHttpRuntimeDefaults(port = 7878): LegacyLocalHttpRuntimeSettingsV1 {
  return {
    binaryPath: '',
    port,
    autoStart: true,
    apiKey: '',
    baseUrl: '',
    runtimeToken: '',
    extraCorsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
    sandboxMode: DEFAULT_SANDBOX_MODE
  }
}

function legacyReasoningRuntimeDefaults(): LegacyReasoningRuntimeSettingsV1 {
  return {
    binaryPath: '',
    autoStart: true,
    apiKey: '',
    baseUrl: '',
    model: LEGACY_DRAGON_DEFAULT_MODEL,
    reasoningEffort: 'medium',
    editMode: 'auto'
  }
}

export function defaultDragonRuntimeSettings(
  port = DEFAULT_DRAGON_PORT
): DragonRuntimeSettingsV1 {
  return {
    binaryPath: '',
    port,
    autoStart: true,
    apiKey: '',
    baseUrl: '',
    providerId: '',
    endpointFormat: DEFAULT_MODEL_ENDPOINT_FORMAT,
    runtimeToken: '',
    dataDir: DEFAULT_DRAGON_DATA_DIR,
    model: DEFAULT_DRAGON_MODEL,
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
    sandboxMode: DEFAULT_SANDBOX_MODE,
    tokenEconomyMode: false,
    tokenEconomy: defaultDragonTokenEconomySettings(),
    insecure: false,
    mcpSearch: defaultDragonMcpSearchSettings(),
    storage: defaultDragonStorageSettings(),
    contextCompaction: defaultDragonContextCompactionSettings(),
    runtimeTuning: defaultDragonRuntimeTuningSettings()
  }
}

export function defaultDragonMcpSearchSettings(): DragonMcpSearchSettingsV1 {
  return {
    enabled: false,
    mode: 'auto',
    autoThresholdToolCount: 24,
    topKDefault: 5,
    topKMax: 10,
    minScore: 0.15
  }
}

export function defaultDragonTokenEconomySettings(): DragonTokenEconomySettingsV1 {
  return {
    enabled: false,
    compressToolDescriptions: true,
    compressToolResults: true,
    conciseResponses: true,
    historyHygiene: defaultDragonHistoryHygieneSettings()
  }
}

export function defaultDragonHistoryHygieneSettings(): DragonHistoryHygieneSettingsV1 {
  return {
    maxToolResultLines: 320,
    maxToolResultBytes: 32 * 1024,
    maxToolResultTokens: 8_000,
    maxToolArgumentStringBytes: 8 * 1024,
    maxToolArgumentStringTokens: 2_000,
    maxArrayItems: 80
  }
}

export function defaultDragonStorageSettings(): DragonStorageSettingsV1 {
  return {
    backend: 'hybrid',
    sqlitePath: ''
  }
}

export function defaultDragonContextCompactionSettings(): DragonContextCompactionSettingsV1 {
  return {
    defaultSoftThreshold: 16_000,
    defaultHardThreshold: 24_000,
    summaryMode: 'heuristic',
    summaryTimeoutMs: 15_000,
    summaryMaxTokens: 1_200,
    summaryInputMaxBytes: 96 * 1024
  }
}

export function defaultDragonRuntimeTuningSettings(): DragonRuntimeTuningSettingsV1 {
  return {
    toolStorm: {
      enabled: true,
      windowSize: 8,
      threshold: 3
    },
    toolArgumentRepair: {
      maxStringBytes: 512 * 1024
    }
  }
}

export function getDragonRuntimeSettings(
  settings: AppSettingsV1
): DragonRuntimeSettingsV1 {
  const raw = (settings as { agents?: { dragon?: Partial<DragonRuntimeSettingsV1> } }).agents?.dragon
  return mergeDragonRuntimeSettings(defaultDragonRuntimeSettings(), raw)
}

export function dragonSettingsEnvelope(
  dragon: DragonRuntimeSettingsV1
): DragonSettingsEnvelopeV1 {
  return { dragon }
}

export function dragonSettingsPatch(
  dragon: DragonRuntimeSettingsPatchV1 | undefined
): DragonSettingsEnvelopePatchV1 {
  return dragon ? { dragon } : {}
}

export function mergeDragonRuntimeSettings(
  current: DragonRuntimeSettingsV1,
  patch: DragonRuntimeSettingsPatchV1 | undefined
): DragonRuntimeSettingsV1 {
  const currentMcpSearch = normalizeDragonMcpSearchSettings(current.mcpSearch)
  const nextMcpSearch = normalizeDragonMcpSearchSettings({
    ...currentMcpSearch,
    ...(patch?.mcpSearch ?? {})
  })
  const currentTokenEconomy = normalizeDragonTokenEconomySettings(
    current.tokenEconomy,
    current.tokenEconomyMode
  )
  const patchedTokenEconomy = normalizeDragonTokenEconomySettings({
    ...currentTokenEconomy,
    ...(patch?.tokenEconomy ?? {}),
    historyHygiene: {
      ...currentTokenEconomy.historyHygiene,
      ...(patch?.tokenEconomy?.historyHygiene ?? {})
    }
  }, currentTokenEconomy.enabled)
  const tokenEconomyEnabled = typeof patch?.tokenEconomy?.enabled === 'boolean'
    ? patch.tokenEconomy.enabled
    : typeof patch?.tokenEconomyMode === 'boolean'
      ? patch.tokenEconomyMode
      : patchedTokenEconomy.enabled
  const nextTokenEconomy = {
    ...patchedTokenEconomy,
    enabled: tokenEconomyEnabled
  }
  const currentStorage = normalizeDragonStorageSettings(current.storage)
  const nextStorage = normalizeDragonStorageSettings({
    ...currentStorage,
    ...(patch?.storage ?? {})
  })
  const currentContextCompaction = normalizeDragonContextCompactionSettings(current.contextCompaction)
  const nextContextCompaction = normalizeDragonContextCompactionSettings({
    ...currentContextCompaction,
    ...(patch?.contextCompaction ?? {})
  })
  const currentRuntimeTuning = normalizeDragonRuntimeTuningSettings(current.runtimeTuning)
  const nextRuntimeTuning = normalizeDragonRuntimeTuningSettings({
    ...currentRuntimeTuning,
    ...(patch?.runtimeTuning
      ? {
          toolStorm: {
            ...currentRuntimeTuning.toolStorm,
            ...(patch.runtimeTuning.toolStorm ?? {})
          },
          toolArgumentRepair: {
            ...currentRuntimeTuning.toolArgumentRepair,
            ...(patch.runtimeTuning.toolArgumentRepair ?? {})
          }
        }
      : {})
  })
  return {
    ...current,
    ...(patch ?? {}),
    tokenEconomyMode: nextTokenEconomy.enabled,
    tokenEconomy: nextTokenEconomy,
    mcpSearch: nextMcpSearch,
    storage: nextStorage,
    contextCompaction: nextContextCompaction,
    runtimeTuning: nextRuntimeTuning
  }
}

function normalizeDragonTokenEconomySettings(
  input: Partial<DragonTokenEconomySettingsV1> | undefined,
  enabledFallback = false
): DragonTokenEconomySettingsV1 {
  return {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : enabledFallback,
    compressToolDescriptions: input?.compressToolDescriptions !== false,
    compressToolResults: input?.compressToolResults !== false,
    conciseResponses: input?.conciseResponses !== false,
    historyHygiene: normalizeDragonHistoryHygieneSettings(input?.historyHygiene)
  }
}

function normalizeDragonHistoryHygieneSettings(
  input: Partial<DragonHistoryHygieneSettingsV1> | undefined
): DragonHistoryHygieneSettingsV1 {
  const defaults = defaultDragonHistoryHygieneSettings()
  return {
    maxToolResultLines: boundedPositiveInt(input?.maxToolResultLines, defaults.maxToolResultLines, 100_000),
    maxToolResultBytes: boundedPositiveInt(input?.maxToolResultBytes, defaults.maxToolResultBytes, 8 * 1024 * 1024),
    maxToolResultTokens: boundedPositiveInt(input?.maxToolResultTokens, defaults.maxToolResultTokens, 256_000),
    maxToolArgumentStringBytes: boundedPositiveInt(
      input?.maxToolArgumentStringBytes,
      defaults.maxToolArgumentStringBytes,
      8 * 1024 * 1024
    ),
    maxToolArgumentStringTokens: boundedPositiveInt(
      input?.maxToolArgumentStringTokens,
      defaults.maxToolArgumentStringTokens,
      64_000
    ),
    maxArrayItems: boundedPositiveInt(input?.maxArrayItems, defaults.maxArrayItems, 10_000)
  }
}

function normalizeDragonMcpSearchSettings(
  input: Partial<DragonMcpSearchSettingsV1> | undefined
): DragonMcpSearchSettingsV1 {
  const defaults = defaultDragonMcpSearchSettings()
  const topKMax = positiveInt(input?.topKMax, defaults.topKMax)
  const topKDefault = Math.min(positiveInt(input?.topKDefault, defaults.topKDefault), topKMax)
  return {
    enabled: input?.enabled === true,
    mode: input?.mode === 'direct' || input?.mode === 'search' || input?.mode === 'auto'
      ? input.mode
      : defaults.mode,
    autoThresholdToolCount: positiveInt(input?.autoThresholdToolCount, defaults.autoThresholdToolCount),
    topKDefault,
    topKMax,
    minScore: nonNegativeNumber(input?.minScore, defaults.minScore)
  }
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

function boundedPositiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback
  return Math.min(Math.floor(value), max)
}

function normalizeDragonStorageSettings(
  input: Partial<DragonStorageSettingsV1> | undefined
): DragonStorageSettingsV1 {
  const defaults = defaultDragonStorageSettings()
  return {
    backend: input?.backend === 'file' || input?.backend === 'hybrid'
      ? input.backend
      : defaults.backend,
    sqlitePath: typeof input?.sqlitePath === 'string' ? input.sqlitePath.trim() : defaults.sqlitePath
  }
}

function normalizeDragonContextCompactionSettings(
  input: Partial<DragonContextCompactionSettingsV1> | undefined
): DragonContextCompactionSettingsV1 {
  const defaults = defaultDragonContextCompactionSettings()
  const defaultSoftThreshold = boundedPositiveInt(input?.defaultSoftThreshold, defaults.defaultSoftThreshold)
  const requestedHardThreshold = boundedPositiveInt(input?.defaultHardThreshold, defaults.defaultHardThreshold)
  return {
    defaultSoftThreshold,
    defaultHardThreshold: Math.max(defaultSoftThreshold, requestedHardThreshold),
    summaryMode: input?.summaryMode === 'model' || input?.summaryMode === 'heuristic'
      ? input.summaryMode
      : defaults.summaryMode,
    summaryTimeoutMs: boundedPositiveInt(input?.summaryTimeoutMs, defaults.summaryTimeoutMs, 120_000),
    summaryMaxTokens: boundedPositiveInt(input?.summaryMaxTokens, defaults.summaryMaxTokens, 16_000),
    summaryInputMaxBytes: boundedPositiveInt(input?.summaryInputMaxBytes, defaults.summaryInputMaxBytes, 8 * 1024 * 1024)
  }
}

function normalizeDragonRuntimeTuningSettings(
  input: Partial<DragonRuntimeTuningSettingsV1> | undefined
): DragonRuntimeTuningSettingsV1 {
  const defaults = defaultDragonRuntimeTuningSettings()
  return {
    toolStorm: {
      enabled: input?.toolStorm?.enabled !== false,
      windowSize: boundedPositiveInt(input?.toolStorm?.windowSize, defaults.toolStorm.windowSize, 128),
      threshold: Math.max(2, boundedPositiveInt(input?.toolStorm?.threshold, defaults.toolStorm.threshold, 128))
    },
    toolArgumentRepair: {
      maxStringBytes: boundedPositiveInt(
        input?.toolArgumentRepair?.maxStringBytes,
        defaults.toolArgumentRepair.maxStringBytes,
        16 * 1024 * 1024
      )
    }
  }
}

export function withDragonRuntimeSettings(
  settings: AppSettingsV1,
  dragon: DragonRuntimeSettingsV1
): AppSettingsV1 {
  return {
    ...settings,
    agents: dragonSettingsEnvelope(dragon)
  }
}

export function applyDragonRuntimePatch(
  settings: AppSettingsV1,
  patch: DragonRuntimeSettingsPatchV1 | undefined
): AppSettingsV1 {
  return withDragonRuntimeSettings(
    settings,
    mergeDragonRuntimeSettings(getDragonRuntimeSettings(settings), patch)
  )
}

export function isDragonRuntimeInsecure(runtime: Pick<DragonRuntimeSettingsV1, 'insecure' | 'runtimeToken'>): boolean {
  return runtime.insecure || !runtime.runtimeToken.trim()
}

export function getActiveAgentApiKey(settings: AppSettingsV1): string {
  return resolveDragonRuntimeSettings(settings).apiKey?.trim() ?? ''
}

export function getActiveAgentBaseUrl(settings: AppSettingsV1): string {
  return resolveDragonRuntimeSettings(settings).baseUrl?.trim() ?? ''
}

export function mergeAgentRuntimeSettings(
  defaults: DragonSettingsEnvelopeV1,
  patch: DragonSettingsEnvelopePatchV1 | undefined
): DragonSettingsEnvelopeV1 {
  return dragonSettingsEnvelope(
    mergeDragonRuntimeSettings(defaults.dragon, patch?.dragon)
  )
}

type LegacyAgentsSettingsShape = {
  dragon?: Partial<DragonRuntimeSettingsV1>
  codewhale?: Partial<LegacyLocalHttpRuntimeSettingsV1>
  reasonix?: Partial<LegacyReasoningRuntimeSettingsV1>
}

type LegacyAppSettingsShape = Partial<Omit<AppSettingsV1, 'agents' | 'provider'>> & {
  agents?: LegacyAgentsSettingsShape
  provider?: Partial<ModelProviderSettingsV1>
  deepseek?: Partial<LegacyLocalHttpRuntimeSettingsV1>
  /** Legacy single-provider discriminator. Read only inside migration. */
  agentProvider?: unknown
}

function nonEmptyStringOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function upgradeLegacyDragonDefaultDataDir(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_DRAGON_DATA_DIR
  const trimmed = value.trim()
  const normalized = trimmed.replace(/\\/g, '/').toLowerCase()
  if (
    !trimmed ||
    normalized === LEGACY_COREAGENT_DATA_DIR ||
    normalized.endsWith('/.sinocode/coreagent')
  ) {
    return DEFAULT_DRAGON_DATA_DIR
  }
  return trimmed
}

function upgradeLegacyDragonDefaultModel(value: unknown, fallback: string): string {
  const model = nonEmptyStringOrFallback(value, fallback).trim()
  return model === LEGACY_DRAGON_DEFAULT_MODEL ? '' : model
}

function upgradeLegacyDragonDefaultPort(value: unknown, fallback: number): number {
  return value === LEGACY_LOCAL_HTTP_DEFAULT_PORT ? DEFAULT_DRAGON_PORT : fallback
}

export function migrateLegacyAppSettings(parsed: LegacyAppSettingsShape): Partial<AppSettingsV1> {
  const rawAgentProvider = parsed.agentProvider
  const isReasoningLegacy = rawAgentProvider === 'reasonix'
  const hasProviderSettings = typeof parsed.provider === 'object' && parsed.provider !== null
  const defaults = legacyLocalHttpRuntimeDefaults()
  const dragonDefaults = defaultDragonRuntimeSettings()
  const legacyDeepseek = parsed.deepseek ?? {}
  const legacyLocalHttp = {
    ...defaults,
    ...(parsed.agents?.codewhale ?? {}),
    ...legacyDeepseek
  }
  const legacyReasoning = {
    ...legacyReasoningRuntimeDefaults(),
    ...(parsed.agents?.reasonix ?? {})
  }
  const explicitDragon: Partial<DragonRuntimeSettingsV1> = parsed.agents?.dragon ?? {}
  const legacySource = isReasoningLegacy ? legacyReasoning : legacyLocalHttp
  const legacySeed = {
    binaryPath: dragonDefaults.binaryPath,
    port: isReasoningLegacy
      ? dragonDefaults.port
      : upgradeLegacyDragonDefaultPort(legacyLocalHttp.port, legacyLocalHttp.port),
    autoStart: isReasoningLegacy ? legacyReasoning.autoStart : legacyLocalHttp.autoStart,
    apiKey: legacySource.apiKey,
    baseUrl: legacySource.baseUrl,
    providerId: '',
    endpointFormat: DEFAULT_MODEL_ENDPOINT_FORMAT,
    runtimeToken: isReasoningLegacy ? dragonDefaults.runtimeToken : legacyLocalHttp.runtimeToken,
    model: isReasoningLegacy ? legacyReasoning.model : dragonDefaults.model,
    approvalPolicy: isReasoningLegacy ? dragonDefaults.approvalPolicy : legacyLocalHttp.approvalPolicy,
    sandboxMode: isReasoningLegacy ? dragonDefaults.sandboxMode : legacyLocalHttp.sandboxMode
  }
  const provider = normalizeModelProviderSettings({
    apiKey: hasProviderSettings
      ? parsed.provider?.apiKey
      : nonEmptyStringOrFallback(explicitDragon.apiKey, legacySeed.apiKey),
    baseUrl: hasProviderSettings
      ? parsed.provider?.baseUrl
      : nonEmptyStringOrFallback(explicitDragon.baseUrl, legacySeed.baseUrl),
    providers: parsed.provider?.providers
  })
  const dragon = {
    ...dragonDefaults,
    ...legacySeed,
    ...explicitDragon,
    apiKey: hasProviderSettings ? explicitDragon.apiKey ?? '' : '',
    baseUrl: hasProviderSettings ? explicitDragon.baseUrl ?? '' : '',
    runtimeToken: nonEmptyStringOrFallback(explicitDragon.runtimeToken, legacySeed.runtimeToken),
    dataDir: upgradeLegacyDragonDefaultDataDir(explicitDragon.dataDir),
    model: upgradeLegacyDragonDefaultModel(explicitDragon.model, legacySeed.model),
    tokenEconomyMode: typeof explicitDragon.tokenEconomy?.enabled === 'boolean'
      ? explicitDragon.tokenEconomy.enabled
      : explicitDragon.tokenEconomyMode ?? dragonDefaults.tokenEconomyMode,
    tokenEconomy: normalizeDragonTokenEconomySettings(
      explicitDragon.tokenEconomy,
      explicitDragon.tokenEconomyMode ?? dragonDefaults.tokenEconomyMode
    ),
    mcpSearch: normalizeDragonMcpSearchSettings(explicitDragon.mcpSearch),
    storage: normalizeDragonStorageSettings(explicitDragon.storage),
    contextCompaction: normalizeDragonContextCompactionSettings(explicitDragon.contextCompaction),
    runtimeTuning: normalizeDragonRuntimeTuningSettings(explicitDragon.runtimeTuning)
  }
  // Strip the legacy `agentProvider` discriminator and the legacy
  // per-provider settings from the surfaced migration result. The
  // runtime now has a single agent (Dragon) and we no longer
  // round-trip the legacy value into the new settings shape.
  const { deepseek: _legacyDeepseek, agents: _agents, agentProvider: _agentProvider, ...rest } = parsed
  void _legacyDeepseek
  void _agents
  void _agentProvider
  return {
    ...rest,
    provider,
    agents: {
      dragon
    }
  }
}
