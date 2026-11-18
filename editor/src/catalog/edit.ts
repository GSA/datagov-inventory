import type { CatalogGraph, CatalogObject } from './types'

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
