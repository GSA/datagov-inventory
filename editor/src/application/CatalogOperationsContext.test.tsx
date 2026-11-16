import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { CatalogOperations } from './CatalogService'
import { useCatalogOperations } from './CatalogOperationsContext'
import { CatalogOperationsProvider } from './CatalogOperationsProvider'

const operations: CatalogOperations = {
  createCatalog: vi.fn(),
  saveCatalog: vi.fn(),
  restoreCatalog: vi.fn(),
}

describe('CatalogOperationsContext', () => {
  it('returns the injected application operations', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CatalogOperationsProvider operations={operations}>{children}</CatalogOperationsProvider>
    )

    expect(renderHook(() => useCatalogOperations(), { wrapper }).result.current).toBe(operations)
  })

  it('fails when no provider is present', () => {
    expect(() => renderHook(() => useCatalogOperations())).toThrow(
      'useCatalogOperations must be used within CatalogOperationsProvider.',
    )
  })
})
