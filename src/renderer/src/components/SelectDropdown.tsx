import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export type SelectDropdownValue = string | number

export type SelectDropdownOption<T extends SelectDropdownValue = string> = {
  value: T
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

type DropdownPlacement = {
  left: number
  top: number
  width: number
  maxHeight: number
}

const DROPDOWN_MARGIN = 8
const DROPDOWN_GAP = 4
const DROPDOWN_MIN_HEIGHT = 80
const DROPDOWN_MIN_WIDTH = 160
const DROPDOWN_DEFAULT_MAX_HEIGHT = 320

export function SelectDropdown<T extends SelectDropdownValue = string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  menuWidth,
  maxMenuHeight = DROPDOWN_DEFAULT_MAX_HEIGHT,
  renderValue,
  renderOption
}: {
  value: T
  options: Array<SelectDropdownOption<T>>
  onChange: (value: T) => void
  ariaLabel?: string
  placeholder?: ReactNode
  disabled?: boolean
  className?: string
  buttonClassName?: string
  menuClassName?: string
  menuWidth?: number
  maxMenuHeight?: number
  renderValue?: (option: SelectDropdownOption<T> | undefined) => ReactNode
  renderOption?: (option: SelectDropdownOption<T>, state: { selected: boolean; active: boolean }) => ReactNode
}): ReactElement {
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex))
  const enabledOptions = useMemo(
    () => options.map((option, index) => ({ option, index })).filter((item) => !item.option.disabled),
    [options]
  )

  useEffect(() => {
    if (!open) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : enabledOptions[0]?.index ?? 0)
  }, [enabledOptions, open, selectedIndex])

  useEffect(() => {
    if (!open) return
    const updatePlacement = (): void => {
      const button = buttonRef.current
      if (button) setAnchorRect(button.getBoundingClientRect())
    }
    updatePlacement()
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)
    return () => {
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [open])

  const close = (): void => {
    setOpen(false)
    setAnchorRect(null)
  }

  const toggle = (): void => {
    if (disabled) return
    const button = buttonRef.current
    setAnchorRect(button?.getBoundingClientRect() ?? null)
    setOpen((value) => !value)
  }

  const choose = (option: SelectDropdownOption<T>): void => {
    if (option.disabled) return
    onChange(option.value)
    close()
  }

  const moveActive = (direction: 1 | -1): void => {
    if (enabledOptions.length === 0) return
    const currentEnabledIndex = Math.max(0, enabledOptions.findIndex((item) => item.index === activeIndex))
    const nextEnabledIndex = (currentEnabledIndex + direction + enabledOptions.length) % enabledOptions.length
    setActiveIndex(enabledOptions[nextEnabledIndex].index)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) toggle()
      moveActive(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        toggle()
        return
      }
      const activeOption = options[activeIndex]
      if (activeOption) choose(activeOption)
      return
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      close()
    }
  }

  const placement = anchorRect
    ? calculateSelectDropdownPlacement({
      anchorRect,
      width: menuWidth ?? Math.max(anchorRect.width / currentBodyZoom(), DROPDOWN_MIN_WIDTH),
      maxHeight: maxMenuHeight,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      coordinateScale: currentBodyZoom()
    })
    : null

  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={`flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-ds-border bg-ds-card px-3 text-left text-[13px] font-medium text-ds-ink shadow-sm transition hover:border-accent/35 hover:bg-ds-hover focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-55 ${buttonClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {renderValue ? renderValue(selectedOption) : selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-ds-faint transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {open && placement ? createPortal(
        <>
          <div className="fixed inset-0 cursor-default" style={{ zIndex: 99999 }} onClick={close} />
          <div
            id={menuId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              left: `${placement.left}px`,
              top: `${placement.top}px`,
              width: `${placement.width}px`,
              maxHeight: `${placement.maxHeight}px`,
              zIndex: 100000
            }}
            className={`rounded-xl border border-ds-border bg-ds-elevated p-1.5 text-left shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-100 overflow-y-auto ${menuClassName}`}
          >
            {options.map((option, index) => {
              const selected = option.value === value
              const active = index === activeIndex
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    selected
                      ? 'bg-accent/10 text-ds-ink'
                      : active
                        ? 'bg-ds-hover/70 text-ds-ink'
                        : 'text-ds-muted hover:bg-ds-hover/75 hover:text-ds-ink'
                  }`}
                >
                  {renderOption ? renderOption(option, { selected, active }) : <DefaultSelectDropdownOption option={option} />}
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.2} /> : null}
                </button>
              )
            })}
          </div>
        </>,
        document.body
      ) : null}
    </div>
  )
}

function DefaultSelectDropdownOption<T extends SelectDropdownValue>({
  option
}: {
  option: SelectDropdownOption<T>
}): ReactElement {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {option.icon ? <span className="flex h-5 w-5 shrink-0 items-center justify-center">{option.icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{option.label}</span>
        {option.description ? <span className="block truncate text-[11.5px] text-ds-faint">{option.description}</span> : null}
      </span>
    </span>
  )
}

function calculateSelectDropdownPlacement({
  anchorRect,
  width,
  maxHeight,
  viewportHeight,
  viewportWidth,
  coordinateScale = 1
}: {
  anchorRect: Pick<DOMRect, 'bottom' | 'left'>
  width: number
  maxHeight: number
  viewportHeight: number
  viewportWidth: number
  coordinateScale?: number
}): DropdownPlacement {
  const scale = Number.isFinite(coordinateScale) && coordinateScale > 0 ? coordinateScale : 1
  const normalizedAnchorRect = {
    bottom: anchorRect.bottom / scale,
    left: anchorRect.left / scale
  }
  const normalizedViewportHeight = viewportHeight / scale
  const normalizedViewportWidth = viewportWidth / scale
  const availableWidth = Math.max(0, normalizedViewportWidth - DROPDOWN_MARGIN * 2)
  const nextWidth = Math.min(Math.max(width, DROPDOWN_MIN_WIDTH), availableWidth)
  const left = clamp(
    normalizedAnchorRect.left,
    DROPDOWN_MARGIN,
    Math.max(DROPDOWN_MARGIN, normalizedViewportWidth - DROPDOWN_MARGIN - nextWidth)
  )
  const top = normalizedAnchorRect.bottom + DROPDOWN_GAP
  const availableHeight = Math.max(
    DROPDOWN_MIN_HEIGHT,
    normalizedViewportHeight - top - DROPDOWN_MARGIN
  )

  return { left, top, width: nextWidth, maxHeight: Math.min(maxHeight, availableHeight) }
}

function currentBodyZoom(): number {
  if (typeof window === 'undefined') return 1
  const style = window.getComputedStyle(document.body) as CSSStyleDeclaration & { zoom?: string }
  const zoom = style.zoom ?? '1'
  const parsed = Number.parseFloat(zoom)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
