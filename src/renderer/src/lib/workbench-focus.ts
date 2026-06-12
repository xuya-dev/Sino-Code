const COMPOSER_FOCUS_EVENT = 'sinocode:focus-composer'
const COMPOSER_FOCUS_DELAYS_MS = [0, 32, 120, 280]

function dispatchComposerFocusRequests(): void {
  for (const delay of COMPOSER_FOCUS_DELAYS_MS) {
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent(COMPOSER_FOCUS_EVENT))
      })
    }, delay)
  }
}

export function requestWorkbenchComposerFocus(): void {
  if (typeof window === 'undefined') return
  window.focus()
  dispatchComposerFocusRequests()

  const focusMainWindow =
    typeof window.sinoCode?.focusMainWindow === 'function'
      ? window.sinoCode.focusMainWindow().catch(() => undefined)
      : Promise.resolve()

  void focusMainWindow.finally(() => {
    dispatchComposerFocusRequests()
  })
}
