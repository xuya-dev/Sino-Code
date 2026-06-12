export type ProviderEndpoint = {
  id: string
  labelZh: string
  labelEn: string
  baseUrl: string
}

export type ProviderPreset = {
  id: string
  nameZh: string
  nameEn: string
  endpoints: ProviderEndpoint[]
  websiteUrl: string
  brandColor: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    nameZh: '深度求索',
    nameEn: 'DeepSeek',
    endpoints: [
      { id: 'default', labelZh: 'API (Beta 缓存优化)', labelEn: 'API (Beta Cache)', baseUrl: 'https://api.deepseek.com/beta' },
      { id: 'stable', labelZh: 'API (稳定)', labelEn: 'API (Stable)', baseUrl: 'https://api.deepseek.com' },
    ],
    websiteUrl: 'https://platform.deepseek.com/usage',
    brandColor: '#4D6BFE'
  },
  {
    id: 'zhipu',
    nameZh: '智谱',
    nameEn: 'Z.ai',
    endpoints: [
      { id: 'coding', labelZh: 'BigModel Coding Plan', labelEn: 'BigModel Coding Plan', baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4' },
      { id: 'cn', labelZh: 'BigModel', labelEn: 'BigModel', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
      { id: 'intl-coding', labelZh: 'Z.AI Coding Plan', labelEn: 'Z.AI Coding Plan', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
      { id: 'intl', labelZh: 'Z.AI', labelEn: 'Z.AI', baseUrl: 'https://api.z.ai/api/paas/v4' },
    ],
    websiteUrl: 'https://open.bigmodel.cn',
    brandColor: '#3366FF'
  },
  {
    id: 'minimax',
    nameZh: '稀宇科技',
    nameEn: 'MiniMax',
    endpoints: [
      { id: 'cn', labelZh: '国内', labelEn: 'Domestic', baseUrl: 'https://api.minimaxi.com/v1' },
      { id: 'intl', labelZh: '海外', labelEn: 'International', baseUrl: 'https://api.minimax.io/v1' },
    ],
    websiteUrl: 'https://platform.minimaxi.com',
    brandColor: '#7C3AED'
  },
  {
    id: 'moonshot',
    nameZh: '月之暗面',
    nameEn: 'Moonshot',
    endpoints: [
      { id: 'coding', labelZh: 'Kimi For Coding', labelEn: 'Kimi For Coding', baseUrl: 'https://api.kimi.com/coding/v1' },
      { id: 'cn', labelZh: '国内按量', labelEn: 'Domestic', baseUrl: 'https://api.moonshot.cn/v1' },
      { id: 'intl', labelZh: '海外按量', labelEn: 'International', baseUrl: 'https://api.moonshot.ai/v1' },
    ],
    websiteUrl: 'https://platform.kimi.com',
    brandColor: '#6366F1'
  },
  {
    id: 'alibaba',
    nameZh: '阿里云百炼',
    nameEn: 'Alibaba Cloud (Bailian)',
    endpoints: [
      { id: 'coding', labelZh: 'Coding Plan', labelEn: 'Coding Plan', baseUrl: 'https://coding.dashscope.aliyuncs.com/v1' },
      { id: 'payg', labelZh: '按量', labelEn: 'Pay-As-You-Go', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      { id: 'token-plan', labelZh: 'Token Plan 团队版', labelEn: 'Token Plan Team', baseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' },
    ],
    websiteUrl: 'https://bailian.console.aliyun.com',
    brandColor: '#FF6A00'
  },
  {
    id: 'tencent',
    nameZh: '腾讯',
    nameEn: 'Tencent',
    endpoints: [
      { id: 'coding', labelZh: 'Coding Plan', labelEn: 'Coding Plan', baseUrl: 'https://api.lkeap.cloud.tencent.com/coding/v3' },
      { id: 'token-plan-personal', labelZh: 'Token Plan 个人版', labelEn: 'Token Plan Personal', baseUrl: 'https://api.lkeap.cloud.tencent.com/plan/v3' },
      { id: 'token-plan-enterprise', labelZh: 'Token Plan 企业版', labelEn: 'Token Plan Enterprise', baseUrl: 'https://tokenhub.tencentmaas.com/plan/v3' },
      { id: 'payg', labelZh: 'Token Hub 按量', labelEn: 'Token Hub Pay-As-You-Go', baseUrl: 'https://tokenhub.tencentmaas.com/v1' },
    ],
    websiteUrl: 'https://console.cloud.tencent.com/tokenhub',
    brandColor: '#0052D9'
  },
  {
    id: 'xiaomi',
    nameZh: '小米',
    nameEn: 'Xiaomi',
    endpoints: [
      { id: 'payg', labelZh: '按量', labelEn: 'Pay-As-You-Go', baseUrl: 'https://api.xiaomimimo.com/v1' },
      { id: 'token-plan', labelZh: 'Token Plan', labelEn: 'Token Plan', baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1' },
    ],
    websiteUrl: 'https://platform.xiaomimimo.com',
    brandColor: '#FF6900'
  }
]

export const CUSTOM_PROVIDER_PRESET_ID = '__custom__'

export function getProviderPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id)
}

export function getProviderPresetDisplayName(id: string, locale: string): string {
  const preset = getProviderPreset(id)
  if (!preset) return id
  return locale === 'zh' ? preset.nameZh : preset.nameEn
}

export function getDefaultEndpoint(preset: ProviderPreset): ProviderEndpoint {
  return preset.endpoints[0]
}

export function findEndpointByUrl(preset: ProviderPreset, baseUrl: string): ProviderEndpoint | undefined {
  return preset.endpoints.find((e) => e.baseUrl === baseUrl)
}
