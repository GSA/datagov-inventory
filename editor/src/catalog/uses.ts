/** Where each object is used: the reverse of `links`, cached per version of the catalog (#25). */
import type { CatalogGraph } from './types'

/** One place an object is used: a parent and the field that links to it. */
export interface Use {
  parentId: string
  property: string
}

interface Index {
  /** Every link, from any object, removed ones included: what loop checks need. */
  all: ReadonlyMap<string, readonly Use[]>
  /** Links from objects in the catalog (reachable from it) only: what users see as places. */
  uses: ReadonlyMap<string, readonly Use[]>
}
const indexCache = new WeakMap<CatalogGraph['objects'], Index>()

/** `links` the other way round, built once per version of the catalog (every change makes a new `objects` map). */
function indexOf({ objects, rootId }: CatalogGraph): Index {
  let index = indexCache.get(objects)
  if (!index) {
    const all = new Map<string, Use[]>()
    for (const parent of objects.values()) {
      for (const [property, ids] of Object.entries(parent.links)) {
        for (const id of ids) {
          const use = { parentId: parent.id, property }
          const list = all.get(id)
          if (list) list.push(use)
          else all.set(id, [use])
        }
      }
    }
    // An object removed from its field stays in `objects` (so Undo can restore it), but its links are no longer uses.
    const inCatalog = new Set([rootId])
    for (const stack = [rootId]; stack.length > 0; ) {
      for (const id of Object.values(objects.get(stack.pop()!)?.links ?? {}).flat()) {
        if (!inCatalog.has(id)) {
          inCatalog.add(id)
          stack.push(id)
        }
      }
    }
    const uses = new Map<string, Use[]>()
    for (const [id, list] of all) {
      const kept = list.filter((use) => inCatalog.has(use.parentId))
      if (kept.length > 0) uses.set(id, kept)
    }
    indexCache.set(objects, (index = { all, uses }))
  }
  return index
}

/**
 * Carries the index over to a new version of the catalog whose links are unchanged (a field's text was edited), so
 * saving a field doesn't rebuild it.
 */
export function keepIndex(from: CatalogGraph['objects'], to: CatalogGraph['objects']) {
  const index = indexCache.get(from)
  if (index) indexCache.set(to, index)
}

/**
 * Where each object is used, in document order: the objects in the catalog that link to it, and the field. Cached
 * per version of the catalog, so counts and lists cost a lookup.
 */
export const usesOf = (catalog: CatalogGraph): ReadonlyMap<string, readonly Use[]> => indexOf(catalog).uses

/**
 * The object and every object that links down to it, removed ones included: linking any of them under it would make
 * a loop, now or once Undo or a pick brings the removed one back.
 */
export function linkersOf(id: string, catalog: CatalogGraph): Set<string> {
  const { all } = indexOf(catalog)
  const found = new Set([id])
  const queue = [id]
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    for (const { parentId } of all.get(next) ?? []) {
      if (!found.has(parentId)) {
        found.add(parentId)
        queue.push(parentId)
      }
    }
  }
  return found
}
