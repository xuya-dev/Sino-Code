import {
  getModelProviderSettings,
  listModelProviderModelIds,
  type AppSettingsV1
} from '../shared/app-settings'
import type { ModelProviderModelGroup } from '../shared/sino-code-api'

export type FetchUpstreamModelsResult =
  | { ok: true; modelIds: string[]; modelGroups?: ModelProviderModelGroup[] }
  | { ok: false; message: string }

export async function fetchUpstreamModelIds(
  settings: AppSettingsV1,
  _apiKey: string
): Promise<FetchUpstreamModelsResult> {
  const configuredModelIds = await readConfiguredDragonModelIds(settings)
  const configuredGroups = await readConfiguredModelGroups(settings)
  return modelListOrError(
    configuredModelIds,
    configuredGroups,
    'No configured provider models. Add models in Settings > Providers or fetch and save a provider model list.'
  )
}

export async function readConfiguredDragonModelIds(settings: AppSettingsV1): Promise<string[]> {
  const providerModelIds = listModelProviderModelIds(settings)
  return mergeModelIds(providerModelIds)
}

function modelListOrError(
  ids: readonly string[],
  groups: readonly ModelProviderModelGroup[],
  message: string
): FetchUpstreamModelsResult {
  return hasCustomModelId(ids)
    ? { ok: true, modelIds: mergeModelIds(ids), modelGroups: mergeModelGroups(groups) }
    : { ok: false, message }
}

async function readConfiguredModelGroups(settings: AppSettingsV1): Promise<ModelProviderModelGroup[]> {
  const groups: ModelProviderModelGroup[] = []
  for (const provider of getModelProviderSettings(settings).providers) {
    if (provider.models.length === 0) continue
    const modelLabels = provider.models.reduce<Record<string, string>>((acc, modelId) => {
      const label = provider.modelDetails?.[modelId]?.name?.trim()
      if (label) acc[modelId] = label
      return acc
    }, {})
    groups.push({
      providerId: provider.id,
      label: provider.name,
      modelIds: provider.models,
      ...(Object.keys(modelLabels).length > 0 ? { modelLabels } : {})
    })
  }
  return mergeModelGroups([
    ...groups
  ])
}

function mergeModelGroups(groups: readonly ModelProviderModelGroup[]): ModelProviderModelGroup[] {
  const byProvider = new Map<string, ModelProviderModelGroup>()
  for (const group of groups) {
    const providerId = group.providerId.trim()
    if (!providerId) continue
    const existing = byProvider.get(providerId)
    const modelIds = sortComposerModelIds([
      ...(existing?.modelIds ?? []),
      ...group.modelIds
    ]).filter((id) => id !== 'auto')
    const modelLabels = { ...(existing?.modelLabels ?? {}) }
    for (const modelId of modelIds) {
      const label = group.modelLabels?.[modelId]?.trim()
      if (label) modelLabels[modelId] = label
    }
    for (const modelId of Object.keys(modelLabels)) {
      if (!modelIds.includes(modelId)) delete modelLabels[modelId]
    }
    byProvider.set(providerId, {
      providerId,
      label: group.label.trim() || providerId,
      modelIds,
      ...(Object.keys(modelLabels).length > 0 ? { modelLabels } : {})
    })
  }
  return [...byProvider.values()].filter((group) => group.modelIds.length > 0)
}

function mergeModelIds(ids: readonly string[]): string[] {
  return sortComposerModelIds(['auto', ...ids])
}

function hasCustomModelId(ids: readonly string[]): boolean {
  return ids.some((id) => {
    const trimmed = id.trim()
    return trimmed !== '' && trimmed !== 'auto'
  })
}

function sortComposerModelIds(ids: readonly string[]): string[] {
  const ordered = new Set<string>()
  for (const id of ids) {
    const trimmed = id.trim()
    if (trimmed) ordered.add(trimmed)
  }
  const tail = [...ordered].filter((id) => id !== 'auto').sort((a, b) => a.localeCompare(b))
  return ordered.has('auto') ? ['auto', ...tail] : tail
}
