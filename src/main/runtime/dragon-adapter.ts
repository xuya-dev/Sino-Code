import { app } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_DRAGON_DATA_DIR,
  getDragonRuntimeSettings,
  type AppSettingsV1
} from '../../shared/app-settings'
import {
  buildDragonServeArgs,
  resolveDragonExecutable
} from '../resolve-dragon-binary'
import {
  isDragonChildRunning,
  reclaimDragonPort,
  startDragonChild,
  stopDragonChildAndWait
} from '../dragon-process'
import { getDragonBaseUrl } from '../dragon-base-url'

const DRAGON_RUNTIME_ID = 'dragon' as const

function appRoot(): string {
  return app.isPackaged
    ? app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked')
    : app.getAppPath()
}

export const dragonRuntimeAdapter = {
  id: DRAGON_RUNTIME_ID,

  async resolveExecutable(settings: AppSettingsV1): Promise<string> {
    const runtime = getDragonRuntimeSettings(settings)
    const resolution = resolveDragonExecutable(appRoot(), runtime.binaryPath)
    if (resolution.kind === 'node-script') {
      const scriptPath = resolution.args[0] ?? ''
      return runtime.binaryPath.trim()
        ? `Node.js script (${scriptPath})`
        : `Bundled Dragon (${scriptPath})`
    }
    return resolution.command
  },

  ensureRunning(settings: AppSettingsV1): Promise<void> {
    return startDragonChild(settings)
  },

  stopAndWait(): Promise<void> {
    return stopDragonChildAndWait()
  },

  isChildRunning(): boolean {
    return isDragonChildRunning()
  },

  getBaseUrl(settings: AppSettingsV1): string {
    const runtime = getDragonRuntimeSettings(settings)
    return getDragonBaseUrl(runtime.port)
  },

  reclaimPort(port: number): Promise<{ ok: true } | { ok: false; message: string }> {
    return reclaimDragonPort(port)
  }
}

export function getRuntimeBaseUrlForSettings(settings: AppSettingsV1): string {
  return dragonRuntimeAdapter.getBaseUrl(settings)
}

/** Build the bearer-token authorization header for Dragon requests. */
export function runtimeAuthHeaders(settings: AppSettingsV1): Headers {
  const runtime = getDragonRuntimeSettings(settings)
  const headers = new Headers()
  if (runtime.runtimeToken.trim()) {
    headers.set('Authorization', `Bearer ${runtime.runtimeToken.trim()}`)
  }
  return headers
}

export type RuntimeRequestInit = {
  method?: string
  body?: string
  headers?: Record<string, string>
}

export async function runtimeRequestViaHost(
  settings: AppSettingsV1,
  pathAndQuery: string,
  init: RuntimeRequestInit,
  ensureRuntime: (settings: AppSettingsV1) => Promise<void>
): Promise<{ ok: boolean; status: number; body: string }> {
  await ensureRuntime(settings)
  const base = getRuntimeBaseUrlForSettings(settings)
  const pathNorm = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  const url = `${base}${pathNorm}`
  const hdrs = runtimeAuthHeaders(settings)
  for (const [key, value] of Object.entries(init.headers ?? {})) {
    hdrs.set(key, value)
  }
  hdrs.set('Accept', 'application/json')
  if (init.body && !hdrs.has('Content-Type')) {
    hdrs.set('Content-Type', 'application/json')
  }
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: hdrs,
    body: init.body,
    signal: AbortSignal.timeout(init.method === 'POST' ? 60_000 : 15_000)
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text }
}

export { buildDragonServeArgs, resolveDragonExecutable }

/**
 * Default data directory used when the user has not provided one.
 * The path lives under the app user-data directory so packaged
 * installs do not need write access to the install folder.
 */
export function defaultDragonDataDir(): string {
  return DEFAULT_DRAGON_DATA_DIR.replace(/^~(?=$|[\\/])/, homedir())
}
