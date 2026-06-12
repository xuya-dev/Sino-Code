import type { ModelProviderModelGroup } from '@shared/sino-code-api'
import { rendererRuntimeClient } from '../agent/runtime-client'
import {
  composerRequestModel,
  providerIdForComposerModel
} from './chat-store-helpers'

export async function syncDragonProviderForComposerModel(
  composerModel: string,
  providerGroups: readonly ModelProviderModelGroup[] = []
): Promise<boolean> {
  if (typeof window.sinoCode === 'undefined') return false
  const providerId = providerIdForComposerModel(composerModel, providerGroups)
  if (!providerId) return false
  const model = composerRequestModel(composerModel)
  const settings = await rendererRuntimeClient.getSettings()
  if (
    settings.agents.dragon.providerId.trim() === providerId &&
    settings.agents.dragon.model.trim() === model
  ) {
    return false
  }
  await rendererRuntimeClient.setSettings({ agents: { dragon: { providerId, model } } })
  return true
}
