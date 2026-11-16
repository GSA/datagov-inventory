import type { ReactNode } from 'react'
import type { CatalogOperations } from './CatalogService'
import { CatalogOperationsContext } from './CatalogOperationsContext'

/** Supplies stable application operations without coupling components to repository details. */
export function CatalogOperationsProvider({
  operations,
  children,
}: {
  operations: CatalogOperations
  children: ReactNode
}) {
  return <CatalogOperationsContext.Provider value={operations}>{children}</CatalogOperationsContext.Provider>
}
