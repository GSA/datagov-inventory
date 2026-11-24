import { createContext, useContext, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CatalogObject, CatalogWorkspace } from './catalog/types'
import { usesOf } from './catalog/uses'
import { useValidationContext } from './validation/ValidationContext'
import { count, isolate, labelOf } from './tree'
import { editorPath } from './objectRoute'

export type SaveStatus = 'saved' | 'saving' | 'not-saved'
export type RestoreResult = 'opened' | 'not-found'

export interface CatalogContextValue {
  /** The working copy open in this tab, if any. */
  open?: CatalogWorkspace
  /** Persists a newly accepted workspace, then opens it only after the write succeeds. */
  createAndOpen: (catalog: CatalogWorkspace) => Promise<void>
  /** Loads and opens a workspace by stable id, or reports that browser storage has no match. */
  restoreAndOpen: (id: string) => Promise<RestoreResult>
  /** Updates an existing object and queues the changed workspace for autosave. */
  updateObject: (id: string, updates: Partial<CatalogObject>) => void
  /** Removes one object reference, records it for Undo, and queues autosave. */
  removeLink: (parentId: string, property: string, childId: string) => void
  /** Deletes an object as graph rules allow, records it for Undo, and queues autosave. */
  deleteObject: (id: string) => void
  /** Restores the most recent removal or deletion and queues autosave. */
  undoRemoval: () => void
  /** Whether one removal or deletion is currently available to undo. */
  canUndo: boolean
  /** Adds an existing object to a field and queues autosave. `single` means the field holds one object, not a list. */
  linkObject: (parentId: string, property: string, childId: string, single: boolean) => void
  /** Creates and links a UUID-identified object, returns its id, and queues autosave. */
  createObject: (parentId: string, property: string, dcatClass: string, single: boolean) => string | undefined
  /** Copies a shared object for one parent, returns the copy's id, and queues autosave. */
  copyObject: (parentId: string, property: string, targetId: string) => string | undefined
  /** Current persistence state of the latest in-memory working copy. */
  saveStatus: SaveStatus
  /** Failure from the latest autosave attempt, when `saveStatus` is `not-saved`. */
  saveError?: Error
}

export const CatalogContext = createContext<CatalogContextValue | undefined>(undefined)

export function useCatalog(): CatalogContextValue {
  const catalog = useContext(CatalogContext)
  if (!catalog) throw new Error('useCatalog must be used within CatalogContext.Provider.')
  return catalog
}

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
      params: { _splat: editorPath(open, { id, dcatClass: original.dcatClass }) },
      state: {
        from: parent.id,
        notice: `This is a copy of ${isolate(labelOf(original))} for ${isolate(labelOf(parent))} only. ${rest} the original.`,
      },
    })
  }
}
