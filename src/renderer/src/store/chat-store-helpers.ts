import type { ChatBlock, NormalizedThread } from '../agent/types'
import {
  CLAW_MANAGED_INSTRUCTIONS_HEADING,
  type ClawImAgentProfileV1,
  type ClawImChannelV1,
  type ClawImPlatformCredentialV1,
  type ClawImProvider
} from '@shared/app-settings'
import type { ModelProviderModelGroup } from '@shared/sino-code-api'
import type { ChatState } from './chat-store-types'
import {
  isClawWorkspacePath,
  isInternalWriteWorkspace,
  isInternalTemporaryWorkspace,
  normalizeWorkspaceRoot,
  workspaceRootIdentityKey
} from '../lib/workspace-path'
import { readBrowserStorageItem, writeBrowserStorageItem } from '../lib/browser-storage'

const COMPOSER_MODEL_STORAGE_KEY = 'sinocode.composerModel'
const TURN_MODEL_STORAGE_KEY = 'sinocode.turnModelLabel'
const CODE_WORKSPACE_ROOTS_STORAGE_KEY = 'sinocode.codeWorkspaceRoots.v1'
const COMPOSER_PROVIDER_AUTO_PREFIX = '__provider_auto__:'
export const MAX_CODE_WORKSPACE_ROOTS = 30
export const MAX_TURN_MODEL_LABELS = 500

export function providerAutoComposerModelId(providerId: string): string {
  const id = providerId.trim()
  return id ? `${COMPOSER_PROVIDER_AUTO_PREFIX}${id}` : 'auto'
}

export function providerIdFromComposerAutoModel(model: string): string | null {
  const trimmed = model.trim()
  if (!trimmed.startsWith(COMPOSER_PROVIDER_AUTO_PREFIX)) return null
  const providerId = trimmed.slice(COMPOSER_PROVIDER_AUTO_PREFIX.length).trim()
  return providerId || null
}

export function composerRequestModel(model: string): string {
  const trimmed = model.trim()
  return providerIdFromComposerAutoModel(trimmed) ? 'auto' : trimmed
}

function providerGroupLabel(group: ModelProviderModelGroup): string {
  return group.label.trim() || group.providerId.trim()
}

function modelLabelForProviderGroup(model: string, group: ModelProviderModelGroup): string {
  return group.modelLabels?.[model]?.trim() || model
}

function providerGroupForId(
  providerId: string,
  providerGroups: readonly ModelProviderModelGroup[]
): ModelProviderModelGroup | undefined {
  return providerGroups.find((group) => group.providerId.trim() === providerId)
}

function providerGroupForModel(
  model: string,
  providerGroups: readonly ModelProviderModelGroup[]
): ModelProviderModelGroup | undefined {
  return providerGroups.find((group) =>
    group.modelIds.some((id) => id.trim() === model)
  )
}

export function providerIdForComposerModel(
  model: string,
  providerGroups: readonly ModelProviderModelGroup[] = []
): string | null {
  const trimmed = model.trim()
  if (!trimmed) return null
  const autoProviderId = providerIdFromComposerAutoModel(trimmed)
  if (autoProviderId) return autoProviderId
  if (trimmed.toLowerCase() === 'auto') return null
  return providerGroupForModel(trimmed, providerGroups)?.providerId.trim() || null
}

export function composerModelDisplayLabel(
  model: string,
  providerGroups: readonly ModelProviderModelGroup[] = []
): string | undefined {
  const trimmed = model.trim()
  if (!trimmed) return undefined
  const autoProviderId = providerIdFromComposerAutoModel(trimmed)
  if (autoProviderId) {
    const group = providerGroupForId(autoProviderId, providerGroups)
    const label = group ? providerGroupLabel(group) : ''
    return label ? `${label} / AUTO` : 'AUTO'
  }
  if (trimmed.toLowerCase() === 'auto') return 'AUTO'
  const group = providerGroupForModel(trimmed, providerGroups)
  return group ? `${providerGroupLabel(group)} / ${modelLabelForProviderGroup(trimmed, group)}` : trimmed
}

export function modelDisplayNameForModel(
  model: string,
  providerGroups: readonly ModelProviderModelGroup[] = []
): string | undefined {
  const trimmed = model.trim()
  if (!trimmed) return undefined
  if (providerIdFromComposerAutoModel(trimmed) || trimmed.toLowerCase() === 'auto') return 'AUTO'
  const group = providerGroupForModel(trimmed, providerGroups)
  return group ? modelLabelForProviderGroup(trimmed, group) : trimmed
}

export function isAllowedComposerModel(
  model: string,
  allowedIds: readonly string[],
  providerGroups: readonly ModelProviderModelGroup[] = []
): boolean {
  const trimmed = model.trim()
  if (!trimmed) return false
  if (allowedIds.includes(trimmed)) return true
  const providerId = providerIdFromComposerAutoModel(trimmed)
  if (!providerId) return false
  const hasAuto = allowedIds.some((id) => id.trim().toLowerCase() === 'auto')
  if (!hasAuto) return false
  return providerGroups.some((group) =>
    group.providerId.trim() === providerId && group.modelIds.some((id) => id.trim())
  )
}

export function readStoredComposerModel(
  allowedIds: readonly string[],
  providerGroups: readonly ModelProviderModelGroup[] = []
): string {
  const raw = readBrowserStorageItem(COMPOSER_MODEL_STORAGE_KEY)
  if (raw === null) return ''
  if (raw === '') return ''
  if (isAllowedComposerModel(raw, allowedIds, providerGroups)) return raw
  return ''
}

export function persistComposerModel(model: string): void {
  writeBrowserStorageItem(COMPOSER_MODEL_STORAGE_KEY, model)
}

export function compactCodeWorkspaceRoots(workspaceRoots: readonly (string | undefined | null)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const workspaceRoot of workspaceRoots) {
    const normalized = normalizeWorkspaceRoot(workspaceRoot ?? '').replace(/[\\/]+$/, '')
    if (!normalized) continue
    if (isInternalTemporaryWorkspace(normalized)) continue
    if (isInternalWriteWorkspace(normalized)) continue
    if (isClawWorkspacePath(normalized)) continue
    const key = workspaceRootIdentityKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out.slice(0, MAX_CODE_WORKSPACE_ROOTS)
}

export function readCodeWorkspaceRoots(): string[] {
  try {
    const raw = readBrowserStorageItem(CODE_WORKSPACE_ROOTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return compactCodeWorkspaceRoots(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return []
  }
}

export function saveCodeWorkspaceRoots(workspaceRoots: readonly string[]): void {
  writeBrowserStorageItem(
    CODE_WORKSPACE_ROOTS_STORAGE_KEY,
    JSON.stringify(compactCodeWorkspaceRoots(workspaceRoots))
  )
}

export function rememberCodeWorkspaceRoots(
  currentRoots: readonly string[],
  workspaceRoots: readonly (string | undefined | null)[]
): string[] {
  const next = compactCodeWorkspaceRoots([...workspaceRoots, ...currentRoots])
  saveCodeWorkspaceRoots(next)
  return next
}

export function forgetCodeWorkspaceRoot(
  currentRoots: readonly string[],
  workspaceRoot: string
): string[] {
  const normalized = normalizeWorkspaceRoot(workspaceRoot)
  const key = workspaceRootIdentityKey(normalized)
  const next = compactCodeWorkspaceRoots(
    currentRoots.filter((root) => workspaceRootIdentityKey(normalizeWorkspaceRoot(root)) !== key)
  )
  saveCodeWorkspaceRoots(next)
  return next
}

export function mergeComposerPickList(upstreamOk: boolean, upstreamIds: string[]): string[] {
  const ordered = new Set<string>()
  ordered.add('auto')
  if (upstreamOk) {
    for (const id of upstreamIds) {
      if (id.trim()) ordered.add(id.trim())
    }
  }
  const tail = [...ordered].filter((id) => id !== 'auto').sort((a, b) => a.localeCompare(b))
  return ['auto', ...tail]
}

export function newClawChannel(
  provider: ClawImProvider,
  agentProfile?: Partial<ClawImAgentProfileV1>,
  platformCredential?: ClawImPlatformCredentialV1
): ClawImChannelV1 {
  const now = new Date().toISOString()
  const fallbackId = `im-${provider}-${Date.now()}`
  const defaultName = defaultClawProviderLabel(provider)
  const profileName = agentProfile?.name?.trim() || defaultName
  return {
    id: globalThis.crypto?.randomUUID?.() ?? fallbackId,
    provider,
    label: profileName,
    enabled: true,
    model: 'auto',
    threadId: '',
    workspaceRoot: '',
    conversations: [],
    agentProfile: {
      name: profileName,
      description: agentProfile?.description?.trim() ?? '',
      identity: agentProfile?.identity ?? '',
      personality: agentProfile?.personality ?? '',
      userContext: agentProfile?.userContext ?? '',
      replyRules: agentProfile?.replyRules ?? ''
    },
    ...(platformCredential ? { platformCredential } : {}),
    createdAt: now,
    updatedAt: now
  }
}

export function normalizeClawComposerModel(raw: string): string {
  const trimmed = raw.trim()
  return trimmed || 'auto'
}

export function activeClawChannel(
  state: Pick<ChatState, 'clawChannels' | 'activeClawChannelId'>
): ClawImChannelV1 | null {
  return state.clawChannels.find((channel) => channel.id === state.activeClawChannelId) ?? null
}

function addClawThreadId(ids: Set<string>, threadId: string | undefined): void {
  const id = threadId?.trim() ?? ''
  if (id) ids.add(id)
}

export function clawThreadIdsFromChannels(
  channels: ClawImChannelV1[]
): Set<string> {
  const ids = new Set<string>()
  for (const channel of channels) {
    addClawThreadId(ids, channel.threadId)
    for (const conversation of channel.conversations) {
      addClawThreadId(ids, conversation.localThreadId)
    }
  }
  return ids
}

export function clawThreadTitleLooksManaged(title: string | undefined): boolean {
  const trimmed = title?.trim() ?? ''
  return trimmed.startsWith(CLAW_MANAGED_INSTRUCTIONS_HEADING) ||
    trimmed.startsWith('[Claw:') ||
    trimmed.startsWith('[Claw IM:') ||
    trimmed.startsWith('[Claw]')
}

export function isClawThread(
  thread: Pick<NormalizedThread, 'id' | 'title'>,
  channels: ClawImChannelV1[] = []
): boolean {
  return clawThreadTitleLooksManaged(thread.title) || clawThreadIdsFromChannels(channels).has(thread.id)
}

export function optimisticUserModelLabel(
  composerModel: string,
  threadModel: string | undefined,
  providerGroups: readonly ModelProviderModelGroup[] = []
): string | undefined {
  const composerLabel = composerModelDisplayLabel(composerModel, providerGroups)
  if (composerLabel) return composerLabel
  return threadModel ? composerModelDisplayLabel(threadModel, providerGroups) : undefined
}

export function rememberTurnModel(threadId: string, itemId: string, model: string): void {
  const thread = threadId.trim()
  const item = itemId.trim()
  const label = model.trim()
  if (!thread || !item || !label) return
  const key = `${thread}|${item}`
  const map = loadTurnModelMap()
  delete map[key]
  map[key] = label
  saveTurnModelMap(map)
}

export function hydrateBlockModelLabels(threadId: string, blocks: ChatBlock[]): ChatBlock[] {
  const map = loadTurnModelMap()
  let changed = false
  const next = blocks.map((block) => {
    if (block.kind !== 'user') return block
    if (block.modelLabel) return block
    const label = map[`${threadId}|${block.id}`]
    if (!label) return block
    changed = true
    return { ...block, modelLabel: label }
  })
  return changed ? next : blocks
}

function defaultClawProviderLabel(provider: ClawImProvider): string {
  if (provider === 'weixin') return 'weixin agent'
  return 'feishu agent'
}

function loadTurnModelMap(): Record<string, string> {
  try {
    const raw = readBrowserStorageItem(TURN_MODEL_STORAGE_KEY)
    if (!raw) return {}
    return normalizeTurnModelMap(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function normalizeTurnModelMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const entries: Array<[string, string]> = []
  for (const [rawKey, rawValue] of Object.entries(raw as Record<string, unknown>)) {
    const key = rawKey.trim()
    const value = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (!key || !key.includes('|') || !value) continue
    entries.push([key, value])
  }
  const recent = entries.slice(-MAX_TURN_MODEL_LABELS)
  return Object.fromEntries(recent)
}

function saveTurnModelMap(map: Record<string, string>): void {
  writeBrowserStorageItem(TURN_MODEL_STORAGE_KEY, JSON.stringify(normalizeTurnModelMap(map)))
}
