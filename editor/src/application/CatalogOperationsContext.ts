import { createContext, useContext } from 'react'
import type { CatalogOperations } from './CatalogService'

export const CatalogOperationsContext = createContext<CatalogOperations | undefined>(undefined)

/** Returns catalog use cases, failing immediately when the application composition root is missing. */
export function useCatalogOperations(): CatalogOperations {
  const operations = useContext(CatalogOperationsContext)
  if (!operations) throw new Error('useCatalogOperations must be used within CatalogOperationsProvider.')
  return operations
}
