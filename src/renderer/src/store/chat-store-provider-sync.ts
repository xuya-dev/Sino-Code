import type { ModelProviderModelGroup } from '@shared/sino-code-api'
import { rendererRuntimeClient } from '../agent/runtime-client'
import { providerIdForComposerModel } from './chat-store-helpers'

export async function syncDragonProviderForComposerModel(
  composerModel: string,
  providerGroups: readonly ModelProviderModelGroup[] = []
): Promise<boolean> {
  if (typeof window.sinoCode === 'undefined') return false
  const providerId = providerIdForComposerModel(composerModel, providerGroups)
  if (!providerId) return false
  const settings = await rendererRuntimeClient.getSettings()
  if (settings.agents.dragon.providerId.trim() === providerId) return false
  await rendererRuntimeClient.setSettings({ agents: { dragon: { providerId } } })
  return true
}
