/**
 * Build upstream URLs for OpenAI-compatible providers. `/beta` is treated as
 * a provider-specific version segment so DeepSeek beta bases can still reach
 * the standard `/v1/*` endpoints where needed.
 */
function isVersionSegment(segment: string): boolean {
  const s = segment.toLowerCase()
  if (s === 'beta') return true
  return /^v\d+$/i.test(segment)
}

function unversionedBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const slash = trimmed.lastIndexOf('/')
  if (slash < 0) return trimmed
  const seg = trimmed.slice(slash + 1)
  if (isVersionSegment(seg)) return trimmed.slice(0, slash)
  return trimmed
}

function versionedBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const seg = trimmed.split('/').pop() ?? ''
  if (isVersionSegment(seg)) return trimmed
  return `${trimmed}/v1`
}

export function upstreamOpenAiModelsUrl(baseUrl: string): string {
  const path = 'models'
  let versioned = versionedBaseUrl(baseUrl.trim())
  if (versioned.toLowerCase().endsWith('/beta')) {
    versioned = `${unversionedBaseUrl(baseUrl.trim())}/v1`
  }
  return `${versioned.replace(/\/+$/, '')}/${path}`
}

export function upstreamOpenAiChatCompletionsUrl(baseUrl: string): string {
  const path = 'chat/completions'
  let versioned = versionedBaseUrl(baseUrl.trim())
  if (versioned.toLowerCase().endsWith('/beta')) {
    versioned = `${unversionedBaseUrl(baseUrl.trim())}/v1`
  }
  return `${versioned.replace(/\/+$/, '')}/${path}`
}

export function upstreamDeepSeekBetaFimCompletionsUrl(baseUrl: string): string {
  const path = 'completions'
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  const base = trimmed
  const segment = base.split('/').pop()?.toLowerCase() ?? ''
  const betaBase = segment === 'beta'
    ? base
    : isVersionSegment(segment)
      ? `${unversionedBaseUrl(base)}/beta`
      : `${base}/beta`
  return `${betaBase.replace(/\/+$/, '')}/${path}`
}
