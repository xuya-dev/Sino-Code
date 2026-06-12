import type {
  ModelCapabilityMetadata,
  ModelInputModality,
  ModelMessagePartSupport
} from '../contracts/capabilities.js'

export type ModelContextThresholds = {
  softThreshold: number
  hardThreshold: number
}

export type ModelContextCompactionProfileConfig = {
  softRatio?: number
  hardRatio?: number
  softThreshold?: number
  hardThreshold?: number
}

export type ModelContextProfile = ModelContextThresholds & {
  canonicalModel: string
  modelIds: readonly string[]
  contextWindowTokens: number
  inputModalities: readonly ModelInputModality[]
  outputModalities: readonly ModelInputModality[]
  supportsToolCalling: boolean
  messageParts: readonly ModelMessagePartSupport[]
}

export type ModelContextProfileConfig = {
  aliases?: readonly string[]
  contextWindowTokens?: number
  contextCompaction?: ModelContextCompactionProfileConfig
  /** @deprecated Use contextCompaction.softRatio. */
  softRatio?: number
  /** @deprecated Use contextCompaction.hardRatio. */
  hardRatio?: number
  /** @deprecated Use contextCompaction.softThreshold. */
  softThreshold?: number
  /** @deprecated Use contextCompaction.hardThreshold. */
  hardThreshold?: number
  inputModalities?: readonly ModelInputModality[]
  outputModalities?: readonly ModelInputModality[]
  supportsToolCalling?: boolean
  messageParts?: readonly ModelMessagePartSupport[]
  priceInput?: string
  priceOutput?: string
  priceInputCacheRead?: string
  priceInputCacheWrite?: string
  supportsThinking?: boolean
  thinkingLevel?: readonly string[]
}

export type AutoModelRoutingConfig = {
  mainModel?: string
  fastModel?: string
  routerModel?: string
}

export type ModelConfig = {
  profiles?: Record<string, ModelContextProfileConfig>
  autoRouting?: AutoModelRoutingConfig
}

export type ContextCompactionConfig = {
  defaultSoftThreshold?: number
  defaultHardThreshold?: number
  summaryMode?: 'heuristic' | 'model'
  summaryTimeoutMs?: number
  summaryMaxTokens?: number
  summaryInputMaxBytes?: number
  /**
   * @deprecated Model-specific context windows and compaction thresholds belong
   * in top-level models.profiles. This field is still read for compatibility.
   */
  modelProfiles?: Record<string, ModelContextProfileConfig>
}

export type ModelProfileConfigSource = {
  models?: ModelConfig
  contextCompaction?: ContextCompactionConfig
}

export const DEFAULT_CONTEXT_THRESHOLDS: ModelContextThresholds = {
  softThreshold: 16_000,
  hardThreshold: 24_000
}

const DEFAULT_SOFT_THRESHOLD_RATIO = 0.98
const DEFAULT_HARD_THRESHOLD_RATIO = 0.99
const DEFAULT_MODEL_INPUT_MODALITIES: readonly ModelInputModality[] = ['text']
const DEFAULT_MODEL_OUTPUT_MODALITIES: readonly ModelInputModality[] = ['text']
const DEFAULT_MODEL_MESSAGE_PARTS: readonly ModelMessagePartSupport[] = ['text']

export const MODEL_CONTEXT_PROFILES: readonly ModelContextProfile[] = []

export function resolveModelContextProfile(
  model: string | undefined,
  profiles: readonly ModelContextProfile[] = MODEL_CONTEXT_PROFILES
): ModelContextProfile | null {
  const normalized = normalizeModelId(model)
  if (!normalized) return null
  return profiles.find((profile) =>
    profile.modelIds.some((modelId) => normalized === modelId || normalized.endsWith(`/${modelId}`))
  ) ?? null
}

export function contextThresholdsForModel(
  model: string | undefined,
  fallback: ModelContextThresholds = DEFAULT_CONTEXT_THRESHOLDS,
  profiles: readonly ModelContextProfile[] = MODEL_CONTEXT_PROFILES
): ModelContextThresholds {
  const profile = resolveModelContextProfile(model, profiles)
  if (!profile) return fallback
  return {
    softThreshold: profile.softThreshold,
    hardThreshold: profile.hardThreshold
  }
}

export function modelCapabilitiesForModel(
  model: string | undefined,
  profiles: readonly ModelContextProfile[] = MODEL_CONTEXT_PROFILES
): ModelCapabilityMetadata {
  const profile = resolveModelContextProfile(model, profiles)
  return {
    id: model?.trim() || profile?.canonicalModel || 'auto',
    inputModalities: [...(profile?.inputModalities ?? DEFAULT_MODEL_INPUT_MODALITIES)],
    outputModalities: [...(profile?.outputModalities ?? DEFAULT_MODEL_OUTPUT_MODALITIES)],
    supportsToolCalling: profile?.supportsToolCalling ?? true,
    contextWindowTokens: profile?.contextWindowTokens,
    messageParts: [...(profile?.messageParts ?? DEFAULT_MODEL_MESSAGE_PARTS)]
  }
}

export function modelContextProfilesFromConfig(
  config?: ContextCompactionConfig | ModelConfig | ModelProfileConfigSource
): readonly ModelContextProfile[] {
  const byCanonical = new Map<string, ModelContextProfile>()
  for (const profile of MODEL_CONTEXT_PROFILES) {
    byCanonical.set(normalizeModelId(profile.canonicalModel), profile)
  }
  const profileGroups = modelProfileGroupsFromConfig(config)
  if (profileGroups.length === 0) return [...byCanonical.values()]
  for (const profiles of profileGroups) {
    for (const [modelId, rawProfile] of Object.entries(profiles)) {
      const canonicalModel = normalizeModelId(modelId)
      if (!canonicalModel) continue
      const current = byCanonical.get(canonicalModel)
      if (!current && !hasModelContextProfileFields(rawProfile)) continue
      const next = mergeModelContextProfile(canonicalModel, current, rawProfile)
      byCanonical.set(canonicalModel, next)
    }
  }
  return [...byCanonical.values()]
}

function mergeModelContextProfile(
  canonicalModel: string,
  current: ModelContextProfile | undefined,
  input: ModelContextProfileConfig
): ModelContextProfile {
  const compaction = input.contextCompaction ?? {}
  const configuredContextWindowTokens = input.contextWindowTokens ?? current?.contextWindowTokens
  const softThreshold = compaction.softThreshold ?? input.softThreshold ?? thresholdFromWindow({
    contextWindowTokens: configuredContextWindowTokens,
    ratio: compaction.softRatio ?? input.softRatio,
    fallbackRatio: current
      ? current.softThreshold / current.contextWindowTokens
      : DEFAULT_SOFT_THRESHOLD_RATIO,
    fallbackThreshold: current?.softThreshold
  })
  const hardThreshold = compaction.hardThreshold ?? input.hardThreshold ?? thresholdFromWindow({
    contextWindowTokens: configuredContextWindowTokens,
    ratio: compaction.hardRatio ?? input.hardRatio,
    fallbackRatio: current
      ? current.hardThreshold / current.contextWindowTokens
      : DEFAULT_HARD_THRESHOLD_RATIO,
    fallbackThreshold: current?.hardThreshold
  })
  const contextWindowTokens =
    configuredContextWindowTokens ?? Math.max(softThreshold ?? 0, hardThreshold ?? 0)
  if (!contextWindowTokens || !softThreshold || !hardThreshold) {
    throw new Error(`model context profile "${canonicalModel}" needs a context window or thresholds`)
  }
  if (hardThreshold < softThreshold) {
    throw new Error(`model context profile "${canonicalModel}" hard threshold must be >= soft threshold`)
  }
  const modelIds = uniqueModelIds([
    canonicalModel,
    ...(current?.modelIds ?? []),
    ...(input.aliases ?? [])
  ])
  return {
    canonicalModel,
    modelIds,
    contextWindowTokens,
    softThreshold,
    hardThreshold,
    inputModalities: uniqueModelCapabilityValues(input.inputModalities ?? current?.inputModalities ?? DEFAULT_MODEL_INPUT_MODALITIES),
    outputModalities: uniqueModelCapabilityValues(input.outputModalities ?? current?.outputModalities ?? DEFAULT_MODEL_OUTPUT_MODALITIES),
    supportsToolCalling: input.supportsToolCalling ?? current?.supportsToolCalling ?? true,
    messageParts: uniqueModelCapabilityValues(input.messageParts ?? current?.messageParts ?? DEFAULT_MODEL_MESSAGE_PARTS)
  }
}

function thresholdFromWindow(input: {
  contextWindowTokens: number | undefined
  ratio: number | undefined
  fallbackRatio: number
  fallbackThreshold: number | undefined
}): number | undefined {
  if (!input.contextWindowTokens) return input.fallbackThreshold
  return Math.floor(input.contextWindowTokens * (input.ratio ?? input.fallbackRatio))
}

function modelProfileGroupsFromConfig(
  config: ContextCompactionConfig | ModelConfig | ModelProfileConfigSource | undefined
): Array<Record<string, ModelContextProfileConfig>> {
  if (!config) return []
  if ('models' in config || 'contextCompaction' in config) {
    return [
      ...(config.contextCompaction?.modelProfiles ? [config.contextCompaction.modelProfiles] : []),
      ...(config.models?.profiles ? [config.models.profiles] : [])
    ]
  }
  if ('profiles' in config) {
    return config.profiles ? [config.profiles] : []
  }
  if ('modelProfiles' in config) {
    return config.modelProfiles ? [config.modelProfiles] : []
  }
  return []
}

function hasModelContextProfileFields(input: ModelContextProfileConfig): boolean {
  const compaction = input.contextCompaction
  return (
    input.contextWindowTokens !== undefined ||
    input.softRatio !== undefined ||
    input.hardRatio !== undefined ||
    input.softThreshold !== undefined ||
    input.hardThreshold !== undefined ||
    input.inputModalities !== undefined ||
    input.outputModalities !== undefined ||
    input.supportsToolCalling !== undefined ||
    input.messageParts !== undefined ||
    compaction?.softRatio !== undefined ||
    compaction?.hardRatio !== undefined ||
    compaction?.softThreshold !== undefined ||
    compaction?.hardThreshold !== undefined
  )
}

function uniqueModelIds(values: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = normalizeModelId(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

function uniqueModelCapabilityValues<T extends string>(values: readonly T[]): T[] {
  const out: T[] = []
  const seen = new Set<T>()
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

function normalizeModelId(model: string | undefined): string {
  const normalized = model?.trim().toLowerCase() ?? ''
  return normalized === 'auto' ? '' : normalized
}
