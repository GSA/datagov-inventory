import { createContext, useContext, useEffect } from 'react'
import type { DecomposedCatalog } from './catalog/decompose'

/** The catalog open in the editor: the one working copy (#15). */
export interface OpenCatalog {
  /** The file name, sample name, "Pasted JSON" or "Blank catalog". */
  name: string
  catalog: DecomposedCatalog
  /** Unique per load, so the editor starts fresh for each catalog. */
  loadId: number
}

export const CatalogContext = createContext<{ open?: OpenCatalog; setOpen: (open: OpenCatalog) => void }>({
  setOpen: () => {},
})

export const useCatalog = () => useContext(CatalogContext)

/** Names the page in the browser tab and history, as each route changes (#30). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | Inventory Editor`
  }, [title])
}
