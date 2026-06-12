import type { ReactElement } from 'react'

type ProviderBrandIconProps = {
  providerId: string
  size?: number
}

type ProviderMark = {
  label: string
  background: string
  border: string
  foreground: string
}

const PROVIDER_MARKS: Record<string, ProviderMark> = {
  deepseek: {
    label: 'DS',
    background: '#eef6ff',
    border: '#bdd7ff',
    foreground: '#1769aa'
  },
  zhipu: {
    label: 'GLM',
    background: '#f0f7ff',
    border: '#c8ddff',
    foreground: '#0b5fc0'
  },
  minimax: {
    label: 'MM',
    background: '#fff6e6',
    border: '#f3ca76',
    foreground: '#a05a00'
  },
  moonshot: {
    label: 'K',
    background: '#f3f0ff',
    border: '#d8cffc',
    foreground: '#5f49bd'
  },
  alibaba: {
    label: 'QW',
    background: '#fff1e8',
    border: '#ffc9a8',
    foreground: '#bd4b08'
  },
  tencent: {
    label: 'TX',
    background: '#eaf7ff',
    border: '#b9e3fb',
    foreground: '#0870a9'
  },
  xiaomi: {
    label: 'MI',
    background: '#fff3e5',
    border: '#ffc785',
    foreground: '#b25700'
  }
}

const FALLBACK_MARK: ProviderMark = {
  label: '',
  background: '#f3f6fb',
  border: '#d7dfeb',
  foreground: '#53627a'
}

function fallbackLabel(providerId: string): string {
  const words = providerId
    .trim()
    .replace(/[^a-z0-9]+/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }

  const compact = words[0] ?? providerId.trim()
  return (compact.slice(0, 2) || '?').toUpperCase()
}

export function ProviderBrandIcon({ providerId, size = 20 }: ProviderBrandIconProps): ReactElement {
  const key = providerId.trim().toLowerCase()
  const mark = PROVIDER_MARKS[key] ?? {
    ...FALLBACK_MARK,
    label: fallbackLabel(providerId)
  }
  const fontSize = Math.max(7, Math.round(size * 0.38))

  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 select-none items-center justify-center rounded-md border font-semibold uppercase leading-none shadow-sm"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderColor: mark.border,
        background: mark.background,
        color: mark.foreground,
        fontSize
      }}
    >
      {mark.label}
    </span>
  )
}
