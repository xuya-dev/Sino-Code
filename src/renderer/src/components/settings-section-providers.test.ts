import { describe, expect, it } from 'vitest'
import {
  buildProviderRouteModelOptions,
  calculateSettingsPopoverPlacement,
  selectedProviderRouteModelId
} from './settings-section-providers'

describe('settings provider popover placement', () => {
  it('opens below the trigger', () => {
    const placement = calculateSettingsPopoverPlacement({
      anchorRect: { left: 200, bottom: 120 } as Pick<DOMRect, 'bottom' | 'left'>,
      width: 220,
      maxHeight: 320,
      viewportHeight: 720,
      viewportWidth: 960
    })

    expect(placement.left).toBe(200)
    expect(placement.top).toBe(124)
    expect(placement.width).toBe(220)
    expect(placement.maxHeight).toBe(320)
  })

  it('normalizes coordinates when the app body is zoomed', () => {
    const placement = calculateSettingsPopoverPlacement({
      anchorRect: { left: 260, bottom: 160 } as Pick<DOMRect, 'bottom' | 'left'>,
      width: 220,
      maxHeight: 320,
      viewportHeight: 1440,
      viewportWidth: 1920,
      coordinateScale: 2
    })

    expect(placement.left).toBe(130)
    expect(placement.top).toBe(84)
  })

  it('keeps the menu below the trigger when vertical space is tight', () => {
    const placement = calculateSettingsPopoverPlacement({
      anchorRect: { left: 40, bottom: 680 } as Pick<DOMRect, 'bottom' | 'left'>,
      width: 220,
      maxHeight: 320,
      viewportHeight: 720,
      viewportWidth: 960
    })

    expect(placement.top).toBe(684)
    expect(placement.maxHeight).toBe(80)
  })
})

describe('settings provider route model controls', () => {
  it('builds stable main and fast model dropdown options from configured models', () => {
    expect(buildProviderRouteModelOptions([' main-model ', '', 'fast-model', 'main-model'], 'Unset', {
      'main-model': { id: 'main-model', name: 'Main Model' }
    })).toEqual([
      { value: '', label: 'Unset' },
      { value: 'main-model', label: 'Main Model', description: 'main-model' },
      { value: 'fast-model', label: 'fast-model' }
    ])
  })

  it('keeps selected route models only when they are in the dropdown options', () => {
    const optionIds = buildProviderRouteModelOptions(['main-model', 'fast-model'], 'Unset')
      .map((option) => option.value)

    expect(selectedProviderRouteModelId('main-model', optionIds)).toBe('main-model')
    expect(selectedProviderRouteModelId('auto', optionIds)).toBe('')
    expect(selectedProviderRouteModelId('missing-model', optionIds)).toBe('')
  })
})
