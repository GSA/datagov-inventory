import { createContext, useContext, useEffect } from 'react'
import type { DecomposedCatalog, CatalogObject } from './catalog/decompose'

/** The catalog open in the editor: the one working copy (#15). */
export interface OpenCatalog {
  /** The file name, sample name, "Pasted JSON" or "Blank catalog". */
  name: string
  catalog: DecomposedCatalog
  /** Unique per load, so the editor starts fresh for each catalog. */
  loadId: number
}

export interface CatalogContextValue {
  open?: OpenCatalog
  setOpen: (catalog: OpenCatalog | undefined) => void
  updateObject: (id: string, updates: Partial<CatalogObject>) => void
}

export const CatalogContext = createContext<CatalogContextValue>({
  setOpen: () => {},
  updateObject: () => {},
})

export const useCatalog = () => useContext(CatalogContext)

/** Names the page in the browser tab and history, as each route changes (#30). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | Inventory Editor`
  }, [title])
}
