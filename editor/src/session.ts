import { createContext, useContext, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CatalogGraph, CatalogObject } from './catalog/types'
import { usesOf } from './links'
import { useValidationContext } from './validation/ValidationContext'
import { count, isolate, labelOf, pathOf } from './tree'

/** The catalog open in the editor: the one working copy (#15). */
export interface OpenCatalog {
  /** The file name, sample name, "Pasted JSON" or "Blank catalog". */
  name: string
  catalog: CatalogGraph
  /** Unique per load, so the editor starts fresh for each catalog. */
  loadId: number
}

export interface CatalogContextValue {
  open?: OpenCatalog
  setOpen: (catalog: OpenCatalog | undefined) => void
  updateObject: (id: string, updates: Partial<CatalogObject>) => void
  removeLink: (parentId: string, property: string, childId: string) => void
  deleteObject: (id: string) => void
  undoRemoval: () => void
  canUndo: boolean
  /** Adds an existing object to a field (#25). `single`: the field holds one object, not a list. */
  linkObject: (parentId: string, property: string, childId: string, single: boolean) => void
  /** Creates a blank object of `dcatClass` in a field, and returns its id. */
  createObject: (parentId: string, property: string, dcatClass: string, single: boolean) => string | undefined
  /** Puts a copy of a shared object in its place in one field, and returns the copy's id. */
  copyObject: (parentId: string, property: string, targetId: string) => string | undefined
}

export const CatalogContext = createContext<CatalogContextValue>({
  setOpen: () => {},
  updateObject: () => {},
  removeLink: () => {},
  deleteObject: () => {},
  undoRemoval: () => {},
  canUndo: false,
  linkObject: () => {},
  createObject: () => undefined,
  copyObject: () => undefined,
})

export const useCatalog = () => useContext(CatalogContext)

/** Names the page in the browser tab and history, as each route changes (#30). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | Inventory Editor`
  }, [title])
}

/**
 * "Edit a copy for this one" (#25): puts a copy of the shared `original` in its place in `parent`'s `property`, and
 * opens the copy with a note saying so.
 */
export function useEditCopy() {
  const { open, copyObject } = useCatalog()
  const { markStale } = useValidationContext()
  const navigate = useNavigate()
  return (parent: CatalogObject, property: string, original: CatalogObject) => {
    const id = copyObject(parent.id, property, original.id)
    if (!id || !open) return
    const others = (usesOf(open.catalog).get(original.id)?.length ?? 1) - 1
    markStale(parent.id)
    const rest = others === 1 ? 'The other place still uses' : `The other ${count(others)} places still use`
    navigate({
      to: '/editor/$',
      params: { _splat: pathOf(id) },
      state: {
        from: parent.id,
        notice: `This is a copy of ${isolate(labelOf(original))} for ${isolate(labelOf(parent))} only. ${rest} the original.`,
      },
    })
  }
}
