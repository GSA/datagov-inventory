import type { CatalogGraph, CatalogObject } from './types'
import { linkersOf, usesOf } from './uses'
import { createUuid, type CreateUuid } from './id'

export interface ParentLink {
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

/** Replaces an object's requested fields without mutating the input graph. */
export function updateObject(graph: CatalogGraph, id: string, updates: Partial<CatalogObject>): CatalogGraph {
  const object = graph.objects.get(id)
  if (!object) throw new Error(`Object ${id} not found`)
  const objects = new Map(graph.objects)
  objects.set(id, {
    ...object,
    ...updates,
    properties: { ...object.properties, ...updates.properties },
  })
  return { ...graph, objects }
}

export function findParentLinks(graph: CatalogGraph, targetId: string): ParentLink[] {
  const parents: ParentLink[] = []
  for (const object of graph.objects.values()) {
    for (const [property, childIds] of Object.entries(object.links)) {
      childIds.forEach((childId, position) => {
        if (childId === targetId) parents.push({ parentId: object.id, property, position })
      })
    }
  }
  return parents
}

function findAllChildren(graph: CatalogGraph, objectId: string): CatalogObject[] {
  const children: CatalogObject[] = []
  const object = graph.objects.get(objectId)
  if (!object) return children
  for (const childIds of Object.values(object.links)) {
    for (const childId of childIds) {
      const child = graph.objects.get(childId)
      if (child) {
        children.push(child)
        children.push(...findAllChildren(graph, childId))
      }
    }
  }
  return children
}

export function removeLink(
  graph: CatalogGraph,
  parentId: string,
  property: string,
  childId: string,
): { catalog: CatalogGraph; undoRecord: LinkRemovalRecord } {
  const objects = new Map(graph.objects)
  const parent = objects.get(parentId)
  if (!parent) throw new Error(`Parent object ${parentId} not found`)
  const links = { ...parent.links }
  const childIds = [...(links[property] || [])]
  const position = childIds.indexOf(childId)
  if (position === -1) throw new Error(`Child ${childId} not found in ${parentId}.${property}`)
  childIds.splice(position, 1)
  const wasSingleLink = parent.singleLinks.includes(property)
  if (childIds.length === 0) delete links[property]
  else links[property] = childIds
  objects.set(parentId, {
    ...parent,
    links,
    singleLinks: parent.singleLinks.filter((item) => item !== property || childIds.length > 0),
  })
  return {
    catalog: { ...graph, objects },
    undoRecord: { type: 'link', parentId, property, childId, position, wasSingleLink },
  }
}

export function deleteObject(
  graph: CatalogGraph,
  objectId: string,
): { catalog: CatalogGraph; undoRecord: ObjectRemovalRecord } {
  const parentLinks = findParentLinks(graph, objectId)
  const object = graph.objects.get(objectId)
  if (!object) throw new Error(`Object ${objectId} not found`)
  const children = findAllChildren(graph, objectId)
  const sharedChildren = children.filter((child) =>
    findParentLinks(graph, child.id).some((link) => link.parentId !== objectId),
  )
  const objectsToDelete = new Set([objectId, ...children.map((child) => child.id)])
  for (const shared of sharedChildren) objectsToDelete.delete(shared.id)
  const objects = new Map(graph.objects)
  for (const { parentId, property } of parentLinks) {
    const parent = objects.get(parentId)
    if (!parent) continue
    const links = { ...parent.links }
    const childIds = [...(links[property] || [])]
    const position = childIds.indexOf(objectId)
    if (position !== -1) childIds.splice(position, 1)
    if (childIds.length === 0) delete links[property]
    else links[property] = childIds
    objects.set(parentId, {
      ...parent,
      links,
      singleLinks: parent.singleLinks.filter((item) => item !== property || childIds.length > 0),
    })
  }
  for (const id of objectsToDelete) objects.delete(id)
  return {
    catalog: { ...graph, objects },
    undoRecord: {
      type: 'object',
      object,
      children: children.filter((child) => !sharedChildren.includes(child)),
      parentLinks,
    },
  }
}

export function undoRemoval(graph: CatalogGraph, record: RemovalRecord): CatalogGraph {
  const objects = new Map(graph.objects)
  if (record.type === 'link') {
    const parent = objects.get(record.parentId)
    if (!parent) throw new Error(`Parent object ${record.parentId} not found`)
    const links = { ...parent.links }
    const childIds = [...(links[record.property] || [])]
    childIds.splice(record.position, 0, record.childId)
    links[record.property] = childIds
    objects.set(record.parentId, {
      ...parent,
      links,
      singleLinks:
        record.wasSingleLink && childIds.length === 1
          ? [...parent.singleLinks, record.property]
          : parent.singleLinks,
    })
  } else {
    objects.set(record.object.id, record.object)
    for (const child of record.children) objects.set(child.id, child)
    for (const { parentId, property, position } of record.parentLinks) {
      const parent = objects.get(parentId)
      if (!parent) continue
      const links = { ...parent.links }
      const childIds = [...(links[property] || [])]
      childIds.splice(position, 0, record.object.id)
      links[property] = childIds
      objects.set(parentId, { ...parent, links })
    }
  }
  return { ...graph, objects }
}

/** A copy of `records` merged, without a prototype, as decompose makes them, so a `__proto__` key stays data. */
const record = <T,>(...records: Record<string, T>[]): Record<string, T> => Object.assign(Object.create(null), ...records)

/**
 * The catalog with `parent`'s `property` set to `ids`. A `single` field is written back as one object. A list field
 * that was read as one object (`"distribution": {…}`) becomes a list once it holds two. An empty list kept as written
 * (`"distribution": []`) gives way to the links.
 */
function withLinks(catalog: CatalogGraph, parent: CatalogObject, property: string, ids: string[], single: boolean) {
  const others = parent.singleLinks.filter((p) => p !== property)
  const singleLinks = single ? [...others, property] : ids.length > 1 ? others : parent.singleLinks
  const properties = record(parent.properties)
  const value = properties[property]
  if (Array.isArray(value) && value.length === 0) delete properties[property]
  const objects = new Map(catalog.objects)
  objects.set(parent.id, { ...parent, properties, links: record(parent.links, { [property]: ids }), singleLinks })
  return { ...catalog, objects }
}

function get(catalog: CatalogGraph, id: string): CatalogObject {
  const object = catalog.objects.get(id)
  if (!object) throw new Error(`Object ${id} not found`)
  return object
}

/**
 * Adds `childId` at the end of `parentId`'s `property`. A `single` field (one object, not a list) must be empty, and
 * is written back as one object on export. Refuses a link that would make a loop.
 */
export function linkObject(
  catalog: CatalogGraph,
  parentId: string,
  property: string,
  childId: string,
  single = false,
): CatalogGraph {
  const parent = get(catalog, parentId)
  get(catalog, childId)
  const ids = parent.links[property] ?? []
  if (ids.includes(childId)) return catalog
  if (single && ids.length > 0) throw new Error(`${parentId}.${property} holds one object already`)
  if (linkersOf(parentId, catalog).has(childId)) throw new Error(`Linking ${childId} under ${parentId} makes a loop`)
  return withLinks(catalog, parent, property, [...ids, childId], single)
}

/**
 * Creates a blank object of `dcatClass` with a UUID and links it at the end of `parentId`'s `property`. Its `@type`
 * names its class, so a subclass (an Organization in an Agent field) stays one after export and import.
 */
export function createLinked(
  catalog: CatalogGraph,
  parentId: string,
  property: string,
  dcatClass: string,
  single = false,
  createUuidForObject: CreateUuid = createUuid,
): { catalog: CatalogGraph; id: string } {
  const parent = get(catalog, parentId)
  const ids = parent.links[property] ?? []
  if (single && ids.length > 0) throw new Error(`${parentId}.${property} holds one object already`)
  const id = createUuidForObject()
  const object: CatalogObject = { id, dcatClass, properties: record({ '@type': dcatClass }), links: record({}), singleLinks: [] }
  // A new object links to nothing, so it cannot make a loop: no loop check, and no index built for nothing.
  const linked = withLinks(catalog, parent, property, [...ids, id], single)
  linked.objects.set(id, object)
  return { catalog: linked, id }
}

/**
 * "Edit a copy for this one": copies `targetId` for `parentId`'s `property` alone, and links the copy there in its
 * place. Objects used only inside the target (its address, say) are copied too, so editing the copy never changes
 * the original; objects it shares with others stay shared. Copies have no `@id`.
 */
export function copyFor(
  catalog: CatalogGraph,
  parentId: string,
  property: string,
  targetId: string,
  createUuidForObject: CreateUuid = createUuid,
): { catalog: CatalogGraph; id: string } {
  const parent = get(catalog, parentId)
  const ids = parent.links[property] ?? []
  if (!ids.includes(targetId)) throw new Error(`${targetId} is not in ${parentId}.${property}`)

  // The target's descendants, then those used only from inside the target, until no more are found.
  const uses = usesOf(catalog)
  const descendants = new Set<string>()
  const walk = (id: string) => {
    for (const child of Object.values(get(catalog, id).links).flat()) {
      if (child !== targetId && !descendants.has(child)) {
        descendants.add(child)
        walk(child)
      }
    }
  }
  walk(targetId)
  const inside = new Set([targetId])
  for (let grew = true; grew; ) {
    grew = false
    for (const id of descendants) {
      if (!inside.has(id) && (uses.get(id) ?? []).every((use) => inside.has(use.parentId))) {
        inside.add(id)
        grew = true
      }
    }
  }

  const objects = new Map(catalog.objects)
  const copies = new Map<string, string>()
  const copy = (id: string, newId = createUuidForObject()) => {
    copies.set(id, newId)
    const original = get(catalog, id)
    const links: Record<string, string[]> = record({})
    for (const [link, children] of Object.entries(original.links)) {
      links[link] = children.map(
        (child) =>
          copies.get(child) ??
          (inside.has(child) ? copy(child) : child),
      )
    }
    // Not the `@id`: two objects with one IRI are one node to JSON-LD, which would undo "for this one only".
    const properties = record(original.properties)
    delete properties['@id']
    objects.set(newId, { ...original, id: newId, properties, links })
    return newId
  }
  const id = copy(targetId)
  return {
    catalog: withLinks({ ...catalog, objects }, parent, property, ids.map((child) => (child === targetId ? id : child)), false),
    id,
  }
}
