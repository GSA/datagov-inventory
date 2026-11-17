import { createContext, useContext, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { DecomposedCatalog, CatalogObject } from './catalog/decompose'
import { usesOf } from './links'
import { count, labelOf, pathOf } from './tree'

/** The catalog open in the editor: the one working copy (#15). */
export interface OpenCatalog {
  /** The file name, sample name, "Pasted JSON" or "Blank catalog". */
  name: string
  catalog: DecomposedCatalog
  /** Unique per load, so the editor starts fresh for each catalog. */
  loadId: number
}

interface ParentLink {
  parentId: string
  property: string
  position: number
}

interface LinkRemovalRecord {
  type: 'link'
  parentId: string
  property: string
  childId: string
  position: number
  wasSingleLink: boolean
}

interface ObjectRemovalRecord {
  type: 'object'
  object: CatalogObject
  children: CatalogObject[]
  parentLinks: ParentLink[]
}

export type RemovalRecord = LinkRemovalRecord | ObjectRemovalRecord

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
  const navigate = useNavigate()
  return (parent: CatalogObject, property: string, original: CatalogObject) => {
    const others = (open ? (usesOf(open.catalog).get(original.id)?.length ?? 1) : 1) - 1
    const id = copyObject(parent.id, property, original.id)
    if (!id) return
    const rest = others === 1 ? 'The other place still uses' : `The other ${count(others)} places still use`
    navigate({
      to: '/editor/$',
      params: { _splat: pathOf(id) },
      state: { from: parent.id, notice: `This is a copy of ${labelOf(original)} for ${labelOf(parent)} only. ${rest} the original.` },
    })
  }
}

export function findParentLinks(
  catalog: DecomposedCatalog,
  targetId: string
): ParentLink[] {
  const parents: ParentLink[] = []
  for (const object of catalog.objects.values()) {
    for (const [property, childIds] of Object.entries(object.links)) {
      childIds.forEach((childId, position) => {
        if (childId === targetId) {
          parents.push({ parentId: object.id, property, position })
        }
      })
    }
  }
  return parents
}

function findAllChildren(
  catalog: DecomposedCatalog,
  objectId: string
): CatalogObject[] {
  const children: CatalogObject[] = []
  const object = catalog.objects.get(objectId)
  if (!object) return children

  for (const childIds of Object.values(object.links)) {
    for (const childId of childIds) {
      const child = catalog.objects.get(childId)
      if (child) {
        children.push(child)
        children.push(...findAllChildren(catalog, childId))
      }
    }
  }
  return children
}

export function removeLink(
  catalog: DecomposedCatalog,
  parentId: string,
  property: string,
  childId: string
): { catalog: DecomposedCatalog; undoRecord: LinkRemovalRecord } {
  const objects = new Map(catalog.objects)
  const parent = objects.get(parentId)
  if (!parent) {
    throw new Error(`Parent object ${parentId} not found`)
  }

  const newLinks = { ...parent.links }
  const childIds = [...(newLinks[property] || [])]
  const position = childIds.indexOf(childId)
  if (position === -1) {
    throw new Error(`Child ${childId} not found in ${parentId}.${property}`)
  }

  childIds.splice(position, 1)

  const wasSingleLink = parent.singleLinks.includes(property)

  if (childIds.length === 0) {
    delete newLinks[property]
  } else {
    newLinks[property] = childIds
  }

  const newSingleLinks = parent.singleLinks.filter(p => p !== property || childIds.length > 0)

  objects.set(parentId, {
    ...parent,
    links: newLinks,
    singleLinks: newSingleLinks,
  })

  return {
    catalog: { ...catalog, objects },
    undoRecord: {
      type: 'link',
      parentId,
      property,
      childId,
      position,
      wasSingleLink,
    },
  }
}

export function deleteObject(
  catalog: DecomposedCatalog,
  objectId: string
): { catalog: DecomposedCatalog; undoRecord: ObjectRemovalRecord } {
  const parentLinks = findParentLinks(catalog, objectId)
  const object = catalog.objects.get(objectId)
  if (!object) {
    throw new Error(`Object ${objectId} not found`)
  }

  const children = findAllChildren(catalog, objectId)

  const sharedChildren = children.filter(child =>
    findParentLinks(catalog, child.id).some(link => link.parentId !== objectId)
  )

  const objectsToDelete = new Set([objectId, ...children.map(c => c.id)])
  for (const shared of sharedChildren) {
    objectsToDelete.delete(shared.id)
  }

  const objects = new Map(catalog.objects)

  for (const { parentId, property } of parentLinks) {
    const parent = objects.get(parentId)
    if (!parent) continue

    const newLinks = { ...parent.links }
    const childIds = [...(newLinks[property] || [])]
    const idx = childIds.indexOf(objectId)
    if (idx !== -1) {
      childIds.splice(idx, 1)
    }

    if (childIds.length === 0) {
      delete newLinks[property]
    } else {
      newLinks[property] = childIds
    }

    const newSingleLinks = parent.singleLinks.filter(p => p !== property || childIds.length > 0)

    objects.set(parentId, {
      ...parent,
      links: newLinks,
      singleLinks: newSingleLinks,
    })
  }

  for (const id of objectsToDelete) {
    objects.delete(id)
  }

  return {
    catalog: { ...catalog, objects },
    undoRecord: {
      type: 'object',
      object,
      children: children.filter(c => !sharedChildren.includes(c)),
      parentLinks,
    },
  }
}

export function undoRemoval(
  catalog: DecomposedCatalog,
  record: RemovalRecord
): DecomposedCatalog {
  const objects = new Map(catalog.objects)

  if (record.type === 'link') {
    const parent = objects.get(record.parentId)
    if (!parent) {
      throw new Error(`Parent object ${record.parentId} not found`)
    }

    const newLinks = { ...parent.links }
    const childIds = [...(newLinks[record.property] || [])]
    childIds.splice(record.position, 0, record.childId)
    newLinks[record.property] = childIds

    const newSingleLinks = record.wasSingleLink && childIds.length === 1
      ? [...parent.singleLinks, record.property]
      : parent.singleLinks

    objects.set(record.parentId, {
      ...parent,
      links: newLinks,
      singleLinks: newSingleLinks,
    })
  } else {
    objects.set(record.object.id, record.object)
    for (const child of record.children) {
      objects.set(child.id, child)
    }

    for (const { parentId, property, position } of record.parentLinks) {
      const parent = objects.get(parentId)
      if (!parent) continue

      const newLinks = { ...parent.links }
      const childIds = [...(newLinks[property] || [])]
      childIds.splice(position, 0, record.object.id)
      newLinks[property] = childIds

      objects.set(parentId, {
        ...parent,
        links: newLinks,
      })
    }
  }

  return { ...catalog, objects }
}
