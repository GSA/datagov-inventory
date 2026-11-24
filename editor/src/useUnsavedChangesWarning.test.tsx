import type { RefObject } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning'

function Harness({ hasUnsavedChangesRef }: { hasUnsavedChangesRef: RefObject<boolean> }) {
  useUnsavedChangesWarning(hasUnsavedChangesRef)
  return null
}

const leaving = () => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('useUnsavedChangesWarning', () => {
  it('warns only while the catalog has unsaved changes', () => {
    const hasUnsavedChangesRef = { current: false }
    const { unmount } = render(<Harness hasUnsavedChangesRef={hasUnsavedChangesRef} />)
    expect(leaving().defaultPrevented).toBe(false)

    hasUnsavedChangesRef.current = true
    expect(leaving().defaultPrevented).toBe(true)

    hasUnsavedChangesRef.current = false
    expect(leaving().defaultPrevented).toBe(false)

    unmount()
    expect(leaving().defaultPrevented).toBe(false)
  })
})
