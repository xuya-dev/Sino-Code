import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  defaultDragonTokenEconomySettings,
  isDragonRuntimeInsecure,
  resolveDragonRuntimeSettings,
  getModelProviderProfile,
  type ModelProviderProfileV1,
  type DragonRuntimeSettingsV1,
  type AppSettingsV1
} from '../shared/app-settings'
import {
  buildDragonServeArgs,
  resolveDragonExecutable
} from './resolve-dragon-binary'
import {
  DragonConfigSchema,
  DragonServeConfigSchema,
  ModelConfigSchema,
  ContextCompactionConfigSchema,
  RuntimeTuningConfigSchema
} from '../../dragon/src/config/dragon-config.js'
import {
  AttachmentsCapabilityConfig,
  McpCapabilityConfig,
  McpServerConfig,
  MemoryCapabilityConfig,
  SkillsCapabilityConfig,
  SubagentsCapabilityConfig,
  WebCapabilityConfig
} from '../../dragon/src/contracts/capabilities.js'
import {
  buildClawScheduleMcpArgs,
  GUI_SCHEDULE_MCP_SERVER_NAME,
  resolveClawScheduleMcpCommand,
  resolveDragonMcpJsonPath,
  type ClawScheduleMcpLaunchConfig
} from './claw-schedule-mcp-config'
import { defaultDragonDataDir } from './runtime/dragon-adapter'
import { appendManagedLogLine } from './logger'
import { guiSkillRootsForRuntime, normalizeSkillRootPath } from './services/skill-service'

let child: ChildProcess | null = null
let childLogCapture: DragonChildLogCapture | null = null
let lastResolvedBinary: string | null = null
const DRAGON_READY_PREFIX = 'DRAGON_READY '
const DRAGON_STARTUP_TIMEOUT_MS = 15_000
const DRAGON_STOP_GRACE_MS = 5_000
const DRAGON_STOP_FORCE_MS = 1_000
const STDERR_TAIL_MAX_CHARS = 4_000
const GUI_SCHEDULE_MCP_TIMEOUT_MS = 5_000
const LEGACY_GUI_DEFAULT_DRAGON_MODEL_PROFILES: Record<string, Record<string, unknown>> = {
  'deepseek-v4-pro': {
    contextWindowTokens: 1_000_000,
    contextCompaction: {
      softThreshold: 980_000,
      hardThreshold: 990_000
    },
    inputModalities: ['text'],
    outputModalities: ['text'],
    supportsToolCalling: true,
    messageParts: ['text']
  },
  'deepseek-v4-flash': {
    contextWindowTokens: 1_000_000,
    contextCompaction: {
      softThreshold: 980_000,
      hardThreshold: 990_000
    },
    inputModalities: ['text'],
    outputModalities: ['text'],
    supportsToolCalling: true,
    messageParts: ['text']
  }
}
type DragonLogStream = 'stdout' | 'stderr' | 'lifecycle'
type DragonChildLogCapture = {
  captureStdout: (chunk: Buffer | string) => void
  captureStderr: (chunk: Buffer | string) => void
  logLifecycle: (message: string) => void
  close: () => Promise<void>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function appendTail(current: string, nextChunk: string, maxChars = STDERR_TAIL_MAX_CHARS): string {
  const combined = `${current}${nextChunk}`
  return combined.length > maxChars ? combined.slice(-maxChars) : combined
}

function formatDragonLogLine(
  stream: DragonLogStream,
  pid: number | undefined,
  message: string
): string {
  const stamp = new Date().toISOString()
  const pidLabel = typeof pid === 'number' ? `dragon pid=${pid}` : 'dragon'
  return `[${stamp}] [${stream.toUpperCase()}] [${pidLabel}] ${message}\n`
}

function normalizeCapturedChunk(chunk: Buffer | string): string {
  return String(chunk).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function createDragonChildLogCapture(pid: number | undefined): DragonChildLogCapture {
  let stdoutRemainder = ''
  let stderrRemainder = ''
  let closed = false
  let pending = Promise.resolve()

  const writeLine = (stream: DragonLogStream, message: string): void => {
    pending = pending
      .then(() => appendManagedLogLine('dragon', formatDragonLogLine(stream, pid, message)))
      .catch(() => undefined)
  }

  const captureChunk = (
    stream: 'stdout' | 'stderr',
    chunk: Buffer | string
  ): void => {
    if (closed) return
    const text = normalizeCapturedChunk(chunk)
    const buffered = `${stream === 'stdout' ? stdoutRemainder : stderrRemainder}${text}`
    const parts = buffered.split('\n')
    const remainder = parts.pop() ?? ''
    if (stream === 'stdout') {
      stdoutRemainder = remainder
    } else {
      stderrRemainder = remainder
    }
    for (const part of parts) {
      writeLine(stream, part)
    }
  }

  return {
    captureStdout(chunk) {
      captureChunk('stdout', chunk)
    },
    captureStderr(chunk) {
      captureChunk('stderr', chunk)
    },
    logLifecycle(message) {
      if (closed) return
      writeLine('lifecycle', message)
    },
    async close() {
      if (closed) {
        await pending
        return
      }
      closed = true
      if (stdoutRemainder) {
        writeLine('stdout', stdoutRemainder)
        stdoutRemainder = ''
      }
      if (stderrRemainder) {
        writeLine('stderr', stderrRemainder)
        stderrRemainder = ''
      }
      await pending
    }
  }
}

function appRoot(): string {
  return app.isPackaged
    ? app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked')
    : app.getAppPath()
}

export function resolveDragonDataDir(runtime: { dataDir: string }): string {
  const trimmed = runtime.dataDir?.trim()
  if (trimmed) return expandHomePath(trimmed)
  return defaultDragonDataDir()
}

function expandHomePath(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) {
    return join(homedir(), path.slice(2).replace(/\\/g, '/'))
  }
  return path
}

export function isDragonChildRunning(): boolean {
  return child !== null && child.exitCode === null && child.signalCode === null
}

export async function startDragonChild(settings: AppSettingsV1): Promise<void> {
  const runtime = resolveDragonRuntimeSettings(settings)
  if (isDragonChildRunning()) return
  if (!runtime.autoStart) return
  assertDragonRuntimeConfigured(runtime)
  if (childLogCapture) {
    await childLogCapture.close()
    childLogCapture = null
  }
  const root = appRoot()
  const resolution = resolveDragonExecutable(root, runtime.binaryPath)
  if (resolution.command === process.execPath && !existsSync(resolution.args[0])) {
    throw new Error(
      `Dragon runtime build is missing at ${resolution.args[0]}. Run \`npm run build:dragon\` before starting the app.`
    )
  }
  const dataDir = resolveDragonDataDir(runtime)
  await syncGuiManagedDragonConfig(dataDir, runtime, {
    scheduleMcp: {
      settings,
      launch: {
        appPath: app.getAppPath(),
        execPath: process.execPath,
        isPackaged: app.isPackaged
      }
    },
    settings
  })
  lastResolvedBinary = resolution.command === process.execPath
    ? resolution.args.join(' ')
    : resolution.command
  const args = buildDragonServeArgs({
    resolution,
    host: '127.0.0.1',
    port: runtime.port,
    dataDir,
    apiKey: runtime.apiKey,
    baseUrl: runtime.baseUrl,
    endpointFormat: runtime.endpointFormat,
    model: runtime.model,
    approvalPolicy: runtime.approvalPolicy,
    sandboxMode: runtime.sandboxMode,
    tokenEconomyMode: runtime.tokenEconomyMode,
    insecure: isDragonRuntimeInsecure(runtime),
    providerId: runtime.providerId
  })
  child = spawn(resolution.command, args, {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DRAGON_RUNTIME_TOKEN: runtime.runtimeToken,
      SINO_CODE_API_KEY: runtime.apiKey || ''
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  })
  const startedChild = child
  const startedLogCapture = createDragonChildLogCapture(startedChild.pid)
  childLogCapture = startedLogCapture
  startedLogCapture.logLifecycle(`spawned on port ${runtime.port} using data dir ${dataDir}`)
  startedChild.stdout?.on('data', startedLogCapture.captureStdout)
  startedChild.stderr?.on('data', startedLogCapture.captureStderr)
  child.on('exit', (code, signal) => {
    startedLogCapture.logLifecycle(
      signal
        ? `exited with signal ${signal}`
        : `exited with code ${code ?? 'unknown'}`
    )
    void startedLogCapture.close()
    if (child === startedChild) child = null
  })
  child.on('error', (error) => {
    startedLogCapture.logLifecycle(
      `process error: ${error instanceof Error ? error.message : String(error)}`
    )
  })
  try {
    await waitForDragonStartup(startedChild)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    startedLogCapture.logLifecycle(`startup failed before ready: ${message}`)
    if (child === startedChild) {
      await stopDragonChildAndWait()
    }
    throw error
  }
  startedLogCapture.logLifecycle(`ready marker received on port ${runtime.port}`)
}

function assertDragonRuntimeConfigured(runtime: DragonRuntimeSettingsV1): void {
  if (!runtime.providerId.trim()) {
    throw new Error('Configure a model provider before starting Dragon.')
  }
  if (!runtime.baseUrl.trim()) {
    throw new Error('Configure a model provider Base URL before starting Dragon.')
  }
  if (!runtime.model.trim()) {
    throw new Error('Configure a model before starting Dragon.')
  }
}

export async function syncGuiManagedDragonConfig(
  dataDir: string,
  runtime: Pick<
    DragonRuntimeSettingsV1,
    'mcpSearch' | 'tokenEconomy' | 'storage' | 'contextCompaction' | 'runtimeTuning'
  >,
  options?: {
    scheduleMcp?: {
      settings: AppSettingsV1
      launch: ClawScheduleMcpLaunchConfig
    }
    mcpConfigPath?: string
    settings?: AppSettingsV1
  }
): Promise<void> {
  const configPath = join(dataDir, 'config.json')
  const existing = sanitizeDragonConfigSections(await readJsonObjectIfExists(configPath))
  const importedMcpServers = await readGuiManagedMcpServers(
    options?.mcpConfigPath ?? resolveDragonMcpJsonPath()
  )
  const hasImportedEnabledMcpServer = Object.values(importedMcpServers).some(
    (server) => objectValue(server).enabled !== false
  )

  const serve = objectValue(existing?.serve)
  const existingTokenEconomy = objectValue(serve.tokenEconomy)
  const existingContextCompaction = objectValue(existing?.contextCompaction)
  const existingModels = objectValue(existing?.models)
  const existingRuntimeTuning = objectValue(existing?.runtime)
  const capabilities = objectValue(existing?.capabilities)
  const mcp = objectValue(capabilities.mcp)
  const search = objectValue(mcp.search)
  const attachments = objectValue(capabilities.attachments)
  const web = objectValue(capabilities.web)
  const skills = objectValue(capabilities.skills)
  const storage = storageConfigForRuntime(runtime.storage)
  const mcpSearch = runtime.mcpSearch
  const settings = options?.settings ?? options?.scheduleMcp?.settings
  const providerId = settings?.agents?.dragon?.providerId
  const providerProfile = settings ? getModelProviderProfile(settings, providerId) : undefined
  const skillCapability = await skillCapabilityConfigForRuntime(skills, settings)
  const next = {
    serve: {
      ...serve,
      storage,
      tokenEconomy: tokenEconomyConfigForRuntime(runtime.tokenEconomy, existingTokenEconomy)
    },
    models: modelConfigForRuntime(existingModels, providerProfile),
    contextCompaction: contextCompactionConfigForRuntime(runtime.contextCompaction, existingContextCompaction),
    runtime: runtimeTuningConfigForRuntime(runtime.runtimeTuning, existingRuntimeTuning),
    capabilities: {
      ...capabilities,
      attachments: {
        ...attachments,
        enabled: attachments.enabled === false ? false : true
      },
      web: {
        ...web,
        enabled: web.enabled === false ? false : true,
        fetchEnabled: web.fetchEnabled === false ? false : true
      },
      skills: skillCapability,
      mcp: {
        ...mcp,
        ...(options?.scheduleMcp || mcpSearch.enabled || hasImportedEnabledMcpServer
          ? { enabled: mcp.enabled === false ? false : true }
          : {}),
        servers: {
          ...objectValue(mcp.servers),
          ...importedMcpServers,
          ...(options?.scheduleMcp
          ? {
              [GUI_SCHEDULE_MCP_SERVER_NAME]: buildGuiScheduleDragonMcpServer(
                options.scheduleMcp.settings,
                options.scheduleMcp.launch
              )
            }
          : {})
        },
        search: {
          ...search,
          enabled: mcpSearch.enabled,
          mode: mcpSearch.mode,
          autoThresholdToolCount: mcpSearch.autoThresholdToolCount,
          topKDefault: mcpSearch.topKDefault,
          topKMax: mcpSearch.topKMax,
          minScore: mcpSearch.minScore
        }
      }
    }
  }
  const parsedNext = DragonConfigSchema.safeParse(next)
  if (!parsedNext.success) {
    throw new Error(
      `Refusing to write invalid GUI-managed Dragon config at ${configPath}: ${JSON.stringify(parsedNext.error.issues, null, 2)}`
    )
  }
  const nextText = `${JSON.stringify(next, null, 2)}\n`
  if (existing && nextText === `${JSON.stringify(existing, null, 2)}\n`) return
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, nextText, 'utf8')
}

function buildGuiScheduleDragonMcpServer(
  settings: AppSettingsV1,
  launch: ClawScheduleMcpLaunchConfig
): Record<string, unknown> {
  return {
    enabled: true,
    transport: 'stdio',
    command: resolveClawScheduleMcpCommand(launch),
    args: buildClawScheduleMcpArgs(settings, launch),
    env: {
      ELECTRON_RUN_AS_NODE: '1'
    },
    trustScope: 'user',
    timeoutMs: GUI_SCHEDULE_MCP_TIMEOUT_MS
  }
}

async function skillCapabilityConfigForRuntime(
  existing: Record<string, unknown>,
  settings?: AppSettingsV1
): Promise<Record<string, unknown>> {
  const roots = uniqueStrings([
    ...stringArrayValue(existing.roots).map(normalizeSkillRootPath),
    ...(await guiSkillRootsForRuntime(settings)).map((root) => root.path)
  ])
  return {
    ...existing,
    enabled: existing.enabled === false ? false : roots.length > 0 || existing.enabled === true,
    roots,
    legacySkillMd: existing.legacySkillMd === false ? false : true
  }
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

async function readGuiManagedMcpServers(path: string): Promise<Record<string, unknown>> {
  const parsed = await readJsonObjectIfExists(path)
  if (!parsed) return {}

  const rawServers = mcpServersFromGuiConfig(parsed)
  const normalizedEntries = Object.entries(rawServers)
    .map(([serverId, server]) => {
      const normalized = normalizeGuiManagedMcpServer(server)
      return normalized ? [serverId, normalized] as const : null
    })
    .filter((entry): entry is readonly [string, Record<string, unknown>] => entry !== null)

  return Object.fromEntries(normalizedEntries)
}

function mcpServersFromGuiConfig(config: Record<string, unknown>): Record<string, unknown> {
  const directServers = objectValue(config.servers)
  if (Object.keys(directServers).length > 0) return directServers

  const capabilities = objectValue(config.capabilities)
  const mcp = objectValue(capabilities.mcp)
  return objectValue(mcp.servers)
}

function normalizeGuiManagedMcpServer(server: unknown): Record<string, unknown> | null {
  const raw = objectValue(server)
  const command = scalarStringValue(raw.command)
  const url = scalarStringValue(raw.url)
  const args = stringArrayValue(raw.args)
  const headers = stringRecordValue(raw.headers)
  const env = stringRecordValue(raw.env)
  const transport = normalizeMcpTransport(raw.transport, command, url)
  if (!transport) return null

  const trustedWorkspaceRoots = stringArrayValue(raw.trustedWorkspaceRoots)
  const trustScope = normalizeMcpTrustScope(raw.trustScope, trustedWorkspaceRoots)
  if (trustScope === 'workspace' && trustedWorkspaceRoots.length === 0) return null

  const timeoutMs = positiveIntegerValue(raw.timeoutMs)
  const parsed = McpServerConfig.safeParse({
    enabled: raw.enabled === false || raw.disabled === true ? false : true,
    transport,
    ...(command ? { command } : {}),
    ...(args.length > 0 ? { args } : {}),
    ...(url ? { url } : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
    trustScope,
    ...(trustedWorkspaceRoots.length > 0 ? { trustedWorkspaceRoots } : {}),
    ...(timeoutMs ? { timeoutMs } : {})
  })

  return parsed.success ? objectValue(parsed.data) : null
}

function normalizeMcpTransport(
  value: unknown,
  command: string | undefined,
  url: string | undefined
): 'stdio' | 'streamable-http' | 'sse' | null {
  if (value === 'stdio' || value === 'streamable-http' || value === 'sse') return value
  if (command) return 'stdio'
  if (url) return 'streamable-http'
  return null
}

function normalizeMcpTrustScope(
  value: unknown,
  trustedWorkspaceRoots: string[]
): 'user' | 'workspace' {
  if (value === 'user' || value === 'workspace') return value
  return trustedWorkspaceRoots.length > 0 ? 'workspace' : 'user'
}

function scalarStringValue(value: unknown): string | undefined {
  return typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : undefined
}

function stringRecordValue(value: unknown): Record<string, string> {
  const record = objectValue(value)
  const next: Record<string, string> = {}
  for (const [key, item] of Object.entries(record)) {
    const normalized = scalarStringValue(item)
    if (normalized !== undefined) next[key] = normalized
  }
  return next
}

function positiveIntegerValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function modelConfigForRuntime(
  existing: Record<string, unknown>,
  providerProfile?: ModelProviderProfileV1
): Record<string, unknown> {
  const { autoRouting: _autoRouting, ...existingWithoutAutoRouting } = existing
  const existingProfiles = objectValue(existing.profiles)
  const configuredModelDetails = providerProfile?.modelDetails ?? {}
  const profiles: Record<string, unknown> = {}
  const autoRouting = autoModelRoutingConfigForProvider(providerProfile)
  for (const [modelId, profile] of Object.entries(existingProfiles)) {
    const existingProfile = objectValue(profile)
    if (
      !configuredModelDetails[modelId] &&
      isLegacyGuiDefaultDragonModelProfile(modelId, existingProfile)
    ) {
      continue
    }
    profiles[modelId] = existingProfile
  }

  if (providerProfile?.modelDetails) {
    for (const [modelId, detail] of Object.entries(providerProfile.modelDetails)) {
      const existingProfile = objectValue(profiles[modelId])
      const existingProfileWithoutAliases = modelProfileWithoutAliases(existingProfile)
      const maxContext = detail.maxContext
      const nextProfile: Record<string, any> = {
        ...existingProfileWithoutAliases,
        priceInput: detail.priceInput,
        priceOutput: detail.priceOutput,
        priceInputCacheRead: detail.priceInputCacheRead,
        priceInputCacheWrite: detail.priceInputCacheWrite,
        priceTiers: detail.priceTiers,
        supportsThinking: detail.supportsThinking,
        thinkingLevel: detail.thinkingLevel
      }
      if (maxContext !== undefined && maxContext > 0) {
        nextProfile.contextWindowTokens = maxContext
        nextProfile.contextCompaction = {
          ...objectValue(existingProfile.contextCompaction),
          softThreshold: Math.floor(maxContext * 0.98),
          hardThreshold: Math.floor(maxContext * 0.99)
        }
      }
      profiles[modelId] = nextProfile
    }
  }

  return {
    ...existingWithoutAutoRouting,
    ...(autoRouting ? { autoRouting } : {}),
    profiles
  }
}

function autoModelRoutingConfigForProvider(
  providerProfile?: ModelProviderProfileV1
): Record<string, string> | undefined {
  const models = new Set(providerProfile?.models ?? [])
  const mainModel = providerProfile?.mainModelId?.trim() ?? ''
  const fastModel = providerProfile?.fastModelId?.trim() ?? ''
  const autoRouting: Record<string, string> = {}
  if (mainModel && models.has(mainModel)) autoRouting.mainModel = mainModel
  if (fastModel && models.has(fastModel)) autoRouting.fastModel = fastModel
  return Object.keys(autoRouting).length > 0 ? autoRouting : undefined
}

function isLegacyGuiDefaultDragonModelProfile(
  modelId: string,
  profile: Record<string, unknown>
): boolean {
  const legacy = LEGACY_GUI_DEFAULT_DRAGON_MODEL_PROFILES[modelId]
  return stableObjectEqual(profile, legacy) || stableObjectEqual(modelProfileWithoutAliases(profile), legacy)
}

function modelProfileWithoutAliases(profile: Record<string, unknown>): Record<string, unknown> {
  const { aliases: _aliases, ...rest } = profile
  return rest
}

function stableObjectEqual(a: unknown, b: unknown): boolean {
  if (!a || !b) return false
  return JSON.stringify(canonicalObject(a)) === JSON.stringify(canonicalObject(b))
}

function canonicalObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalObject)
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = canonicalObject((value as Record<string, unknown>)[key])
  }
  return out
}

function tokenEconomyConfigForRuntime(
  tokenEconomy: Pick<DragonRuntimeSettingsV1, 'tokenEconomy'>['tokenEconomy'] | undefined,
  existing: Record<string, unknown>
): Record<string, unknown> {
  const defaults = defaultDragonTokenEconomySettings()
  const normalized = {
    ...defaults,
    ...(tokenEconomy ?? {}),
    historyHygiene: {
      ...defaults.historyHygiene,
      ...(tokenEconomy?.historyHygiene ?? {})
    }
  }
  const existingHistoryHygiene = objectValue(existing.historyHygiene)
  return {
    ...existing,
    enabled: normalized.enabled,
    compressToolDescriptions: normalized.compressToolDescriptions,
    compressToolResults: normalized.compressToolResults,
    conciseResponses: normalized.conciseResponses,
    historyHygiene: {
      ...existingHistoryHygiene,
      maxToolResultLines: normalized.historyHygiene.maxToolResultLines,
      maxToolResultBytes: normalized.historyHygiene.maxToolResultBytes,
      maxToolResultTokens: normalized.historyHygiene.maxToolResultTokens,
      maxToolArgumentStringBytes: normalized.historyHygiene.maxToolArgumentStringBytes,
      maxToolArgumentStringTokens: normalized.historyHygiene.maxToolArgumentStringTokens,
      maxArrayItems: normalized.historyHygiene.maxArrayItems
    }
  }
}

function storageConfigForRuntime(
  storage: Pick<DragonRuntimeSettingsV1, 'storage'>['storage']
): Record<string, unknown> {
  const sqlitePath = storage.sqlitePath.trim()
  return {
    backend: storage.backend,
    ...(sqlitePath ? { sqlitePath } : {})
  }
}

function contextCompactionConfigForRuntime(
  contextCompaction: Pick<DragonRuntimeSettingsV1, 'contextCompaction'>['contextCompaction'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...existing,
    defaultSoftThreshold: contextCompaction.defaultSoftThreshold,
    defaultHardThreshold: contextCompaction.defaultHardThreshold,
    summaryMode: contextCompaction.summaryMode,
    summaryTimeoutMs: contextCompaction.summaryTimeoutMs,
    summaryMaxTokens: contextCompaction.summaryMaxTokens,
    summaryInputMaxBytes: contextCompaction.summaryInputMaxBytes
  }
}

function runtimeTuningConfigForRuntime(
  runtimeTuning: Pick<DragonRuntimeSettingsV1, 'runtimeTuning'>['runtimeTuning'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  const existingToolStorm = objectValue(existing.toolStorm)
  const existingToolArgumentRepair = objectValue(existing.toolArgumentRepair)
  return {
    ...existing,
    toolStorm: {
      ...existingToolStorm,
      enabled: runtimeTuning.toolStorm.enabled,
      windowSize: runtimeTuning.toolStorm.windowSize,
      threshold: runtimeTuning.toolStorm.threshold
    },
    toolArgumentRepair: {
      ...existingToolArgumentRepair,
      maxStringBytes: runtimeTuning.toolArgumentRepair.maxStringBytes
    }
  }
}

async function readJsonObjectIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    const text = await readFile(path, 'utf8')
    const parsed = JSON.parse(text) as unknown
    return objectValue(parsed)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    if (error instanceof SyntaxError) return null
    throw error
  }
}

type SafeParseSchema = {
  safeParse: (value: unknown) =>
    | { success: true; data: unknown }
    | { success: false }
}

function parseDragonConfigSection(
  schema: SafeParseSchema,
  value: unknown
): Record<string, unknown> {
  const parsed = schema.safeParse(objectValue(value))
  return parsed.success ? objectValue(parsed.data) : {}
}

function sanitizeDragonCapabilitiesConfig(value: unknown): Record<string, unknown> {
  const raw = objectValue(value)
  const next: Record<string, unknown> = {}
  if ('mcp' in raw) next.mcp = parseDragonConfigSection(McpCapabilityConfig, raw.mcp)
  if ('web' in raw) next.web = parseDragonConfigSection(WebCapabilityConfig, raw.web)
  if ('skills' in raw) next.skills = parseDragonConfigSection(SkillsCapabilityConfig, raw.skills)
  if ('subagents' in raw) {
    next.subagents = parseDragonConfigSection(SubagentsCapabilityConfig, raw.subagents)
  }
  if ('attachments' in raw) {
    next.attachments = parseDragonConfigSection(AttachmentsCapabilityConfig, raw.attachments)
  }
  if ('memory' in raw) next.memory = parseDragonConfigSection(MemoryCapabilityConfig, raw.memory)
  return next
}

function sanitizeDragonConfigSections(
  existing: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!existing) return null
  return {
    serve: parseDragonConfigSection(DragonServeConfigSchema, existing.serve),
    models: parseDragonConfigSection(ModelConfigSchema, existing.models),
    contextCompaction: parseDragonConfigSection(
      ContextCompactionConfigSchema,
      existing.contextCompaction
    ),
    runtime: parseDragonConfigSection(RuntimeTuningConfigSchema, existing.runtime),
    capabilities: sanitizeDragonCapabilitiesConfig(existing.capabilities)
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function stopDragonChildAndWait(): Promise<void> {
  if (!child) {
    if (childLogCapture) {
      const capture = childLogCapture
      childLogCapture = null
      await capture.close()
    }
    return
  }
  const stoppingChild = child
  const pid = child.pid
  const capture = childLogCapture
  if (stoppingChild.exitCode === null && stoppingChild.signalCode === null) {
    try {
      stoppingChild.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
  const exited = await waitForChildExit(stoppingChild, DRAGON_STOP_GRACE_MS)
  if (!exited) {
    try {
      if (pid) process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
    await waitForChildExit(stoppingChild, DRAGON_STOP_FORCE_MS)
  }
  if (child === stoppingChild) child = null
  if (capture) {
    childLogCapture = null
    await capture.close()
  }
}

function waitForChildExit(process: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (process.exitCode !== null || process.signalCode !== null) return Promise.resolve(true)
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => settle(false), timeoutMs)
    const settle = (exited: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      process.removeListener('exit', onExit)
      process.removeListener('error', onError)
      resolve(exited)
    }
    const onExit = (): void => settle(true)
    const onError = (): void => settle(true)
    process.once('exit', onExit)
    process.once('error', onError)
  })
}

export async function reclaimDragonPort(
  port: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (port <= 0) return { ok: true }
  const available = await canBindTcpPort(port, '127.0.0.1')
  return available
    ? { ok: true }
    : { ok: false, message: `port ${port} is in use` }
}

function canBindTcpPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const server = createServer()
    const settle = (available: boolean): void => {
      if (settled) return
      settled = true
      server.removeAllListeners('error')
      resolve(available)
    }
    server.unref()
    server.once('error', () => settle(false))
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => settle(true))
    })
  })
}

async function waitForDragonStartup(startedChild: ChildProcess): Promise<void> {
  if (startedChild.exitCode !== null) {
    throw new Error(describeDragonExit(startedChild.exitCode, null))
  }
  await new Promise<void>((resolve, reject) => {
    let settled = false
    let stdoutBuffer = ''
    let stderrTail = ''
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(describeDragonStartupTimeout(stderrTail)))
    }, DRAGON_STARTUP_TIMEOUT_MS)
    const cleanup = (): void => {
      clearTimeout(timer)
      startedChild.removeListener('exit', onExit)
      startedChild.removeListener('error', onError)
      startedChild.stdout?.removeListener('data', onStdout)
      startedChild.stderr?.removeListener('data', onStderr)
    }
    const tryParseReady = (): boolean => {
      const markerIndex = stdoutBuffer.indexOf(DRAGON_READY_PREFIX)
      if (markerIndex < 0) return false
      const afterPrefix = stdoutBuffer.slice(markerIndex + DRAGON_READY_PREFIX.length)
      const newlineIndex = afterPrefix.indexOf('\n')
      if (newlineIndex < 0) return false
      const jsonLine = afterPrefix.slice(0, newlineIndex).trim()
      if (!jsonLine) return false
      try {
        const parsed = JSON.parse(jsonLine) as { service?: string; mode?: string; port?: number }
        return parsed.service === 'dragon' && parsed.mode === 'serve' && typeof parsed.port === 'number'
      } catch {
        return false
      }
    }
    const settleReady = (): void => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const onStdout = (chunk: Buffer | string): void => {
      stdoutBuffer = appendTail(stdoutBuffer, String(chunk), STDERR_TAIL_MAX_CHARS * 2)
      if (tryParseReady()) settleReady()
    }
    const onStderr = (chunk: Buffer | string): void => {
      stderrTail = appendTail(stderrTail, String(chunk))
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(describeDragonExit(code, signal, stderrTail)))
    }
    const onError = (error: Error): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    startedChild.stdout?.on('data', onStdout)
    startedChild.stderr?.on('data', onStderr)
    startedChild.once('exit', onExit)
    startedChild.once('error', onError)
  })
}

function describeDragonExit(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderrTail = ''
): string {
  const suffix = stderrTail.trim() ? `\n${stderrTail.trim()}` : ''
  if (signal) return `Dragon exited during startup with signal ${signal}${suffix}`
  if (typeof code === 'number') return `Dragon exited during startup with code ${code}${suffix}`
  return `Dragon exited during startup${suffix}`
}

function describeDragonStartupTimeout(stderrTail: string): string {
  const suffix = stderrTail.trim() ? `\n${stderrTail.trim()}` : ''
  return `Dragon did not report ready within ${DRAGON_STARTUP_TIMEOUT_MS}ms${suffix}`
}
