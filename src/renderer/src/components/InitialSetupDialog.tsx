import { type ReactElement, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DeepSeekColor from '@lobehub/icons/es/DeepSeek/components/Color'
import ZhipuColor from '@lobehub/icons/es/Zhipu/components/Color'
import MinimaxColor from '@lobehub/icons/es/Minimax/components/Color'
import MoonshotMono from '@lobehub/icons/es/Moonshot/components/Mono'
import QwenColor from '@lobehub/icons/es/Qwen/components/Color'
import TencentColor from '@lobehub/icons/es/Tencent/components/Color'
import XiaomiMiMoMono from '@lobehub/icons/es/XiaomiMiMo/components/Mono'
import type { FC, SVGProps } from 'react'
import {
  getActiveAgentApiKey,
  getModelProviderSettings,
  normalizeAppSettings,
  type AppSettingsPatch,
  type AppSettingsV1
} from '@shared/app-settings'
import { PROVIDER_PRESETS, CUSTOM_PROVIDER_PRESET_ID, getDefaultEndpoint, findEndpointByUrl, type ProviderPreset } from '@shared/provider-presets'
import { rendererRuntimeClient } from '../agent/runtime-client'
import { applyTheme } from '../lib/apply-theme'
import { useChatStore } from '../store/chat-store'
import { Eye, EyeOff, ExternalLink, Sparkles, Sun, Moon, Monitor, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { SelectDropdown } from './SelectDropdown'

type SvgIcon = FC<SVGProps<SVGSVGElement> & { size?: number | string }>

const PROVIDER_ICON_MAP: Record<string, SvgIcon> = {
  deepseek: DeepSeekColor as unknown as SvgIcon,
  zhipu: ZhipuColor as unknown as SvgIcon,
  minimax: MinimaxColor as unknown as SvgIcon,
  moonshot: MoonshotMono as unknown as SvgIcon,
  alibaba: QwenColor as unknown as SvgIcon,
  tencent: TencentColor as unknown as SvgIcon,
  xiaomi: XiaomiMiMoMono as unknown as SvgIcon
}

function ProviderBrandIcon({ providerId, size = 24 }: { providerId: string; size?: number }) {
  const IconComp = PROVIDER_ICON_MAP[providerId]
  if (!IconComp) return null
  return <IconComp size={size} />
}

type ThemePref = AppSettingsV1['theme']
type SetupFormPatch = AppSettingsPatch

const themeOptions: { value: ThemePref; icon: typeof Sun; labelKey: string }[] = [
  { value: 'system', icon: Monitor, labelKey: 'themeSystem' },
  { value: 'light', icon: Sun, labelKey: 'themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'themeDark' }
]

const TOTAL_STEPS = 3

function presetSelectionForProvider(providerId: string): string {
  const trimmed = providerId.trim()
  if (!trimmed) return ''
  return PROVIDER_PRESETS.some((preset) => preset.id === trimmed)
    ? trimmed
    : CUSTOM_PROVIDER_PRESET_ID
}

export function InitialSetupDialog(): ReactElement {
  const { t, i18n } = useTranslation('settings')
  const initialSetupMode = useChatStore((s) => s.initialSetupMode)
  const closeInitialSetup = useChatStore((s) => s.closeInitialSetup)
  const applyI18n = useChatStore((s) => s.applyI18nFromSettings)
  const reloadUiSettings = useChatStore((s) => s.reloadUiSettings)
  const probeRuntime = useChatStore((s) => s.probeRuntime)

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<AppSettingsV1 | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('')
  const [customEndpointUrl, setCustomEndpointUrl] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<AppSettingsV1 | null>(null)
  const [selectedCustomProviderId, setSelectedCustomProviderId] = useState<string>('custom-provider')
  const isPreview = initialSetupMode === 'preview'
  const provider = form ? getModelProviderSettings(form) : null

  const defaultProvider = provider?.providers?.[0]
  const selectedPreset = PROVIDER_PRESETS.find((p) => p.id === selectedPresetId)
  const isCustom = selectedPresetId === CUSTOM_PROVIDER_PRESET_ID
  const hasSelectedProvider = Boolean(selectedPresetId)
  const selectedProviderProfileId = hasSelectedProvider
    ? isCustom ? selectedCustomProviderId : selectedPresetId
    : ''

  const locale = i18n.language?.startsWith('zh') ? 'zh' : 'en'

  const setCurrentForm = (next: AppSettingsV1 | null): void => {
    formRef.current = next
    setForm(next)
  }

  useEffect(() => {
    let cancelled = false
    void rendererRuntimeClient
      .getSettings({ forceRefresh: true })
      .then((s) => {
        if (cancelled) return
        setCurrentForm(s)
        const existingProviderId = s.agents.dragon.providerId || s.provider.providers[0]?.id || ''
        const existingProvider = s.provider.providers.find((item) => item.id === existingProviderId)
        const initialPresetId = presetSelectionForProvider(existingProviderId)
        const initialPreset = PROVIDER_PRESETS.find((preset) => preset.id === initialPresetId)
        setSelectedPresetId(initialPresetId)
        if (initialPresetId === CUSTOM_PROVIDER_PRESET_ID && existingProvider) {
          setSelectedCustomProviderId(existingProvider.id)
        }
        if (initialPreset && existingProvider) {
          const matchedEndpoint = findEndpointByUrl(initialPreset, existingProvider.baseUrl)
          if (matchedEndpoint) {
            setSelectedEndpointId(matchedEndpoint.id)
            setCustomEndpointUrl('')
          } else {
            setSelectedEndpointId('__custom__')
            setCustomEndpointUrl(existingProvider.baseUrl)
          }
        } else if (existingProvider) {
          setSelectedEndpointId('__custom__')
          setCustomEndpointUrl(existingProvider.baseUrl)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => { cancelled = true }
  }, [])

  const updateForm = (patch: SetupFormPatch) => {
    const current = formRef.current
    if (!current) return
    const next = normalizeAppSettings({
      ...current,
      ...patch,
      provider: {
        ...current.provider,
        ...(patch.provider ?? {})
      }
    } as AppSettingsV1)
    setCurrentForm(next)
  }

  const updateProvider = (patch: Partial<AppSettingsV1['provider']>): void => {
    updateForm({ provider: patch })
  }

  const handleThemeChange = (theme: ThemePref) => {
    if (!formRef.current) return
    updateForm({ theme })
    applyTheme(theme)
  }

  const handleClose = () => {
    setError(null)
    closeInitialSetup()
    void reloadUiSettings()
  }

  const handleOpenApiPage = () => {
    if (typeof window.sinoCode?.openExternal !== 'function') return
    const preset = selectedPreset
    if (!preset) return
    void window.sinoCode.openExternal(preset.websiteUrl).catch(() => undefined)
  }

  const selectProviderPreset = (preset: ProviderPreset | null) => {
    const presetId = preset ? preset.id : CUSTOM_PROVIDER_PRESET_ID
    const current = formRef.current
    if (!current) return
    const existingProviders = current.provider.providers ?? []
    const existingProvider = existingProviders.find((p) => p.id === presetId)
    const existingCustomProvider = existingProviders.find((p) =>
      !PROVIDER_PRESETS.some((presetItem) => presetItem.id === p.id)
    )
    const currentApiKey = (preset ? existingProvider : existingCustomProvider)?.apiKey ?? ''
    const displayName = preset
      ? (locale === 'zh' ? preset.nameZh : preset.nameEn)
      : t('firstRunCustomProvider')

    let presetBaseUrl = ''
    if (preset) {
      const defaultEp = getDefaultEndpoint(preset)
      presetBaseUrl = existingProvider?.baseUrl || defaultEp.baseUrl
      setSelectedEndpointId(defaultEp.id)
      setCustomEndpointUrl('')
    } else {
      setSelectedEndpointId('__custom__')
      setCustomEndpointUrl(existingCustomProvider?.baseUrl ?? '')
    }

    const providerProfileId = preset ? presetId : existingCustomProvider?.id ?? 'custom-provider'
    if (!preset) setSelectedCustomProviderId(providerProfileId)

    const updatedProvider = {
      id: providerProfileId,
      name: preset ? displayName : existingCustomProvider?.name || displayName,
      apiKey: currentApiKey,
      baseUrl: preset ? presetBaseUrl : existingCustomProvider?.baseUrl ?? '',
      endpointFormat: 'chat_completions' as const,
      models: [] as string[]
    }

    const others = existingProviders.filter((p) => p.id !== providerProfileId)
    const nextProviders = [updatedProvider, ...others]

    setSelectedPresetId(presetId)

    updateForm({
      provider: {
        providers: nextProviders
      },
      agents: {
        dragon: { providerId: providerProfileId }
      }
    })
  }

  const handleEndpointChange = (endpointId: string) => {
    const current = formRef.current
    if (!current || !selectedPreset) return
    setSelectedEndpointId(endpointId)

    let baseUrl = ''
    if (endpointId === '__custom__') {
      baseUrl = customEndpointUrl
    } else {
      const ep = selectedPreset.endpoints.find((e) => e.id === endpointId)
      baseUrl = ep?.baseUrl ?? ''
    }

    const providers = current.provider.providers ?? []
    const targetId = selectedProviderProfileId || providers[0]?.id
    const updatedProviders = providers.map((p) => p.id === targetId ? { ...p, baseUrl } : p)
    updateProvider({ providers: updatedProviders })
  }

  const handleCustomEndpointUrlChange = (value: string) => {
    setCustomEndpointUrl(value)
    const current = formRef.current
    if (!current) return
    const providers = current.provider.providers ?? []
    const targetId = selectedProviderProfileId || providers[0]?.id
    const updatedProviders = providers.map((p) => p.id === targetId ? { ...p, baseUrl: value } : p)
    updateProvider({ providers: updatedProviders })
  }

  const handleApiKeyChange = (value: string) => {
    const current = formRef.current
    if (!current) return
    const providers = current.provider.providers ?? []
    if (providers.length === 0) return
    const targetId = selectedProviderProfileId || providers[0]?.id
    const updatedProviders = providers.map((p) => p.id === targetId ? { ...p, apiKey: value } : p)
    updateProvider({ providers: updatedProviders })
  }

  const handleBaseUrlChange = (value: string) => {
    const current = formRef.current
    if (!current) return
    const providers = current.provider.providers ?? []
    if (providers.length === 0) return
    const targetId = selectedProviderProfileId || providers[0]?.id
    const updatedProviders = providers.map((p) => p.id === targetId ? { ...p, baseUrl: value } : p)
    updateProvider({ providers: updatedProviders })
  }

  const canAdvance = (): boolean => {
    if (step === 0) return true
    if (step === 1) return hasSelectedProvider
    return true
  }

  const validateAndSave = async () => {
    const current = formRef.current
    if (!current) return
    if (!getActiveAgentApiKey(current).trim()) {
      setError(t('firstRunApiKeyValidation'))
      return
    }
    if (isCustom && !(defaultProvider?.baseUrl?.trim())) {
      setError(t('firstRunBaseUrlValidation'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await rendererRuntimeClient.setSettings(current)
      setCurrentForm(next)
      await applyI18n(next.locale)
      void reloadUiSettings()
      void probeRuntime('background')
      closeInitialSetup()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1)
      setError(null)
    } else {
      void validateAndSave()
    }
  }

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1)
      setError(null)
    }
  }

  if (!form) {
    return (
      <div className="ds-no-drag fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-md dark:bg-black/70">
        <div className="rounded-xl border border-ds-border bg-ds-card/95 px-5 py-4 text-sm text-ds-muted shadow-panel backdrop-blur-xl">
          {t('loading')}
        </div>
      </div>
    )
  }

  const selectedTheme = form.theme
  const providerId = selectedProviderProfileId
  const activeProvider = providerId
    ? (provider?.providers ?? []).find((p) => p.id === providerId)
    : undefined
  const apiKeyValue = activeProvider?.apiKey ?? ''
  const baseUrlValue = activeProvider?.baseUrl ?? ''

  const choiceButtonClass = (active: boolean): string =>
    [
      'flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 sm:min-h-11 sm:px-4',
      active
        ? 'border-[#1388ff] bg-[#1388ff]/[0.07] text-[#1377df] shadow-[0_0_0_1px_rgba(19,136,255,0.12),0_8px_18px_rgba(19,136,255,0.07)] dark:border-[#3aa0ff] dark:bg-[#3aa0ff]/[0.12] dark:text-[#88c8ff]'
        : 'border-slate-300/80 bg-white/72 text-slate-600 hover:border-slate-400/80 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-white/16 dark:hover:bg-white/[0.055]'
    ].join(' ')

  const providerCardClass = (active: boolean, brandColor?: string): string =>
    [
      'relative flex min-h-[72px] flex-col items-start justify-center gap-1 rounded-xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer',
      active
        ? 'border-[color:var(--brand-active-border)] bg-[color:var(--brand-active-bg)] shadow-[0_0_0_1px_var(--brand-active-shadow),0_8px_18px_var(--brand-active-shadow)]'
        : 'border-slate-300/80 bg-white/72 text-slate-600 hover:border-slate-400/80 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-white/16 dark:hover:bg-white/[0.055]'
    ].join(' ')

  const fieldClass =
    'w-full rounded-xl border border-slate-300/75 bg-white/88 px-4 py-3 text-[15px] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition focus:border-[#1388ff]/70 focus:ring-2 focus:ring-[#1388ff]/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-none dark:focus:border-[#3aa0ff]/70 dark:focus:ring-[#3aa0ff]/15 dark:placeholder:text-slate-500'
  const labelClass = 'text-sm font-semibold text-slate-700 dark:text-slate-200'

  const stepLabels = [
    t('firstRunStepAppearance'),
    t('firstRunStepProvider'),
    t('firstRunStepCredentials')
  ]

  const providerDisplayName = selectedPreset
    ? (locale === 'zh' ? selectedPreset.nameZh : selectedPreset.nameEn)
    : isCustom ? t('firstRunCustomProvider') : t('firstRunStepProvider')
  const providerSummaryEndpoint = (baseUrlValue || customEndpointUrl).trim()
  const providerSummaryEndpointLabel = providerSummaryEndpoint
    ? providerSummaryEndpoint.replace(/^https?:\/\//, '')
    : t('baseUrlPlaceholder')
  const providerSummaryIconId = selectedPreset?.id ?? activeProvider?.id ?? ''

  return (
    <div className="ds-no-drag fixed inset-0 z-50 overflow-y-auto bg-[#eef2fb]/45 p-3 backdrop-blur-[18px] dark:bg-black/62 dark:backdrop-blur-[22px] sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="initial-setup-title"
          className="flex h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-white/75 bg-[rgba(255,255,255,0.94)] text-slate-900 shadow-[0_28px_86px_rgba(88,105,136,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(18,21,28,0.96)] dark:text-white dark:shadow-[0_28px_92px_rgba(0,0,0,0.55)] sm:h-auto sm:max-h-[calc(100dvh-48px)]"
        >
          {/* Header */}
          <div className="shrink-0 border-b border-slate-200/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,253,0.9))] px-5 py-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(27,31,40,0.98),rgba(19,22,29,0.96))] sm:px-7 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-[#1388ff]/22 bg-[#1388ff]/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-[#1377df] dark:border-[#3aa0ff]/22 dark:bg-[#3aa0ff]/[0.12] dark:text-[#88c8ff]">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
                <span className="min-w-0 truncate">{t(isPreview ? 'firstRunPreviewBadge' : 'firstRunBadge')}</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label={t('firstRunClose')}
                title={t('firstRunClose')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300/80 bg-white/72 text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/18 dark:hover:text-slate-200"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
            </div>
            <h1 id="initial-setup-title" className="mt-3 text-xl font-semibold leading-tight text-slate-900 dark:text-white sm:text-[22px]">
              {t('firstRunTitle')}
            </h1>

            {/* Step indicator */}
            <div className="mt-4 flex items-center gap-2">
              {stepLabels.map((label, idx) => (
                <div key={idx} className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300 ${
                      idx < step
                        ? 'bg-[#1388ff] text-white dark:bg-[#3aa0ff]'
                        : idx === step
                          ? 'bg-[#1388ff] text-white shadow-[0_0_0_3px_rgba(19,136,255,0.18)] dark:bg-[#3aa0ff] dark:shadow-[0_0_0_3px_rgba(58,160,255,0.2)]'
                          : 'bg-slate-200/80 text-slate-500 dark:bg-white/10 dark:text-slate-500'
                    }`}
                  >
                    {idx < step ? '\u2713' : idx + 1}
                  </div>
                  <span
                    className={`hidden text-[12px] font-medium sm:inline ${
                      idx === step ? 'text-[#1377df] dark:text-[#88c8ff]' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {label}
                  </span>
                  {idx < stepLabels.length - 1 && (
                    <div className={`hidden h-px flex-1 sm:block ${idx < step ? 'bg-[#1388ff]/40 dark:bg-[#3aa0ff]/40' : 'bg-slate-200 dark:bg-white/10'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body — step content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">

            {/* ====== STEP 0: Appearance ====== */}
            {step === 0 && (
              <div className="space-y-5 sm:space-y-6">
                <div className="space-y-2.5 sm:space-y-3.5">
                  <label className={labelClass}>
                    {t('theme')}
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:gap-2.5 sm:grid-cols-3">
                    {themeOptions.map(({ value, icon: Icon, labelKey }) => {
                      const isActive = selectedTheme === value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleThemeChange(value)}
                          className={choiceButtonClass(isActive)}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 text-center leading-tight">{t(labelKey)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2.5 sm:space-y-3.5">
                  <label className={labelClass}>
                    {t('language')}
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:gap-2.5 min-[440px]:grid-cols-2">
                    {(['en', 'zh'] as const).map((lang) => {
                      const isActive = form.locale === lang
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            updateForm({ locale: lang })
                            void applyI18n(lang)
                          }}
                          className={choiceButtonClass(isActive)}
                        >
                          <span className="min-w-0 text-center leading-tight">{lang === 'en' ? 'English' : '\u7B80\u4F53\u4E2D\u6587'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ====== STEP 1: Provider selection ====== */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {t('firstRunStepProviderDesc')}
                </p>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {PROVIDER_PRESETS.map((preset) => {
                    const isActive = selectedPresetId === preset.id
                    const displayName = locale === 'zh' ? preset.nameZh : preset.nameEn
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectProviderPreset(preset)}
                        className={providerCardClass(isActive)}
                        style={{
                          '--brand-active-border': `${preset.brandColor}/60`,
                          '--brand-active-bg': `${preset.brandColor}/[0.07]`,
                          '--brand-active-shadow': `${preset.brandColor}/0.08`
                        } as React.CSSProperties}
                      >
                        <div className="flex items-center gap-2">
                          <ProviderBrandIcon providerId={preset.id} size={20} />
                          <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                            {displayName}
                          </span>
                        </div>
                        <span className="mt-0.5 block pl-[30px] text-[11px] leading-4 text-slate-400 dark:text-slate-500 truncate">
                          {getDefaultEndpoint(preset).baseUrl.replace(/^https?:\/\//, '')}
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => selectProviderPreset(null)}
                    className={providerCardClass(isCustom)}
                    style={{
                      '--brand-active-border': '#1388ff/60',
                      '--brand-active-bg': '#1388ff/[0.07]',
                      '--brand-active-shadow': '#1388ff/0.08'
                    } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-400 dark:border-slate-500" />
                      <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                        {t('firstRunCustomProvider')}
                      </span>
                    </div>
                    <span className="mt-0.5 block pl-[18px] text-[11px] leading-4 text-slate-400 dark:text-slate-500">
                      {t('firstRunCustomProviderDesc')}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ====== STEP 2: API Key + Base URL ====== */}
            {step === 2 && (
              <div className="space-y-4 sm:space-y-5">
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {isCustom
                    ? t('firstRunStepCredentialsDescCustom')
                    : t('firstRunStepCredentialsDesc', { provider: providerDisplayName })
                  }
                </p>

                <div className="rounded-xl border border-[#1388ff]/18 bg-[#1388ff]/[0.06] px-4 py-3 text-slate-700 dark:border-[#3aa0ff]/18 dark:bg-[#3aa0ff]/[0.1] dark:text-slate-200">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
                      {providerSummaryIconId ? (
                        <ProviderBrandIcon providerId={providerSummaryIconId} size={24} />
                      ) : (
                        <div className="h-3 w-3 rounded-full border-2 border-dashed border-slate-400 dark:border-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase text-[#1377df]/70 dark:text-[#88c8ff]/75">
                        {t('firstRunCurrentProvider')}
                      </div>
                      <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
                        {providerDisplayName}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[12px] text-slate-500 dark:text-slate-400">
                        {providerSummaryEndpointLabel}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 sm:space-y-3.5">
                  <label className={labelClass}>
                    {`${providerDisplayName} API Key`}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyValue}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder={selectedPreset ? `${selectedPreset.id === 'deepseek' ? 'sk-' : ''}...` : 'sk-...'}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className={`${fieldClass} pr-12 font-mono placeholder:font-sans`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-300"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 sm:space-y-3.5">
                  <label className={labelClass}>
                    {t('endpoint')}
                  </label>
                  {selectedPreset && selectedPreset.endpoints.length > 1 ? (
                    <SelectDropdown
                      value={selectedEndpointId}
                      ariaLabel={t('endpoint')}
                      buttonClassName="h-auto min-h-12 rounded-xl px-4 py-3 text-[15px] font-normal"
                      menuWidth={360}
                      options={[
                        ...selectedPreset.endpoints.map((ep) => ({
                          value: ep.id,
                          label: locale === 'zh' ? ep.labelZh : ep.labelEn,
                          description: ep.baseUrl.replace(/^https?:\/\//, '')
                        })),
                        { value: '__custom__', label: t('customEndpoint') }
                      ]}
                      renderValue={(option) => {
                        const endpoint = option?.value === '__custom__'
                          ? null
                          : selectedPreset.endpoints.find((ep) => ep.id === option?.value)
                        return (
                          <>
                            {option?.label ?? t('customEndpoint')}
                            {endpoint ? (
                              <span className="font-normal text-ds-muted">
                                {' \u2014 '}
                                {endpoint.baseUrl.replace(/^https?:\/\//, '')}
                              </span>
                            ) : null}
                          </>
                        )
                      }}
                      onChange={handleEndpointChange}
                    />
                  ) : null}
                  {selectedEndpointId === '__custom__' || !selectedPreset ? (
                    <input
                      type="text"
                      value={selectedEndpointId === '__custom__' ? customEndpointUrl : baseUrlValue}
                      onChange={(e) => {
                        if (selectedEndpointId === '__custom__') {
                          handleCustomEndpointUrlChange(e.target.value)
                        } else {
                          handleBaseUrlChange(e.target.value)
                        }
                      }}
                      placeholder={selectedPreset ? getDefaultEndpoint(selectedPreset).baseUrl : 'https://api.example.com/v1'}
                      className={fieldClass}
                    />
                  ) : (
                    <div className="w-full rounded-xl border border-slate-200/80 bg-slate-50/75 px-4 py-3 text-[14px] text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                      {baseUrlValue.replace(/^https?:\/\//, '')}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 px-4 py-3 text-[13px] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 min-[560px]:grid-cols-[1fr_auto] min-[560px]:items-center">
                  <p className="min-w-0 leading-6">
                    {t('firstRunBuyApiHint', { provider: providerDisplayName })}
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenApiPage}
                    className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#1388ff]/24 bg-[#1388ff]/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-[#1377df] transition hover:bg-[#1388ff]/[0.1] dark:border-[#3aa0ff]/22 dark:bg-[#3aa0ff]/[0.12] dark:text-[#88c8ff] dark:hover:bg-[#3aa0ff]/[0.18]"
                  >
                    <span className="min-w-0 text-center leading-tight">{t('firstRunBuyApiAction')}</span>
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 space-y-3 border-t border-slate-200/72 bg-white/70 px-5 pb-4 pt-3.5 dark:border-white/10 dark:bg-white/[0.025] sm:space-y-4 sm:px-7 sm:pb-6 sm:pt-4">
            {error && (
              <div className="rounded-xl border border-red-500/18 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-700 dark:border-red-500/20 dark:bg-red-500/[0.12] dark:text-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:grid sm:grid-cols-[0.85fr_1fr]">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300/80 bg-white/75 px-4 py-2 text-[15px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/16 dark:hover:bg-white/[0.06]"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                  {t('firstRunPrev')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-11 rounded-xl border border-slate-300/80 bg-white/75 px-4 py-2 text-[15px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/16 dark:hover:bg-white/[0.06]"
                >
                  {t('firstRunClose')}
                </button>
              )}
              <button
                type="button"
                disabled={saving || !canAdvance()}
                onClick={handleNext}
                className="min-h-11 rounded-xl bg-[linear-gradient(180deg,#2392ff_0%,#0e7df0_100%)] px-4 py-2 text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(19,136,255,0.22)] transition hover:opacity-95 disabled:opacity-50 dark:bg-[linear-gradient(180deg,#2c9dff_0%,#1584f6_100%)] dark:shadow-[0_14px_30px_rgba(21,132,246,0.2)]"
              >
                {saving
                  ? t('firstRunSaving')
                  : step === TOTAL_STEPS - 1
                    ? t('firstRunSave')
                    : (
                      <span className="inline-flex items-center gap-2">
                        {t('firstRunNext')}
                        <ChevronRight className="h-4 w-4" strokeWidth={2} />
                      </span>
                    )
                }
              </button>
            </div>

            <p className="text-center text-[12.5px] leading-6 text-slate-400 dark:text-slate-500">
              {t(isPreview ? 'firstRunPreviewHint' : 'firstRunChangeLater')}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
