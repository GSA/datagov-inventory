import type { CatalogGraph, CatalogObject } from './types'
import { createUuid, type CreateUuid } from './id'

/**
 * Replaces every object id in an accepted graph and every reference to it. The input ids
 * are treated as opaque: they may be JSON Pointers, fixture names, or any other unique keys.
 */
export function identifyGraph(graph: CatalogGraph, createUuidForObject: CreateUuid = createUuid): CatalogGraph {
  const ids = new Map([...graph.objects.keys()].map((id) => {
    return [id, createUuidForObject()]
  }))
  const identified = new Map<string, CatalogObject>()
  const idFor = (id: string) => {
    const identifiedId = ids.get(id)
    if (!identifiedId) throw new Error(`Catalog object ${id} does not exist.`)
    return identifiedId
  }

  for (const object of graph.objects.values()) {
    const links: Record<string, string[]> = Object.create(null)
    for (const [property, childIds] of Object.entries(object.links)) links[property] = childIds.map(idFor)
    const id = idFor(object.id)
    identified.set(id, { ...object, id, links })
  }
  return { rootId: idFor(graph.rootId), objects: identified }
}
