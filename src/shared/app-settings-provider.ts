import {
  DEFAULT_MODEL_ENDPOINT_FORMAT,
  type AppSettingsV1,
  type DragonRuntimeSettingsV1,
  type ModelDetailV1,
  type ModelProviderProfilePatchV1,
  type ModelProviderProfileV1,
  type ModelProviderSettingsPatchV1,
  type ModelProviderSettingsV1
} from './app-settings-types'
import { normalizeModelEndpointFormat } from '../../dragon/src/contracts/model-endpoint-format.js'
import { getDragonRuntimeSettings } from './app-settings-dragon'
import { normalizeBaseUrl } from './app-settings-normalizers'

const LEGACY_DEEPSEEK_IMPLICIT_MODEL_IDS = new Set([
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'deepseek-chat',
  'deepseek-reasoner'
])

export function defaultModelProviderSettings(): ModelProviderSettingsV1 {
  return {
    apiKey: '',
    baseUrl: '',
    providers: []
  }
}

export function normalizeModelProviderSettings(
  input: ModelProviderSettingsPatchV1 | undefined
): ModelProviderSettingsV1 {
  const rawProviders = Array.isArray(input?.providers) ? input.providers : []
  const providersById = new Map<string, ModelProviderProfileV1>()
  for (const rawProvider of rawProviders) {
    const provider = normalizeModelProviderProfile(rawProvider)
    if (!provider) continue
    providersById.set(provider.id, provider)
  }
  const providers = [...providersById.values()]
  return {
    apiKey: '',
    baseUrl: '',
    providers
  }
}

export function mergeModelProviderSettings(
  current: ModelProviderSettingsV1,
  patch: ModelProviderSettingsPatchV1 | undefined
): ModelProviderSettingsV1 {
  return normalizeModelProviderSettings({
    ...current,
    ...(patch ?? {})
  })
}

export function getModelProviderSettings(settings: AppSettingsV1): ModelProviderSettingsV1 {
  return normalizeModelProviderSettings((settings as { provider?: ModelProviderSettingsPatchV1 }).provider)
}

export function modelProviderSettingsPatch(
  provider: ModelProviderSettingsPatchV1 | undefined
): ModelProviderSettingsPatchV1 {
  return provider ? { ...provider } : {}
}

export function resolveModelProviderApiKey(settings: AppSettingsV1, providerId?: string): string {
  return getModelProviderProfile(settings, providerId)?.apiKey.trim() ?? ''
}

export function resolveModelProviderBaseUrl(settings: AppSettingsV1, providerId?: string): string {
  const baseUrl = getModelProviderProfile(settings, providerId)?.baseUrl
  return baseUrl ? normalizeConfiguredBaseUrl(baseUrl) : ''
}

export function getModelProviderProfile(
  settings: AppSettingsV1,
  providerId: string | undefined
): ModelProviderProfileV1 | undefined {
  const provider = getModelProviderSettings(settings)
  const id = normalizeModelProviderId(providerId)
  if (!id) return undefined
  return provider.providers.find((profile) => profile.id === id)
}

export function getModelProviderModelDetail(
  settings: AppSettingsV1,
  modelId: string | undefined,
  providerId?: string
): ModelDetailV1 | undefined {
  const requested = modelId?.trim()
  if (!requested || requested.toLowerCase() === 'auto') return undefined
  const provider = getModelProviderSettings(settings)
  const selectedProviderId = normalizeModelProviderId(providerId)
  const selectedProvider = selectedProviderId
    ? provider.providers.find((profile) => profile.id === selectedProviderId)
    : undefined
  const providers = selectedProvider ? [selectedProvider] : provider.providers
  for (const profile of providers) {
    const detail = findProviderModelDetail(profile, requested)
    if (detail) return detail
  }
  return undefined
}

export function listModelProviderModelIds(settings: AppSettingsV1): string[] {
  const ids = new Set<string>()
  for (const provider of getModelProviderSettings(settings).providers) {
    for (const model of provider.models) {
      const trimmed = model.trim()
      if (trimmed) ids.add(trimmed)
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b))
}

export function resolveDragonRuntimeSettings(settings: AppSettingsV1): DragonRuntimeSettingsV1 {
  const runtime = getDragonRuntimeSettings(settings)
  const provider = getModelProviderProfile(settings, runtime.providerId)
  const runtimeApiKey = runtime.apiKey?.trim() ?? ''
  const runtimeBaseUrl = runtime.baseUrl?.trim() ?? ''
  const providerBaseUrl = provider?.baseUrl.trim() ?? ''
  const runtimeModel = runtime.model?.trim() ?? ''

  if (!provider) {
    return {
      ...runtime,
      apiKey: '',
      baseUrl: '',
      endpointFormat: runtime.endpointFormat
    }
  }

  return {
    ...runtime,
    apiKey: runtimeApiKey || provider.apiKey.trim(),
    baseUrl: runtimeBaseUrl
      ? normalizeConfiguredBaseUrl(runtimeBaseUrl)
      : normalizeConfiguredBaseUrl(providerBaseUrl),
    endpointFormat: provider.endpointFormat,
    model: runtimeModel && runtimeModel.toLowerCase() !== 'auto'
      ? runtimeModel
      : providerDefaultRouteModel(provider)
  }
}

function providerDefaultRouteModel(provider: ModelProviderProfileV1): string {
  const mainModel = provider.mainModelId?.trim() ?? ''
  const fastModel = provider.fastModelId?.trim() ?? ''
  if (mainModel && provider.models.includes(mainModel)) return mainModel
  if (fastModel && provider.models.includes(fastModel)) return fastModel
  return ''
}

function normalizeModelDetails(input: unknown): Record<string, ModelDetailV1> | undefined {
  if (!input || typeof input !== 'object') return undefined
  const result: Record<string, ModelDetailV1> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!value || typeof value !== 'object') continue
    const detail = value as Record<string, any>
    const id = typeof detail.id === 'string' ? detail.id.trim() : key
    if (!id) continue

    let thinkingLevel: string[] | undefined = undefined
    if (Array.isArray(detail.thinkingLevel)) {
      thinkingLevel = detail.thinkingLevel.filter((x): x is string => typeof x === 'string')
    } else if (typeof detail.thinkingLevel === 'boolean') {
      thinkingLevel = detail.thinkingLevel ? ['low', 'medium', 'high', 'max'] : []
    }

    result[key] = {
      id,
      name: typeof detail.name === 'string' && detail.name.trim() ? detail.name : undefined,
      priceInput: typeof detail.priceInput === 'string' ? detail.priceInput.trim() : undefined,
      priceOutput: typeof detail.priceOutput === 'string' ? detail.priceOutput.trim() : undefined,
      priceInputCacheRead: typeof detail.priceInputCacheRead === 'string' ? detail.priceInputCacheRead.trim() : undefined,
      priceInputCacheWrite: typeof detail.priceInputCacheWrite === 'string' ? detail.priceInputCacheWrite.trim() : undefined,
      maxContext: typeof detail.maxContext === 'number' && !isNaN(detail.maxContext) ? detail.maxContext : undefined,
      maxOutput: typeof detail.maxOutput === 'number' && !isNaN(detail.maxOutput) ? detail.maxOutput : undefined,
      supportsThinking: typeof detail.supportsThinking === 'boolean' ? detail.supportsThinking : undefined,
      thinkingLevel
    }
  }
  return result
}

function normalizeModelProviderProfile(
  input: ModelProviderProfilePatchV1 | undefined
): ModelProviderProfileV1 | null {
  const id = normalizeModelProviderId(input?.id)
  if (!id) return null
  const name = typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : id
  const baseUrl =
    typeof input?.baseUrl === 'string' && input.baseUrl.trim()
      ? normalizeConfiguredBaseUrl(input.baseUrl)
      : ''
  const modelDetails = normalizeModelDetails(input?.modelDetails)
  const models = normalizeProviderModelsForProfile(id, input?.models, modelDetails)
  const mainModelId = normalizeProviderRouteModelId(input?.mainModelId, models)
  const fastModelId = normalizeProviderRouteModelId(input?.fastModelId, models)
  return {
    id,
    name,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : '',
    baseUrl,
    endpointFormat: normalizeModelEndpointFormat(input?.endpointFormat),
    models,
    ...(mainModelId ? { mainModelId } : {}),
    ...(fastModelId ? { fastModelId } : {}),
    modelDetails
  }
}

function normalizeProviderModels(models: unknown): string[] {
  if (!Array.isArray(models)) return []
  const ids = new Set<string>()
  for (const model of models) {
    if (typeof model !== 'string') continue
    const trimmed = model.trim()
    if (trimmed) ids.add(trimmed)
  }
  return [...ids].sort((a, b) => a.localeCompare(b))
}

function normalizeProviderModelsForProfile(
  providerId: string,
  models: unknown,
  modelDetails: Record<string, ModelDetailV1> | undefined
): string[] {
  const normalizedModels = normalizeProviderModels(models)
  if (providerId !== 'deepseek') return normalizedModels
  const explicitDetailIds = new Set<string>()
  for (const [key, detail] of Object.entries(modelDetails ?? {})) {
    const keyId = key.trim().toLowerCase()
    const detailId = detail.id.trim().toLowerCase()
    if (keyId) explicitDetailIds.add(keyId)
    if (detailId) explicitDetailIds.add(detailId)
  }
  return normalizedModels.filter((model) => {
    const normalized = model.trim().toLowerCase()
    if (!LEGACY_DEEPSEEK_IMPLICIT_MODEL_IDS.has(normalized)) return true
    return explicitDetailIds.has(normalized)
  })
}

function normalizeProviderRouteModelId(value: unknown, models: readonly string[]): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || trimmed.toLowerCase() === 'auto') return ''
  return models.includes(trimmed) ? trimmed : ''
}

export function normalizeModelProviderId(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
    : ''
}

function findProviderModelDetail(
  provider: ModelProviderProfileV1,
  modelId: string
): ModelDetailV1 | undefined {
  const details = provider.modelDetails
  if (!details) return undefined
  for (const [key, detail] of Object.entries(details)) {
    if (modelIdMatches(modelId, key) || modelIdMatches(modelId, detail.id)) return detail
  }
  return undefined
}

function modelIdMatches(requested: string, configured: string | undefined): boolean {
  const requestedNormalized = requested.trim().toLowerCase()
  const configuredNormalized = configured?.trim().toLowerCase() ?? ''
  return Boolean(
    requestedNormalized &&
    configuredNormalized &&
    (requestedNormalized === configuredNormalized ||
      requestedNormalized.endsWith(`/${configuredNormalized}`))
  )
}

function normalizeConfiguredBaseUrl(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed ? normalizeBaseUrl(trimmed) : ''
}
