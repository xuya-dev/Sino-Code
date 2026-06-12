import { useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type {
  AppSettingsPatch,
  AppSettingsV1,
  ModelEndpointFormat,
  ModelDetailV1,
  ModelPriceTierV1,
  ModelProviderProfileV1,
  ModelProviderSettingsV1
} from '@shared/app-settings'
import {
  MODEL_ENDPOINT_FORMATS,
  defaultModelProviderSettings,
  normalizeModelProviderId
} from '@shared/app-settings'
import type { ProviderModelsResult } from '@shared/sino-code-api'
import { useTranslation } from 'react-i18next'
import { PROVIDER_PRESETS, getDefaultEndpoint, findEndpointByUrl, type ProviderPreset } from '@shared/provider-presets'
import { ChevronDown, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { ProviderBrandIcon } from './ProviderBrandIcon'
import { SelectDropdown } from './SelectDropdown'
import {
  SecretInput,
  SettingsCard
} from './settings-controls'

const MODEL_ENDPOINT_FORMAT_LABEL_KEYS: Record<string, string> = {
  chat_completions: 'modelEndpointChatCompletions',
  responses: 'modelEndpointResponses',
  messages: 'modelEndpointMessages'
}

type SettingsPopoverPlacement = {
  left: number
  top: number
  width: number
  maxHeight: number
}

type SettingsPopoverAnchorRect = Pick<DOMRect, 'bottom' | 'left'>

const SETTINGS_POPOVER_MARGIN = 8
const SETTINGS_POPOVER_GAP = 4
const SETTINGS_POPOVER_MIN_HEIGHT = 80

export function calculateSettingsPopoverPlacement({
  anchorRect,
  width,
  maxHeight,
  viewportHeight,
  viewportWidth,
  coordinateScale = 1
}: {
  anchorRect: SettingsPopoverAnchorRect
  width: number
  maxHeight: number
  viewportHeight: number
  viewportWidth: number
  coordinateScale?: number
}): SettingsPopoverPlacement {
  const scale = Number.isFinite(coordinateScale) && coordinateScale > 0 ? coordinateScale : 1
  const normalizedAnchorRect = {
    bottom: anchorRect.bottom / scale,
    left: anchorRect.left / scale
  }
  const normalizedViewportHeight = viewportHeight / scale
  const normalizedViewportWidth = viewportWidth / scale
  const availableWidth = Math.max(0, normalizedViewportWidth - SETTINGS_POPOVER_MARGIN * 2)
  const nextWidth = Math.min(width, availableWidth)
  const left = clamp(
    normalizedAnchorRect.left,
    SETTINGS_POPOVER_MARGIN,
    Math.max(SETTINGS_POPOVER_MARGIN, normalizedViewportWidth - SETTINGS_POPOVER_MARGIN - nextWidth)
  )
  const top = normalizedAnchorRect.bottom + SETTINGS_POPOVER_GAP
  const availableHeight = Math.max(
    SETTINGS_POPOVER_MIN_HEIGHT,
    normalizedViewportHeight - top - SETTINGS_POPOVER_MARGIN
  )
  const nextMaxHeight = Math.min(maxHeight, availableHeight)

  return { left, top, width: nextWidth, maxHeight: nextMaxHeight }
}

function currentBodyZoom(): number {
  if (typeof window === 'undefined') return 1
  const zoom = window.getComputedStyle(document.body).zoom
  const parsed = Number.parseFloat(zoom)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function modelProvidersSettingsPatch(input: {
  provider: ModelProviderSettingsV1
  providers: ModelProviderProfileV1[]
  dragon?: Partial<AppSettingsV1['agents']['dragon']>
}): AppSettingsPatch {
  return {
    provider: {
      apiKey: '',
      baseUrl: '',
      providers: input.providers
    },
    ...(input.dragon ? { agents: { dragon: input.dragon } } : {})
  }
}

export function selectedProviderRouteModelId(
  value: string | undefined,
  models: readonly string[]
): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || trimmed.toLowerCase() === 'auto') return ''
  return models.some((model) => model === trimmed) ? trimmed : ''
}

export function buildProviderRouteModelOptions(
  models: readonly string[],
  unsetLabel: string,
  modelDetails: Record<string, ModelDetailV1> = {}
): Array<{ value: string; label: string; description?: string }> {
  const seen = new Set<string>()
  const options: Array<{ value: string; label: string; description?: string }> = [
    { value: '', label: unsetLabel }
  ]
  for (const model of models) {
    const trimmed = model.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    const label = providerModelDisplayName(trimmed, modelDetails)
    options.push({
      value: trimmed,
      label,
      ...(label !== trimmed ? { description: trimmed } : {})
    })
  }
  return options
}

function providerModelDisplayName(
  modelId: string,
  modelDetails: Record<string, ModelDetailV1>
): string {
  const direct = modelDetails[modelId]
  const detail = direct ?? Object.values(modelDetails).find((item) => item.id.trim() === modelId)
  return detail?.name?.trim() || modelId
}

export function ProvidersSettingsSection({ ctx }: { ctx: Record<string, any> }): ReactElement {
  const { i18n } = useTranslation('settings')
  const locale = i18n.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  const {
    t,
    form,
    provider: providerFromContext,
    dragon,
    update,
    updateDragon,
    showApiKey,
    setShowApiKey
  } = ctx

  const provider = providerFromContext ?? form.provider ?? defaultModelProviderSettings()
  const modelProviders = provider.providers as ModelProviderProfileV1[]
  const activeProviderId = dragon.providerId?.trim() || ''
  const activeProvider = modelProviders.find((item) => item.id === activeProviderId)

  const updateModelProviders = (
    providers: ModelProviderProfileV1[],
    dragonPatch?: Partial<AppSettingsV1['agents']['dragon']>
  ): void => {
    update(modelProvidersSettingsPatch({
      provider,
      providers,
      dragon: dragonPatch
    }))
  }
  const updateModelProvider = (id: string, patch: Partial<ModelProviderProfileV1>): void => {
    updateModelProviders(modelProviders.map((item) => {
      if (item.id !== id) return item
      const next = { ...item, ...patch }
      for (const key of ['mainModelId', 'fastModelId'] as const) {
        if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] === undefined) {
          delete next[key]
        }
      }
      return next
    }))
  }
  const updateModelProviderId = (id: string, value: string): void => {
    const isPreset = PROVIDER_PRESETS.some((p) => p.id === id)
    if (isPreset) return
    const nextId = normalizeModelProviderId(value)
    if (!nextId || nextId === id) return
    if (modelProviders.some((item) => item.id === nextId && item.id !== id)) return
    updateModelProviders(
      modelProviders.map((item) => item.id === id ? { ...item, id: nextId } : item),
      activeProviderId === id ? { providerId: nextId } : undefined
    )
  }
  const addModelProvider = (): void => {
    const baseId = 'custom-provider'
    let index = modelProviders.length + 1
    let id = `${baseId}-${index}`
    const used = new Set(modelProviders.map((item) => item.id))
    while (used.has(id)) {
      index += 1
      id = `${baseId}-${index}`
    }
    const nextProvider: ModelProviderProfileV1 = {
      id,
      name: t('modelProviderNewName', { index }),
      apiKey: '',
      baseUrl: 'https://api.example.com/v1',
      endpointFormat: 'chat_completions',
      models: []
    }
    updateModelProviders([...modelProviders, nextProvider], { providerId: id })
  }
  const addPresetProvider = (preset: ProviderPreset): void => {
    const existing = modelProviders.find((p) => p.id === preset.id)
    if (existing) {
      updateDragon({ providerId: preset.id })
      return
    }
    const defaultEp = getDefaultEndpoint(preset)
    const displayName = locale === 'zh' ? preset.nameZh : preset.nameEn
    const nextProvider: ModelProviderProfileV1 = {
      id: preset.id,
      name: displayName,
      apiKey: '',
      baseUrl: defaultEp.baseUrl,
      endpointFormat: 'chat_completions',
      models: []
    }
    updateModelProviders([...modelProviders, nextProvider], { providerId: preset.id })
  }
  const removeModelProvider = (id: string): void => {
    const nextProviders = modelProviders.filter((item) => item.id !== id)
    updateModelProviders(
      nextProviders,
      activeProviderId === id ? { providerId: '' } : undefined
    )
  }
  const isPresetProvider = PROVIDER_PRESETS.some((p) => p.id === activeProvider?.id)
  const canEditActiveProviderId = Boolean(activeProvider && !isPresetProvider)

  return (
    <SettingsCard title={t('sectionProviders')}>
      <ProviderConfigPanel
        modelProviders={modelProviders}
        activeProvider={activeProvider}
        activeProviderId={activeProviderId}
        canEditActiveProviderId={canEditActiveProviderId}
        showApiKey={showApiKey}
        setShowApiKey={setShowApiKey}
        updateDragon={updateDragon}
        updateModelProvider={updateModelProvider}
        updateModelProviderId={updateModelProviderId}
        addModelProvider={addModelProvider}
        addPresetProvider={addPresetProvider}
        locale={locale}
        removeModelProvider={removeModelProvider}
        t={t}
      />
    </SettingsCard>
  )
}

type ProviderConfigPanelProps = {
  modelProviders: ModelProviderProfileV1[]
  activeProvider: ModelProviderProfileV1 | undefined
  activeProviderId: string
  canEditActiveProviderId: boolean
  showApiKey: boolean
  setShowApiKey: (fn: (v: boolean) => boolean | ((v: boolean) => boolean)) => void
  updateDragon: (patch: Record<string, unknown>) => void
  updateModelProvider: (id: string, patch: Partial<ModelProviderProfileV1>) => void
  updateModelProviderId: (id: string, value: string) => void
  addModelProvider: () => void
  addPresetProvider: (preset: ProviderPreset) => void
  locale: string
  removeModelProvider: (id: string) => void
  t: (key: string, options?: Record<string, unknown>) => string
}

function ProviderConfigPanel({
  modelProviders,
  activeProvider,
  activeProviderId,
  canEditActiveProviderId,
  showApiKey,
  setShowApiKey,
  updateDragon,
  updateModelProvider,
  updateModelProviderId,
  addModelProvider,
  addPresetProvider,
  locale,
  removeModelProvider,
  t
}: ProviderConfigPanelProps): ReactElement {
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchModelsNotice, setFetchModelsNotice] = useState<string | null>(null)
  const [endpointMode, setEndpointMode] = useState<'preset' | 'custom'>('preset')
  const [activeThinkingPopModelId, setActiveThinkingPopModelId] = useState<string | null>(null)
  const [activePricingPopModelId, setActivePricingPopModelId] = useState<string | null>(null)
  const [popoverAnchorRect, setPopoverAnchorRect] = useState<DOMRect | null>(null)
  const [showAddProviderMenu, setShowAddProviderMenu] = useState(false)
  const [addProviderAnchorRect, setAddProviderAnchorRect] = useState<DOMRect | null>(null)
  const [modelIdDrafts, setModelIdDrafts] = useState<Record<string, string>>({})
  const modelRowKeysRef = useRef<Map<string, string>>(new Map())
  const modelRowKeySequenceRef = useRef(0)
  const providerOptions = modelProviders.map((item) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === item.id)
    const displayName = preset ? (locale === 'zh' ? preset.nameZh : preset.nameEn) : item.name
    return {
      value: item.id,
      label: displayName,
      icon: <ProviderBrandIcon providerId={item.id} size={16} />
    }
  })

  if (!activeProvider) {
    return (
      <div className="rounded-2xl border border-ds-border bg-ds-card/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {modelProviders.length > 0 ? (
            <SelectDropdown
              value={activeProviderId}
              ariaLabel={t('dragonProvider')}
              placeholder={t('dragonProvider')}
              className="w-[190px] max-w-[260px] shrink-0"
              buttonClassName="rounded-full font-semibold"
              menuWidth={220}
              options={[
                { value: '', label: t('dragonProvider') },
                ...providerOptions
              ]}
              onChange={(value) => updateDragon({ providerId: value })}
            />
          ) : null}
          <button
            type="button"
            onClick={addModelProvider}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ds-border bg-ds-card px-4 text-[12.5px] font-medium text-ds-muted shadow-sm transition hover:bg-ds-hover hover:text-ds-ink"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('modelProviderAdd')}
          </button>
          {PROVIDER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => addPresetProvider(preset)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-ds-border bg-ds-card px-3 text-[12.5px] font-medium text-ds-muted shadow-sm transition hover:bg-ds-hover hover:text-ds-ink"
            >
              <ProviderBrandIcon providerId={preset.id} size={16} />
              {locale === 'zh' ? preset.nameZh : preset.nameEn}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const modelRowStorageKey = (modelId: string): string => `${activeProvider.id}\u0000${modelId}`
  const getModelRowKey = (modelId: string): string => {
    const storageKey = modelRowStorageKey(modelId)
    const existingKey = modelRowKeysRef.current.get(storageKey)
    if (existingKey) return existingKey
    const nextKey = `model-row-${modelRowKeySequenceRef.current}`
    modelRowKeySequenceRef.current += 1
    modelRowKeysRef.current.set(storageKey, nextKey)
    return nextKey
  }

  const matchedPreset = PROVIDER_PRESETS.find((p) => p.id === activeProviderId)
  const activeProviderDisplayName = matchedPreset
    ? (locale === 'zh' ? matchedPreset.nameZh : matchedPreset.nameEn)
    : activeProvider.name
  const matchedEndpoint = matchedPreset ? findEndpointByUrl(matchedPreset, activeProvider.baseUrl) : undefined
  const hasPresetEndpoints = matchedPreset && matchedPreset.endpoints.length > 1
  const isCustomUrl = matchedPreset ? !matchedEndpoint : true
  const showCustomBaseUrlInput = endpointMode === 'custom' || isCustomUrl || !hasPresetEndpoints
  const endpointButtonLabel = showCustomBaseUrlInput || !matchedEndpoint
    ? t('customEndpoint')
    : (locale === 'zh' ? matchedEndpoint.labelZh : matchedEndpoint.labelEn)
  const endpointButtonBaseUrl = showCustomBaseUrlInput || !matchedEndpoint
    ? activeProvider.baseUrl
    : matchedEndpoint.baseUrl
  const routeModelOptions = buildProviderRouteModelOptions(
    activeProvider.models,
    t('modelRouteUnset'),
    activeProvider.modelDetails
  )
  const routeModelIds = routeModelOptions.map((option) => option.value)
  const mainRouteModelId = selectedProviderRouteModelId(activeProvider.mainModelId, routeModelIds)
  const fastRouteModelId = selectedProviderRouteModelId(activeProvider.fastModelId, routeModelIds)

  const handleEndpointSelect = (endpointId: string) => {
    if (!matchedPreset) return
    if (endpointId === '__custom__') {
      setEndpointMode('custom')
      return
    }
    const ep = matchedPreset.endpoints.find((e) => e.id === endpointId)
    if (ep) {
      setEndpointMode('preset')
      updateModelProvider(activeProvider.id, { baseUrl: ep.baseUrl })
    }
  }

  const handleFetchModels = async () => {
    if (!activeProvider.apiKey.trim()) {
      setFetchModelsNotice(t('fetchModelsError', { message: t('dragonApiKeyMissing') }))
      return
    }
    setFetchingModels(true)
    setFetchModelsNotice(null)
    try {
      const result: ProviderModelsResult = await window.sinoCode.fetchProviderModels(
        activeProvider.baseUrl,
        activeProvider.apiKey
      )
      if (result.ok) {
        if (result.modelIds.length > 0) {
          const nextModels = result.modelIds
          const nextDetails = { ...(activeProvider.modelDetails || {}) }
          for (const mId of nextModels) {
            if (!nextDetails[mId]) {
              nextDetails[mId] = { id: mId }
            }
          }
          updateModelProvider(activeProvider.id, {
            models: nextModels,
            mainModelId: activeProvider.mainModelId && nextModels.includes(activeProvider.mainModelId)
              ? activeProvider.mainModelId
              : undefined,
            fastModelId: activeProvider.fastModelId && nextModels.includes(activeProvider.fastModelId)
              ? activeProvider.fastModelId
              : undefined,
            modelDetails: nextDetails
          })
          setFetchModelsNotice(t('fetchModelsSuccess', { count: result.modelIds.length }))
        } else {
          setFetchModelsNotice(t('fetchModelsEmpty'))
        }
      } else {
        setFetchModelsNotice(t('fetchModelsError', { message: result.message }))
      }
    } catch (e) {
      setFetchModelsNotice(t('fetchModelsError', { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      setFetchingModels(false)
    }
  }

  const clearModelIdDraft = (modelId: string): void => {
    setModelIdDrafts((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, modelId)) return current
      const next = { ...current }
      delete next[modelId]
      return next
    })
  }

  const handleModelIdDraftChange = (modelId: string, value: string): void => {
    setModelIdDrafts((current) => ({
      ...current,
      [modelId]: value
    }))
  }

  const commitModelIdChange = (oldId: string, value: string) => {
    clearModelIdDraft(oldId)
    const trimmedNewId = value.trim()
    if (!trimmedNewId || trimmedNewId === oldId) return
    if (activeProvider.models.some((modelId) => modelId !== oldId && modelId === trimmedNewId)) return

    const existingRowKey = modelRowKeysRef.current.get(modelRowStorageKey(oldId))
    if (existingRowKey) {
      modelRowKeysRef.current.set(modelRowStorageKey(trimmedNewId), existingRowKey)
      modelRowKeysRef.current.delete(modelRowStorageKey(oldId))
    }

    const nextModels = activeProvider.models.map((m) => m === oldId ? trimmedNewId : m)
    const nextDetails = { ...(activeProvider.modelDetails || {}) }
    
    if (nextDetails[oldId]) {
      nextDetails[trimmedNewId] = { ...nextDetails[oldId], id: trimmedNewId }
      delete nextDetails[oldId]
    } else {
      nextDetails[trimmedNewId] = { id: trimmedNewId }
    }

    updateModelProvider(activeProvider.id, {
      models: nextModels,
      ...(activeProvider.mainModelId === oldId ? { mainModelId: trimmedNewId } : {}),
      ...(activeProvider.fastModelId === oldId ? { fastModelId: trimmedNewId } : {}),
      modelDetails: nextDetails
    })
  }

  const handleDetailChange = (modelId: string, patch: Partial<ModelDetailV1>) => {
    const nextDetails = { ...(activeProvider.modelDetails || {}) }
    const currentDetail = nextDetails[modelId] || { id: modelId }
    nextDetails[modelId] = { ...currentDetail, ...patch }
    updateModelProvider(activeProvider.id, {
      modelDetails: nextDetails
    })
  }

  const handlePriceTierChange = (
    modelId: string,
    index: number,
    patch: Partial<ModelPriceTierV1>
  ): void => {
    const detail = (activeProvider.modelDetails && activeProvider.modelDetails[modelId]) || { id: modelId }
    const nextTiers = [...(detail.priceTiers ?? [])]
    nextTiers[index] = { ...(nextTiers[index] ?? {}), ...patch }
    handleDetailChange(modelId, { priceTiers: nextTiers })
  }

  const handleAddPriceTier = (modelId: string): void => {
    const detail = (activeProvider.modelDetails && activeProvider.modelDetails[modelId]) || { id: modelId }
    const nextTier: ModelPriceTierV1 = detail.priceTiers?.length
      ? {
          priceInput: '',
          priceOutput: ''
        }
      : {
          priceInput: '',
          priceOutput: '',
          priceInputCacheRead: '',
          priceInputCacheWrite: ''
        }
    handleDetailChange(modelId, { priceTiers: [...(detail.priceTiers ?? []), nextTier] })
  }

  const handleRemovePriceTier = (modelId: string, index: number): void => {
    const detail = (activeProvider.modelDetails && activeProvider.modelDetails[modelId]) || { id: modelId }
    const nextTiers = (detail.priceTiers ?? []).filter((_, i) => i !== index)
    handleDetailChange(modelId, { priceTiers: nextTiers.length > 0 ? nextTiers : undefined })
  }

  const handleAddModel = () => {
    let index = 1
    let newModelId = `new-model-${index}`
    while (activeProvider.models.includes(newModelId)) {
      index += 1
      newModelId = `new-model-${index}`
    }
    const nextModels = [...activeProvider.models, newModelId]
    const nextDetails = {
      ...(activeProvider.modelDetails || {}),
      [newModelId]: {
        id: newModelId,
        maxContext: 16384,
        maxOutput: 4096,
        supportsThinking: false,
        thinkingLevel: []
      }
    }
    updateModelProvider(activeProvider.id, {
      models: nextModels,
      modelDetails: nextDetails
    })
  }

  const handleRemoveModel = (modelId: string) => {
    const nextModels = activeProvider.models.filter((m) => m !== modelId)
    const nextDetails = { ...(activeProvider.modelDetails || {}) }
    delete nextDetails[modelId]
    modelRowKeysRef.current.delete(modelRowStorageKey(modelId))
    clearModelIdDraft(modelId)
    updateModelProvider(activeProvider.id, {
      models: nextModels,
      ...(activeProvider.mainModelId === modelId ? { mainModelId: undefined } : {}),
      ...(activeProvider.fastModelId === modelId ? { fastModelId: undefined } : {}),
      modelDetails: nextDetails
    })
  }

  return (
    <div className="grid min-w-0 gap-4">
      {/* Provider Selector and Add/Remove Buttons */}
      <div className="flex w-fit max-w-full flex-wrap items-center gap-3 rounded-2xl border border-ds-border-muted bg-ds-main/15 p-2">
        <div className="flex items-center gap-2">
          <SelectDropdown
            value={activeProvider.id}
            ariaLabel={t('dragonProvider')}
            className="w-[150px] max-w-[260px] shrink-0"
            buttonClassName="rounded-full font-semibold"
            menuWidth={220}
            options={providerOptions}
            renderValue={() => (
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <ProviderBrandIcon providerId={activeProvider.id} size={18} />
                </span>
                <span className="truncate">{activeProviderDisplayName}</span>
              </span>
            )}
            onChange={(value) => {
              updateDragon({ providerId: value })
              setEndpointMode('preset')
              setShowAddProviderMenu(false)
              setAddProviderAnchorRect(null)
            }}
          />
        </div>
        
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setAddProviderAnchorRect(rect)
            setShowAddProviderMenu(!showAddProviderMenu)
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ds-border bg-ds-card px-4 text-[12.5px] font-medium text-ds-muted shadow-sm transition hover:bg-ds-hover hover:text-ds-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('modelProviderAdd')}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>

        {showAddProviderMenu && addProviderAnchorRect && (() => {
          const placement = calculateSettingsPopoverPlacement({
            anchorRect: addProviderAnchorRect,
            width: 220,
            maxHeight: 320,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            coordinateScale: currentBodyZoom()
          })

          return createPortal(
            <>
              <div
                className="fixed inset-0 cursor-default"
                style={{ zIndex: 99999 }}
                onClick={() => {
                  setShowAddProviderMenu(false)
                  setAddProviderAnchorRect(null)
                }}
              />
              <div
                style={{
                  position: 'fixed',
                  left: `${placement.left}px`,
                  top: `${placement.top}px`,
                  width: `${placement.width}px`,
                  maxHeight: `${placement.maxHeight}px`,
                  zIndex: 100000,
                }}
                className="rounded-xl border border-ds-border bg-ds-elevated p-1.5 text-left shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-100 flex flex-col overflow-hidden"
              >
                <div className="text-[10px] font-bold text-ds-faint uppercase px-2.5 py-1 border-b border-ds-border/60 mb-1">
                  {t('modelProviderAdd')}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 flex flex-col gap-0.5">
                  {PROVIDER_PRESETS.map((p) => {
                    const displayName = locale === 'zh' ? p.nameZh : p.nameEn
                    const exists = modelProviders.some((mp) => mp.id === p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          addPresetProvider(p)
                          setShowAddProviderMenu(false)
                          setAddProviderAnchorRect(null)
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-ds-hover/75 text-ds-ink text-[12.5px] transition text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 flex items-center justify-center shrink-0">
                            <ProviderBrandIcon providerId={p.id} size={16} />
                          </div>
                          <span className="truncate">{displayName}</span>
                        </div>
                        {exists && (
                          <span className="text-emerald-500 font-semibold text-[11px] shrink-0 ml-1">
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="border-t border-ds-border/60 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      addModelProvider()
                      setShowAddProviderMenu(false)
                      setAddProviderAnchorRect(null)
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-ds-hover/75 text-accent font-medium text-[12.5px] transition text-left"
                  >
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      <Plus className="h-4 w-4" />
                    </div>
                    <span>{t('customEndpoint')}</span>
                  </button>
                </div>
              </div>
            </>,
            document.body
          )
        })()}
      </div>

      {/* Basic settings and provider connection */}
      <div
        className="grid min-w-0 gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}
      >
          {/* Card 1: Display Info */}
          <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-ds-border bg-ds-card/40 p-4 shadow-sm backdrop-blur-sm">
            <div className="text-[12.5px] font-bold text-ds-muted border-b border-ds-border/60 pb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-3.5 rounded-full bg-accent inline-block"></span>
              {t('sectionGeneral')}
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1 text-[11px] font-bold text-ds-muted uppercase tracking-wider">
                {t('modelProviderName')}
                <input
                  className={`w-full min-w-0 rounded-xl border border-ds-border bg-ds-card/50 px-3 py-1.5 text-[13px] font-normal shadow-sm ${
                    canEditActiveProviderId
                      ? 'text-ds-ink focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30'
                      : 'text-ds-faint bg-ds-hover/10'
                  }`}
                  value={!canEditActiveProviderId && matchedPreset ? (locale === 'zh' ? matchedPreset.nameZh : matchedPreset.nameEn) : activeProvider.name}
                  readOnly={!canEditActiveProviderId}
                  onChange={(e) => updateModelProvider(activeProvider.id, { name: e.target.value })}
                />
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-ds-muted uppercase tracking-wider">
                {t('modelProviderId')}
                <input
                  className={`w-full min-w-0 rounded-xl border border-ds-border bg-ds-card/50 px-3 py-1.5 font-mono text-[12.5px] font-normal shadow-sm ${
                    canEditActiveProviderId
                      ? 'text-ds-ink focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30'
                      : 'text-ds-faint bg-ds-hover/10'
                  }`}
                  value={activeProvider.id}
                  readOnly={!canEditActiveProviderId}
                  spellCheck={false}
                  onChange={(e) => updateModelProviderId(activeProvider.id, e.target.value)}
                />
              </label>
              <div className="grid min-w-0 gap-2 rounded-xl border border-ds-border/70 bg-ds-main/25 p-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <div className="text-[11px] font-bold text-ds-muted uppercase tracking-wider">
                    {t('modelTableMainModel')}
                  </div>
                  <SelectDropdown
                    value={mainRouteModelId}
                    ariaLabel={t('modelTableMainModel')}
                    placeholder={t('modelRouteUnset')}
                    disabled={activeProvider.models.length === 0}
                    buttonClassName="h-8 rounded-lg px-2.5 text-[12px] font-medium"
                    menuWidth={260}
                    options={routeModelOptions}
                    onChange={(value) => updateModelProvider(activeProvider.id, {
                      mainModelId: value.trim() || undefined
                    })}
                  />
                </div>
                <div className="grid gap-1">
                  <div className="text-[11px] font-bold text-ds-muted uppercase tracking-wider">
                    {t('modelTableFastModel')}
                  </div>
                  <SelectDropdown
                    value={fastRouteModelId}
                    ariaLabel={t('modelTableFastModel')}
                    placeholder={t('modelRouteUnset')}
                    disabled={activeProvider.models.length === 0}
                    buttonClassName="h-8 rounded-lg px-2.5 text-[12px] font-medium"
                    menuWidth={260}
                    options={routeModelOptions}
                    onChange={(value) => updateModelProvider(activeProvider.id, {
                      fastModelId: value.trim() || undefined
                    })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Connection / Secrets */}
          <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-ds-border bg-ds-card/40 p-4 shadow-sm backdrop-blur-sm">
            <div className="text-[12.5px] font-bold text-ds-muted border-b border-ds-border/60 pb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-3.5 rounded-full bg-accent inline-block"></span>
              {t('dragonProvider')}
            </div>
            
            <div className="grid gap-3">
              <label className="grid gap-1 text-[11px] font-bold text-ds-muted uppercase tracking-wider">
                {t('modelProviderApiKey')}
                <SecretInput
                  value={activeProvider.apiKey}
                  onChange={(value) => updateModelProvider(activeProvider.id, { apiKey: value })}
                  visible={showApiKey}
                  onToggleVisibility={() => setShowApiKey((value: boolean) => !value)}
                  placeholder={t('dragonApiKeyPlaceholder')}
                  autoComplete="off"
                  showLabel={t('showSecret')}
                  hideLabel={t('hideSecret')}
                />
              </label>
              
              <div className="grid gap-1">
                <label className="text-[11px] font-bold text-ds-muted uppercase tracking-wider">
                  {t('modelProviderBaseUrl')}
                </label>
                {hasPresetEndpoints ? (
                  <SelectDropdown
                    className="mb-2 min-w-0"
                    value={showCustomBaseUrlInput ? '__custom__' : (matchedEndpoint?.id ?? '__custom__')}
                    ariaLabel={t('modelProviderBaseUrl')}
                    menuWidth={360}
                    options={[
                      ...matchedPreset.endpoints.map((ep) => ({
                        value: ep.id,
                        label: locale === 'zh' ? ep.labelZh : ep.labelEn,
                        description: ep.baseUrl.replace(/^https?:\/\//, '')
                      })),
                      { value: '__custom__', label: t('customEndpoint') }
                    ]}
                    renderValue={() => (
                      <span className="block min-w-0 truncate">
                        <span>{endpointButtonLabel}</span>
                        {endpointButtonBaseUrl ? (
                          <span className="font-normal text-ds-muted">
                            {' \u2014 '}
                            {endpointButtonBaseUrl.replace(/^https?:\/\//, '')}
                          </span>
                        ) : null}
                      </span>
                    )}
                    onChange={handleEndpointSelect}
                  />
                ) : null}
                {showCustomBaseUrlInput && (
                  <input
                    className="w-full min-w-0 rounded-xl border border-ds-border bg-ds-card/50 px-3 py-1.5 text-[13px] font-normal text-ds-ink shadow-sm focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    value={activeProvider.baseUrl}
                    placeholder={matchedPreset ? getDefaultEndpoint(matchedPreset).baseUrl : t('baseUrlPlaceholder')}
                    onChange={(e) => updateModelProvider(activeProvider.id, { baseUrl: e.target.value })}
                  />
                )}
              </div>

              <label className="grid gap-1 text-[11px] font-bold text-ds-muted uppercase tracking-wider">
                {t('modelProviderEndpointFormat')}
                <SelectDropdown
                  value={activeProvider.endpointFormat}
                  ariaLabel={t('modelProviderEndpointFormat')}
                  options={MODEL_ENDPOINT_FORMATS.map((format) => ({
                    value: format,
                    label: t(MODEL_ENDPOINT_FORMAT_LABEL_KEYS[format])
                  }))}
                  onChange={(value) => updateModelProvider(activeProvider.id, {
                    endpointFormat: value as ModelEndpointFormat
                  })}
                />
              </label>
            </div>
          </div>
      </div>

      {/* Models config table */}
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-ds-border bg-ds-card/40 p-4 shadow-sm backdrop-blur-sm">
          <div className="text-[12.5px] font-bold text-ds-muted border-b border-ds-border/60 pb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-3.5 rounded-full bg-accent inline-block"></span>
              {t('modelProviderModels').split('（')[0]}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={fetchingModels}
                onClick={() => void handleFetchModels()}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-ds-border bg-ds-card px-2.5 text-[11px] font-medium text-ds-muted shadow-sm transition hover:bg-ds-hover hover:text-ds-ink disabled:opacity-50"
              >
                {fetchingModels
                  ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.2} />
                  : <RefreshCw className="h-3 w-3" strokeWidth={2.2} />}
                {fetchingModels ? t('fetchModelsFetching') : t('fetchModels')}
              </button>
              {fetchModelsNotice && (
                <span className="text-[11px] text-ds-muted font-normal">{fetchModelsNotice}</span>
              )}
            </div>
          </div>

          <div className="max-h-[400px] min-w-0 overflow-auto rounded-xl border border-ds-border/70 bg-ds-card/25 shadow-sm">
            <table className="w-full table-fixed border-collapse text-left text-[12.5px]" style={{ minWidth: 1320 }}>
              <thead>
                <tr className="border-b border-ds-border bg-ds-main/30 text-[11px] font-semibold text-ds-muted uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                  <th className="px-3 py-2 w-[180px]">{t('modelTableId')}</th>
                  <th className="px-2 py-2 w-[140px]">{t('modelTableName')}</th>
                  <th className="px-2 py-2 text-right w-[100px]">{t('modelTablePriceInput')}</th>
                  <th className="px-2 py-2 text-right w-[100px]">{t('modelTablePriceOutput')}</th>
                  <th className="px-2 py-2 text-right w-[120px]">{t('modelTablePriceInputCacheRead')}</th>
                  <th className="px-2 py-2 text-right w-[120px]">{t('modelTablePriceInputCacheWrite')}</th>
                  <th className="px-2 py-2 text-center w-[90px]">{t('modelTablePriceTiers')}</th>
                  <th className="px-2 py-2 text-right w-[95px]">{t('modelTableMaxContext')}</th>
                  <th className="px-2 py-2 text-right w-[85px]">{t('modelTableMaxOutput')}</th>
                  <th className="px-2 py-2 text-center w-[75px]">{t('modelTableSupportsThinking')}</th>
                  <th className="px-2 py-2 text-center w-[120px]">{t('modelTableThinkingLevel')}</th>
                  <th className="px-2 py-2 text-center w-[45px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border-muted/50">
                {activeProvider.models.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-6 text-center text-ds-faint">
                      No models configured. Click "Add Model" or "Fetch model list".
                    </td>
                  </tr>
                ) : (
                  activeProvider.models.map((modelId) => {
                    const detail = (activeProvider.modelDetails && activeProvider.modelDetails[modelId]) || { id: modelId }
                    return (
                      <tr key={getModelRowKey(modelId)} className="hover:bg-ds-hover/10 transition">
                        <td className="px-3 py-1 font-mono w-[180px]">
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-ds-border/40 focus:border-accent/40 focus:outline-none px-1 py-0.5 text-ds-ink"
                            value={modelIdDrafts[modelId] ?? modelId}
                            onChange={(e) => handleModelIdDraftChange(modelId, e.target.value)}
                            onBlur={(e) => commitModelIdChange(modelId, e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              } else if (e.key === 'Escape') {
                                clearModelIdDraft(modelId)
                              }
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-ds-border/40 focus:border-accent/40 focus:outline-none px-1 py-0.5 text-ds-ink"
                            value={detail.name || ''}
                            placeholder={modelId}
                            onChange={(e) => handleDetailChange(modelId, { name: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-ds-border/40 focus:border-accent/40 focus:outline-none px-1 py-0.5 text-ds-ink text-right font-mono"
                            value={detail.priceInput || ''}
                            placeholder="0.00"
                            onChange={(e) => handleDetailChange(modelId, { priceInput: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-ds-border/40 focus:border-accent/40 focus:outline-none px-1 py-0.5 text-ds-ink text-right font-mono"
                            value={detail.priceOutput || ''}
                            placeholder="0.00"
                            onChange={(e) => handleDetailChange(modelId, { priceOutput: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-ds-border/40 focus:border-accent/40 focus:outline-none px-1 py-0.5 text-ds-ink text-right font-mono"
                            value={detail.priceInputCacheRead || ''}
                            placeholder="0.00"
                            onChange={(e) => handleDetailChange(modelId, { priceInputCacheRead: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-ds-border/40 focus:border-accent/40 focus:outline-none px-1 py-0.5 text-ds-ink text-right font-mono"
                            value={detail.priceInputCacheWrite || ''}
                            placeholder="0.00"
                            onChange={(e) => handleDetailChange(modelId, { priceInputCacheWrite: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1 text-center relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setPopoverAnchorRect(rect)
                              setActiveThinkingPopModelId(null)
                              setActivePricingPopModelId(activePricingPopModelId === modelId ? null : modelId)
                            }}
                            className="inline-flex w-full items-center justify-between gap-1.5 rounded-lg border border-ds-border bg-ds-card/50 px-2 py-1 text-[11px] font-medium text-ds-muted shadow-sm transition hover:bg-ds-hover hover:text-ds-ink"
                          >
                            <span className="truncate">
                              {detail.priceTiers?.length ? `${detail.priceTiers.length} ${t('modelPriceTierCount')}` : '-'}
                            </span>
                            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                          </button>

                          {activePricingPopModelId === modelId && popoverAnchorRect && (() => {
                            const placement = calculateSettingsPopoverPlacement({
                              anchorRect: popoverAnchorRect,
                              width: 560,
                              maxHeight: 360,
                              viewportHeight: window.innerHeight,
                              viewportWidth: window.innerWidth,
                              coordinateScale: currentBodyZoom()
                            })
                            const priceTiers = detail.priceTiers ?? []

                            return createPortal(
                              <>
                                <div
                                  className="fixed inset-0 cursor-default"
                                  style={{ zIndex: 99999 }}
                                  onClick={() => {
                                    setActivePricingPopModelId(null)
                                    setPopoverAnchorRect(null)
                                  }}
                                />
                                <div
                                  style={{
                                    position: 'fixed',
                                    left: `${placement.left}px`,
                                    top: `${placement.top}px`,
                                    width: `${placement.width}px`,
                                    maxHeight: `${placement.maxHeight}px`,
                                    zIndex: 100000,
                                  }}
                                  className="rounded-xl border border-ds-border bg-ds-elevated p-2 text-left shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-100 overflow-y-auto"
                                >
                                  <div className="flex items-center justify-between gap-2 border-b border-ds-border/60 px-2 pb-1.5">
                                    <div className="text-[10px] font-bold text-ds-faint uppercase">
                                      {t('modelPriceTiersTitle')}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddPriceTier(modelId)}
                                      className="inline-flex h-6 items-center gap-1 rounded-md border border-ds-border bg-ds-card px-2 text-[11px] font-medium text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
                                    >
                                      <Plus className="h-3 w-3" />
                                      {t('modelPriceTierAdd')}
                                    </button>
                                  </div>
                                  <div className="px-2 pt-2 text-[11px] leading-4 text-ds-faint">
                                    {t('modelPriceTiersHint')}
                                  </div>
                                  <div className="grid grid-cols-[96px_72px_72px_82px_82px_28px] gap-1.5 px-1 pt-2 text-[10px] font-semibold uppercase text-ds-faint">
                                    <span>{t('modelPriceTierMinInput')}</span>
                                    <span className="text-right">{t('modelTablePriceInput')}</span>
                                    <span className="text-right">{t('modelTablePriceOutput')}</span>
                                    <span className="text-right">{t('modelTablePriceInputCacheRead')}</span>
                                    <span className="text-right">{t('modelTablePriceInputCacheWrite')}</span>
                                    <span />
                                  </div>
                                  <div className="grid gap-1.5 pt-1">
                                    {priceTiers.length === 0 ? (
                                      <div className="rounded-lg border border-dashed border-ds-border px-3 py-4 text-center text-[12px] text-ds-faint">
                                        {t('modelPriceTiersEmpty')}
                                      </div>
                                    ) : priceTiers.map((tier, index) => (
                                      <div
                                        key={index}
                                        className="grid grid-cols-[96px_72px_72px_82px_82px_28px] items-center gap-1.5 rounded-lg bg-ds-card/35 px-1 py-1"
                                      >
                                        <input
                                          type="number"
                                          className="min-w-0 rounded-md border border-ds-border bg-ds-main px-1.5 py-1 text-[11px] text-ds-ink outline-none focus:border-accent/50"
                                          value={tier.minInputTokens ?? ''}
                                          placeholder={t('modelPriceTierThreshold')}
                                          onChange={(e) => handlePriceTierChange(modelId, index, {
                                            minInputTokens: e.target.value ? parseInt(e.target.value) : undefined
                                          })}
                                        />
                                        <input
                                          className="min-w-0 rounded-md border border-ds-border bg-ds-main px-1.5 py-1 text-right font-mono text-[11px] text-ds-ink outline-none focus:border-accent/50"
                                          value={tier.priceInput ?? ''}
                                          placeholder={detail.priceInput || '0.00'}
                                          onChange={(e) => handlePriceTierChange(modelId, index, { priceInput: e.target.value })}
                                        />
                                        <input
                                          className="min-w-0 rounded-md border border-ds-border bg-ds-main px-1.5 py-1 text-right font-mono text-[11px] text-ds-ink outline-none focus:border-accent/50"
                                          value={tier.priceOutput ?? ''}
                                          placeholder={detail.priceOutput || '0.00'}
                                          onChange={(e) => handlePriceTierChange(modelId, index, { priceOutput: e.target.value })}
                                        />
                                        <input
                                          className="min-w-0 rounded-md border border-ds-border bg-ds-main px-1.5 py-1 text-right font-mono text-[11px] text-ds-ink outline-none focus:border-accent/50"
                                          value={tier.priceInputCacheRead ?? ''}
                                          placeholder={detail.priceInputCacheRead || '0.00'}
                                          onChange={(e) => handlePriceTierChange(modelId, index, { priceInputCacheRead: e.target.value })}
                                        />
                                        <input
                                          className="min-w-0 rounded-md border border-ds-border bg-ds-main px-1.5 py-1 text-right font-mono text-[11px] text-ds-ink outline-none focus:border-accent/50"
                                          value={tier.priceInputCacheWrite ?? ''}
                                          placeholder={detail.priceInputCacheWrite || '0.00'}
                                          onChange={(e) => handlePriceTierChange(modelId, index, { priceInputCacheWrite: e.target.value })}
                                        />
                                        <button
                                          type="button"
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ds-muted transition hover:bg-ds-hover hover:text-red-500"
                                          onClick={() => handleRemovePriceTier(modelId, index)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>,
                              document.body
                            )
                          })()}
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            className="w-full bg-transparent border-b border-transparent hover:border-ds-border/40 focus:border-accent/40 focus:outline-none px-1 py-0.5 text-ds-ink text-right font-mono"
                            value={detail.maxContext || ''}
                            placeholder="16384"
                            onChange={(e) => handleDetailChange(modelId, { maxContext: e.target.value ? parseInt(e.target.value) : undefined })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            className="w-full bg-transparent border-b border-transparent hover:border-ds-border/40 focus:border-accent/40 focus:outline-none px-1 py-0.5 text-ds-ink text-right font-mono"
                            value={detail.maxOutput || ''}
                            placeholder="4096"
                            onChange={(e) => handleDetailChange(modelId, { maxOutput: e.target.value ? parseInt(e.target.value) : undefined })}
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-ds-border text-accent focus:ring-accent bg-ds-card h-4 w-4 cursor-pointer"
                            checked={!!detail.supportsThinking}
                            onChange={(e) => {
                              const supports = e.target.checked
                              handleDetailChange(modelId, {
                                supportsThinking: supports,
                                thinkingLevel: supports
                                  ? (Array.isArray(detail.thinkingLevel) ? detail.thinkingLevel : [])
                                  : []
                              })
                            }}
                          />
                        </td>
                        <td className="px-2 py-1 text-center relative">
                          <button
                            type="button"
                            disabled={!detail.supportsThinking}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setPopoverAnchorRect(rect)
                              setActivePricingPopModelId(null)
                              setActiveThinkingPopModelId(activeThinkingPopModelId === modelId ? null : modelId)
                            }}
                            className="inline-flex items-center justify-between gap-1.5 rounded-lg border border-ds-border bg-ds-card/50 px-2 py-1 text-[11px] font-medium text-ds-muted shadow-sm hover:bg-ds-hover hover:text-ds-ink disabled:opacity-30 disabled:cursor-not-allowed transition w-full"
                          >
                            <span className="truncate max-w-[80px]">
                              {!detail.supportsThinking
                                ? '-'
                                : Array.isArray(detail.thinkingLevel) && detail.thinkingLevel.length > 0
                                ? detail.thinkingLevel.map(t => t).join(', ')
                                : 'Select...'}
                            </span>
                            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                          </button>

                          {activeThinkingPopModelId === modelId && popoverAnchorRect && (() => {
                            const placement = calculateSettingsPopoverPlacement({
                              anchorRect: popoverAnchorRect,
                              width: 160,
                              maxHeight: 280,
                              viewportHeight: window.innerHeight,
                              viewportWidth: window.innerWidth,
                              coordinateScale: currentBodyZoom()
                            })

                            return createPortal(
                              <>
                                <div
                                  className="fixed inset-0 cursor-default"
                                  style={{ zIndex: 99999 }}
                                  onClick={() => {
                                    setActiveThinkingPopModelId(null)
                                    setPopoverAnchorRect(null)
                                  }}
                                />
                                <div
                                  style={{
                                    position: 'fixed',
                                    left: `${placement.left}px`,
                                    top: `${placement.top}px`,
                                    width: `${placement.width}px`,
                                    maxHeight: `${placement.maxHeight}px`,
                                    zIndex: 100000,
                                  }}
                                  className="rounded-xl border border-ds-border bg-ds-elevated p-1.5 text-left shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-100 overflow-y-auto"
                                >
                                  <div className="text-[10px] font-bold text-ds-faint uppercase px-2 pb-1 border-b border-ds-border/60 mb-1">
                                    Thinking Levels
                                  </div>
                                  {['low', 'minimal', 'medium', 'mid', 'high', 'max', 'maximum', 'xhigh'].map((lvl) => {
                                    const isChecked = Array.isArray(detail.thinkingLevel) ? detail.thinkingLevel.includes(lvl) : false
                                    return (
                                      <label
                                        key={lvl}
                                        className="flex items-center gap-2 px-2 py-0.5 rounded-md hover:bg-ds-hover/50 cursor-pointer text-ds-ink text-[12px] transition-colors"
                                      >
                                        <input
                                          type="checkbox"
                                          className="rounded border-ds-border text-accent focus:ring-accent bg-ds-card h-3 w-3 cursor-pointer"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            const checked = e.target.checked
                                            const currentLevels = Array.isArray(detail.thinkingLevel) ? detail.thinkingLevel : []
                                            const nextLevels = checked
                                              ? [...currentLevels, lvl]
                                              : currentLevels.filter((x) => x !== lvl)
                                            handleDetailChange(modelId, { thinkingLevel: nextLevels })
                                          }}
                                        />
                                        <span className="font-mono text-[11.5px] text-ds-muted">{lvl}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </>,
                              document.body
                            )
                          })()}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            className="text-ds-muted hover:text-red-500 transition p-1 rounded hover:bg-ds-hover"
                            onClick={() => handleRemoveModel(modelId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-1">
            {activeProvider ? (
              <button
                type="button"
                onClick={() => removeModelProvider(activeProvider.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-200/50 bg-red-50/70 px-3 text-[11.5px] font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200 dark:hover:bg-red-950/35"
              >
                <Trash2 className="h-3 w-3" strokeWidth={2} />
                {t('modelProviderRemove')}
              </button>
            ) : <div />}
            
            <button
              type="button"
              onClick={handleAddModel}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ds-border bg-ds-card px-3 text-[11.5px] font-medium text-ds-muted shadow-sm transition hover:bg-ds-hover hover:text-ds-ink"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('modelTableAdd')}
            </button>
          </div>
        </div>
    </div>
  )
}
