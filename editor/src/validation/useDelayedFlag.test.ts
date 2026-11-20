import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDelayedFlag } from './useDelayedFlag'

const render = (on: boolean) =>
  renderHook(({ on }) => useDelayedFlag(on, 400, 500), { initialProps: { on } })

describe('useDelayedFlag', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('never shows for a run shorter than the delay', () => {
    const { result, rerender } = render(false)
    rerender({ on: true })
    act(() => vi.advanceTimersByTime(399))
    expect(result.current).toBe(false)
    rerender({ on: false })
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current).toBe(false)
  })

  it('shows once the run outlasts the delay', () => {
    const { result, rerender } = render(false)
    rerender({ on: true })
    act(() => vi.advanceTimersByTime(400))
    expect(result.current).toBe(true)
  })

  it('stays shown for the minimum time when the run ends just after it shows', () => {
    const { result, rerender } = render(false)
    rerender({ on: true })
    act(() => vi.advanceTimersByTime(450))
    rerender({ on: false })
    act(() => vi.advanceTimersByTime(449))
    expect(result.current).toBe(true)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(false)
  })

  it('hides at once when the run ends after the minimum time', () => {
    const { result, rerender } = render(false)
    rerender({ on: true })
    act(() => vi.advanceTimersByTime(2_000))
    rerender({ on: false })
    act(() => vi.advanceTimersByTime(0))
    expect(result.current).toBe(false)
  })
})
