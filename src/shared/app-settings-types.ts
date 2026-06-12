import type { GuiUpdateChannel } from './gui-update'
import type { KeyboardShortcutsConfigV1 } from './keyboard-shortcuts'
import type { ApprovalPolicy, SandboxMode } from '../../dragon/src/contracts/policy.js'
import type { ModelEndpointFormat } from '../../dragon/src/contracts/model-endpoint-format.js'
export {
  DEFAULT_MODEL_ENDPOINT_FORMAT,
  MODEL_ENDPOINT_FORMATS,
  modelEndpointPath,
  normalizeModelEndpointFormat
} from '../../dragon/src/contracts/model-endpoint-format.js'
export { DEFAULT_GUI_UPDATE_CHANNEL, normalizeGuiUpdateChannel, type GuiUpdateChannel } from './gui-update'
export {
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_SANDBOX_MODE,
  type ApprovalPolicy,
  type SandboxMode
} from '../../dragon/src/contracts/policy.js'
export type UiFontScale = 'small' | 'medium' | 'large'
export type ScheduleRunMode = 'agent' | 'plan'
export type ScheduleKind = 'manual' | 'interval' | 'daily' | 'at'
export type ScheduleTaskStatus = 'idle' | 'running' | 'success' | 'error'
export type ScheduleModel = string
export type ScheduleReasoningEffort = 'off' | 'low' | 'minimal' | 'medium' | 'mid' | 'high' | 'max' | 'maximum' | 'xhigh'
export type ClawRunMode = ScheduleRunMode
export type ClawImProvider = 'feishu' | 'weixin'
export type ClawScheduleKind = ScheduleKind
export type ClawTaskStatus = ScheduleTaskStatus
export type ClawModel = ScheduleModel

export const DEFAULT_CLAW_MODEL = 'auto'
export const DEFAULT_SCHEDULE_MODEL = DEFAULT_CLAW_MODEL
export const DEFAULT_SCHEDULE_REASONING_EFFORT = 'medium'
export const SCHEDULE_REASONING_EFFORT_IDS = ['off', 'low', 'minimal', 'medium', 'mid', 'high', 'max', 'maximum', 'xhigh'] as const
export const DEFAULT_SCHEDULE_INTERNAL_PORT = 8788
export const DEFAULT_WRITE_WORKSPACE_ROOT = '~/.sinocode/write_workspace'
export const DEFAULT_DRAGON_DATA_DIR = '~/.sinocode/dragon'
export const DEFAULT_DRAGON_MODEL = ''
export const DEFAULT_WRITE_INLINE_COMPLETION_BASE_URL = ''
export const DEFAULT_WRITE_INLINE_COMPLETION_MODEL = ''
export const DEFAULT_WRITE_INLINE_COMPLETION_DEBOUNCE_MS = 650
export const DEFAULT_WRITE_INLINE_COMPLETION_MIN_ACCEPT_SCORE = 0.52
export const DEFAULT_WRITE_INLINE_COMPLETION_MAX_TOKENS = 96
export const DEFAULT_WRITE_INLINE_LONG_COMPLETION_DEBOUNCE_MS = 2_800
export const DEFAULT_WRITE_INLINE_LONG_COMPLETION_MIN_ACCEPT_SCORE = 0.36
export const DEFAULT_WRITE_INLINE_LONG_COMPLETION_MAX_TOKENS = 256
export const DEFAULT_DRAGON_PORT = 8899
export const DEFAULT_WEIXIN_BRIDGE_RPC_URL = 'http://127.0.0.1:18790/api/v1/admin/rpc'
export type { ModelEndpointFormat }
export type ModelPriceTierV1 = {
  minInputTokens?: number
  priceInput?: string
  priceOutput?: string
  priceInputCacheRead?: string
  priceInputCacheWrite?: string
}
export type ModelDetailV1 = {
  id: string
  name?: string
  priceInput?: string
  priceOutput?: string
  priceInputCacheRead?: string
  priceInputCacheWrite?: string
  priceTiers?: ModelPriceTierV1[]
  maxContext?: number
  maxOutput?: number
  supportsThinking?: boolean
  thinkingLevel?: string[]
}
export type ModelProviderProfileV1 = {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  endpointFormat: ModelEndpointFormat
  models: string[]
  mainModelId?: string
  fastModelId?: string
  modelDetails?: Record<string, ModelDetailV1>
}
export type ModelProviderSettingsV1 = {
  apiKey: string
  baseUrl: string
  providers: ModelProviderProfileV1[]
}

export type ModelProviderProfilePatchV1 = Partial<ModelProviderProfileV1>
export type ModelProviderSettingsPatchV1 = Partial<
  Omit<ModelProviderSettingsV1, 'providers'>
> & {
  providers?: ModelProviderProfilePatchV1[]
}

export type DragonRuntimeSettingsV1 = {
  binaryPath: string
  port: number
  autoStart: boolean
  /** Optional override. Leave empty to use the selected model provider API key. */
  apiKey: string
  /** Optional override. Leave empty to use the selected model provider Base URL. */
  baseUrl: string
  /** Selected model provider profile. Empty or missing means no provider is configured for this runtime. */
  providerId: string
  /** Effective model request format. Resolved from the selected model provider. */
  endpointFormat: ModelEndpointFormat
  runtimeToken: string
  dataDir: string
  model: string
  approvalPolicy: ApprovalPolicy
  sandboxMode: SandboxMode
  /** Compress safe tool context before each model call. */
  tokenEconomyMode: boolean
  /** Detailed token-saving behavior used when building Dragon model requests. */
  tokenEconomy: DragonTokenEconomySettingsV1
  /** When true, the runtime skips bearer-token auth. Local dev only. */
  insecure: boolean
  /** GUI-managed MCP progressive discovery/search settings written into Dragon config.json. */
  mcpSearch: DragonMcpSearchSettingsV1
  /** Persistent store backend used by Dragon. */
  storage: DragonStorageSettingsV1
  /** Fallback compaction thresholds and summary behavior. Per-model thresholds live in Dragon config models.profiles. */
  contextCompaction: DragonContextCompactionSettingsV1
  /** Low-level loop guards and model argument repair tuning. */
  runtimeTuning: DragonRuntimeTuningSettingsV1
}

export type DragonMcpSearchMode = 'direct' | 'search' | 'auto'

export type DragonMcpSearchSettingsV1 = {
  enabled: boolean
  mode: DragonMcpSearchMode
  autoThresholdToolCount: number
  topKDefault: number
  topKMax: number
  minScore: number
}

export type DragonStorageBackend = 'hybrid' | 'file'

export type DragonStorageSettingsV1 = {
  backend: DragonStorageBackend
  sqlitePath: string
}

export type DragonCompactionSummaryMode = 'heuristic' | 'model'

export type DragonHistoryHygieneSettingsV1 = {
  maxToolResultLines: number
  maxToolResultBytes: number
  maxToolResultTokens: number
  maxToolArgumentStringBytes: number
  maxToolArgumentStringTokens: number
  maxArrayItems: number
}

export type DragonTokenEconomySettingsV1 = {
  enabled: boolean
  compressToolDescriptions: boolean
  compressToolResults: boolean
  conciseResponses: boolean
  historyHygiene: DragonHistoryHygieneSettingsV1
}

export type DragonContextCompactionSettingsV1 = {
  defaultSoftThreshold: number
  defaultHardThreshold: number
  summaryMode: DragonCompactionSummaryMode
  summaryTimeoutMs: number
  summaryMaxTokens: number
  summaryInputMaxBytes: number
}

export type DragonToolStormSettingsV1 = {
  enabled: boolean
  windowSize: number
  threshold: number
}

export type DragonToolArgumentRepairSettingsV1 = {
  maxStringBytes: number
}

export type DragonRuntimeTuningSettingsV1 = {
  toolStorm: DragonToolStormSettingsV1
  toolArgumentRepair: DragonToolArgumentRepairSettingsV1
}

/**
 * Compatibility shell kept because persisted settings still use the
 * `agents.dragon` envelope. Prefer operating on the contained
 * `DragonRuntimeSettingsV1` directly in new code.
 */
export type DragonSettingsEnvelopeV1 = {
  dragon: DragonRuntimeSettingsV1
}

/** @deprecated Use `DragonSettingsEnvelopeV1`. */
export type AgentRuntimeSettingsMapV1 = DragonSettingsEnvelopeV1

export type DragonRuntimeTuningSettingsPatchV1 = {
  toolStorm?: Partial<DragonToolStormSettingsV1>
  toolArgumentRepair?: Partial<DragonToolArgumentRepairSettingsV1>
}

export type DragonTokenEconomySettingsPatchV1 = Partial<
  Omit<DragonTokenEconomySettingsV1, 'historyHygiene'>
> & {
  historyHygiene?: Partial<DragonHistoryHygieneSettingsV1>
}

export type DragonRuntimeSettingsPatchV1 = Partial<
  Omit<
    DragonRuntimeSettingsV1,
    'mcpSearch' | 'storage' | 'contextCompaction' | 'runtimeTuning' | 'tokenEconomy'
  >
> & {
  mcpSearch?: Partial<DragonMcpSearchSettingsV1>
  tokenEconomy?: DragonTokenEconomySettingsPatchV1
  storage?: Partial<DragonStorageSettingsV1>
  contextCompaction?: Partial<DragonContextCompactionSettingsV1>
  runtimeTuning?: DragonRuntimeTuningSettingsPatchV1
}

export type DragonSettingsEnvelopePatchV1 = {
  dragon?: DragonRuntimeSettingsPatchV1
}

export type LogConfigV1 = {
  enabled: boolean
  retentionDays: number
}

export type NotificationConfigV1 = {
  turnComplete: boolean
}

export type AppBehaviorConfigV1 = {
  openAtLogin: boolean
  startMinimized: boolean
  closeToTray: boolean
}

export type ScheduleSkillSettingsV1 = {
  defaultNames: string[]
  extraDirs: string[]
}

export type ScheduledTaskScheduleV1 = {
  kind: ScheduleKind
  everyMinutes: number
  timeOfDay: string
  atTime: string
}

export type ScheduledTaskV1 = {
  id: string
  title: string
  enabled: boolean
  prompt: string
  workspaceRoot: string
  model: string
  reasoningEffort: ScheduleReasoningEffort
  mode: ScheduleRunMode
  schedule: ScheduledTaskScheduleV1
  createdAt: string
  updatedAt: string
  lastRunAt: string
  nextRunAt: string
  lastStatus: ScheduleTaskStatus
  lastMessage: string
  lastThreadId: string
}

export type ScheduleInternalSettingsV1 = {
  port: number
  secret: string
}

export type ScheduleSettingsV1 = {
  enabled: boolean
  defaultWorkspaceRoot: string
  model: string
  mode: ScheduleRunMode
  promptPrefix: string
  skills: ScheduleSkillSettingsV1
  keepAwake: boolean
  internal: ScheduleInternalSettingsV1
  tasks: ScheduledTaskV1[]
}

export type ClawSkillSettingsV1 = {
  defaultNames: string[]
  extraDirs: string[]
  promptPrefix: string
}

export type ClawImSettingsV1 = {
  enabled: boolean
  provider: ClawImProvider
  port: number
  path: string
  secret: string
  weixinBridgeUrl: string
  workspaceRoot: string
  model: string
  mode: ClawRunMode
  responseTimeoutMs: number
}

export type ClawTaskScheduleV1 = {
  kind: ClawScheduleKind
  everyMinutes: number
  timeOfDay: string
  atTime: string
}

export type ClawTaskV1 = ScheduledTaskV1

export type ClawImAgentProfileV1 = {
  name: string
  description: string
  identity: string
  personality: string
  userContext: string
  replyRules: string
}

export type ClawImFeishuPlatformCredentialV1 = {
  kind: 'feishu'
  appId: string
  appSecret: string
  domain: string
  createdAt: string
}

export type ClawImWeixinPlatformCredentialV1 = {
  kind: 'weixin'
  accountId: string
  sessionKey: string
  createdAt: string
}

export type ClawImPlatformCredentialV1 =
  | ClawImFeishuPlatformCredentialV1
  | ClawImWeixinPlatformCredentialV1

export type ClawImRemoteSessionV1 = {
  chatId: string
  messageId: string
  threadId: string
  senderId: string
  senderName: string
  updatedAt: string
}

export type ClawImConversationV1 = {
  id: string
  chatId: string
  remoteThreadId: string
  latestMessageId: string
  senderId: string
  senderName: string
  /** Dragon thread id this conversation maps to. */
  localThreadId: string
  workspaceRoot: string
  createdAt: string
  updatedAt: string
}

export type ClawImChannelV1 = {
  id: string
  provider: ClawImProvider
  label: string
  enabled: boolean
  model: string
  /** Dragon thread id this channel maps to. */
  threadId: string
  workspaceRoot: string
  agentProfile: ClawImAgentProfileV1
  platformCredential?: ClawImPlatformCredentialV1
  remoteSession?: ClawImRemoteSessionV1
  conversations: ClawImConversationV1[]
  createdAt: string
  updatedAt: string
}

export type ClawSettingsV1 = {
  enabled: boolean
  skills: ClawSkillSettingsV1
  im: ClawImSettingsV1
  channels: ClawImChannelV1[]
  tasks: ClawTaskV1[]
}

export type WriteInlineCompletionSettingsV1 = {
  enabled: boolean
  retrievalEnabled: boolean
  longCompletionEnabled: boolean
  apiKey: string
  baseUrl: string
  /** When true, Write inherits Dragon's runtime model instead of using `model` as an override. */
  inheritModel: boolean
  model: string
  debounceMs: number
  longDebounceMs: number
  minAcceptScore: number
  longMinAcceptScore: number
  maxTokens: number
  longMaxTokens: number
}

export type WriteSettingsV1 = {
  defaultWorkspaceRoot: string
  activeWorkspaceRoot: string
  workspaces: string[]
  inlineCompletion: WriteInlineCompletionSettingsV1
}

export type ClawSettingsPatchV1 = Partial<Omit<ClawSettingsV1, 'skills' | 'im' | 'channels' | 'tasks'>> & {
  skills?: Partial<ClawSkillSettingsV1>
  im?: Partial<ClawImSettingsV1>
  channels?: Array<Partial<ClawImChannelV1>>
  tasks?: Array<Partial<ClawTaskV1>>
}

export type ScheduleSettingsPatchV1 = Partial<
  Omit<ScheduleSettingsV1, 'skills' | 'internal' | 'tasks'>
> & {
  skills?: Partial<ScheduleSkillSettingsV1>
  internal?: Partial<ScheduleInternalSettingsV1>
  tasks?: Array<Partial<ScheduledTaskV1>>
}

export type WriteSettingsPatchV1 = Partial<Omit<WriteSettingsV1, 'inlineCompletion'>> & {
  inlineCompletion?: Partial<WriteInlineCompletionSettingsV1>
}

export type ClawGeneratedFileV1 = {
  path: string
  relativePath?: string
  fileName: string
}

export type ClawRunResult =
  | { ok: true; threadId: string; turnId?: string; text?: string; message?: string; files?: ClawGeneratedFileV1[] }
  | { ok: false; message: string }

export type ScheduleRunResult = ClawRunResult

export type ScheduleTaskFromTextResult =
  | { kind: 'noop' }
  | { kind: 'created'; taskId: string; title: string; scheduleAt: string; confirmationText: string }
  | { kind: 'error'; message: string }

export type ClawTaskFromTextResult = ScheduleTaskFromTextResult

export type ClawRuntimeStatus = {
  imServerRunning: boolean
  imUrl: string
  runningTaskIds: string[]
}

export type ScheduleRuntimeStatus = {
  internalServerRunning: boolean
  internalUrl: string
  runningTaskIds: string[]
  powerSaveBlockerActive: boolean
}

export type GuiUpdateConfigV1 = {
  channel: GuiUpdateChannel
}

export type AppSettingsV1 = {
  version: 1
  locale: 'en' | 'zh'
  theme: 'system' | 'light' | 'dark'
  uiFontScale: UiFontScale
  provider: ModelProviderSettingsV1
  agents: DragonSettingsEnvelopeV1
  workspaceRoot: string
  log: LogConfigV1
  notifications: NotificationConfigV1
  appBehavior: AppBehaviorConfigV1
  keyboardShortcuts: KeyboardShortcutsConfigV1
  write: WriteSettingsV1
  claw: ClawSettingsV1
  schedule: ScheduleSettingsV1
  guiUpdate: GuiUpdateConfigV1
  codePromptPrefix: string
}

export type AppSettingsPatch = Partial<
  Omit<AppSettingsV1, 'provider' | 'agents' | 'log' | 'notifications' | 'appBehavior' | 'keyboardShortcuts' | 'write' | 'claw' | 'schedule' | 'guiUpdate'>
> & {
  provider?: ModelProviderSettingsPatchV1
  agents?: DragonSettingsEnvelopePatchV1
  log?: Partial<LogConfigV1>
  notifications?: Partial<NotificationConfigV1>
  appBehavior?: Partial<AppBehaviorConfigV1>
  keyboardShortcuts?: Partial<KeyboardShortcutsConfigV1>
  write?: WriteSettingsPatchV1
  claw?: ClawSettingsPatchV1
  schedule?: ScheduleSettingsPatchV1
  guiUpdate?: Partial<GuiUpdateConfigV1>
}
