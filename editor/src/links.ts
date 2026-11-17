/**
 * Picking, creating and copying the objects a class-valued field links to (#25). Linking an existing object adds its
 * id, so every parent shows the same object (ADR 0005); nothing is copied unless the user asks for a copy.
 */
import { subclasses, type CatalogObject, type DecomposedCatalog } from './catalog/decompose'
import { labelOf } from './tree'

/** What a field offers: "Create new" only, "Add an existing" only, or both. */
export type LinkMode = 'create' | 'select' | 'both'

/** Fields whose objects belong to their parent alone: a catalog's datasets, a dataset's distributions. */
const CREATE_ONLY_FIELDS = new Set([
  'Catalog.catalog',
  'Catalog.dataset',
  'Catalog.datasetSeries',
  'Catalog.hasPart',
  'Catalog.record',
  'Catalog.service',
  'Dataset.distribution',
  'Dataset.metadataDistribution',
  'Dataset.sample',
])
/** Value-like classes: one describes one thing (a period, a checksum), so sharing it makes no sense. */
export const CREATE_ONLY_CLASSES = new Set([
  'Address',
  'Attribution',
  'CatalogRecord',
  'Checksum',
  'PeriodOfTime',
  'QualityMeasurement',
  'Relationship',
])
/** Classes that belong to the catalog's own lists, so other fields pick them from there. */
export const CATALOG_MEMBERS = new Set(['Dataset', 'DatasetSeries', 'DataService'])

/**
 * Which of pick and create a field offers. The schema cannot say, so this is the huddle's rule (2026-11-06, D3):
 * reuse only where it makes sense.
 */
export function linkModeOf(dcatClass: string, property: string, allowed: readonly string[]): LinkMode {
  if (CREATE_ONLY_FIELDS.has(`${dcatClass}.${property}`) || allowed.some((c) => CREATE_ONLY_CLASSES.has(c))) {
    return 'create'
  }
  return allowed.some((c) => CATALOG_MEMBERS.has(c)) ? 'select' : 'both'
}

/** The id of a linked object's row in a field: "Back to …" focuses it on the way back. */
export const rowId = (property: string, childId: string) => `link-${property}-${childId}`

/** One place an object is used: a parent and the field that links to it. */
export interface Use {
  parentId: string
  property: string
}

const usesCache = new WeakMap<DecomposedCatalog['objects'], ReadonlyMap<string, readonly Use[]>>()

/**
 * Where each object is used: `links` the other way round, in document order. Built once per version of the catalog
 * (every change makes a new `objects` map), so counts and lists cost a lookup.
 */
export function usesOf({ objects }: DecomposedCatalog): ReadonlyMap<string, readonly Use[]> {
  let uses = usesCache.get(objects)
  if (!uses) {
    const index = new Map<string, Use[]>()
    for (const parent of objects.values()) {
      for (const [property, ids] of Object.entries(parent.links)) {
        for (const id of ids) {
          const use = { parentId: parent.id, property }
          const list = index.get(id)
          if (list) list.push(use)
          else index.set(id, [use])
        }
      }
    }
    usesCache.set(objects, (uses = index))
  }
  return uses
}

/** The object and every object that links down to it: linking any of them under it would make a loop. */
export function linkersOf(id: string, uses: ReadonlyMap<string, readonly Use[]>): Set<string> {
  const found = new Set([id])
  const queue = [id]
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    for (const { parentId } of uses.get(next) ?? []) {
      if (!found.has(parentId)) {
        found.add(parentId)
        queue.push(parentId)
      }
    }
  }
  return found
}

/** The classes a field can hold: those the schema allows, and their subclasses (an Organization where an Agent is allowed). */
export const classesFor = (allowed: readonly string[]) => [...new Set(allowed.flatMap((c) => [c, ...(subclasses.get(c) ?? [])]))]

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/**
 * The objects a field can add, A to Z: those of an allowed class (an Organization where an Agent is allowed), except
 * the object itself, those already in the field, and those above it, which would make a loop.
 */
export function candidatesFor(
  catalog: DecomposedCatalog,
  object: CatalogObject,
  property: string,
  allowed: readonly string[],
): CatalogObject[] {
  const classes = new Set(classesFor(allowed))
  const taken = new Set(object.links[property])
  const above = linkersOf(object.id, usesOf(catalog))
  const list: CatalogObject[] = []
  for (const candidate of catalog.objects.values()) {
    if (classes.has(candidate.dcatClass) && !taken.has(candidate.id) && !above.has(candidate.id)) list.push(candidate)
  }
  return list.sort((a, b) => collator.compare(labelOf(a), labelOf(b)))
}

/** Options shown at most: thousands would take long to render, and nobody scans them. */
export const PICK_LIMIT = 25

/** The first `limit` of `pool` whose label contains `query` (any case), and how many match in all. */
export function search(pool: readonly CatalogObject[], query: string, limit = PICK_LIMIT) {
  const needle = query.trim().toLowerCase()
  const items: CatalogObject[] = []
  let total = 0
  for (const object of pool) {
    if (needle && !labelOf(object).toLowerCase().includes(needle)) continue
    if (++total <= limit) items.push(object)
  }
  return { items, total }
}

/** `${base}/${n}` for the first n from `start` that no object has. */
function freeId(objects: DecomposedCatalog['objects'], base: string, start: number): string {
  let n = start
  while (objects.has(`${base}/${n}`)) n++
  return `${base}/${n}`
}

/** The catalog with `parent`'s `property` set to `ids`. */
function withLinks(catalog: DecomposedCatalog, parent: CatalogObject, property: string, ids: string[], single: boolean) {
  const singleLinks = single && !parent.singleLinks.includes(property) ? [...parent.singleLinks, property] : parent.singleLinks
  const objects = new Map(catalog.objects)
  objects.set(parent.id, { ...parent, links: { ...parent.links, [property]: ids }, singleLinks })
  return { ...catalog, objects }
}

function get(catalog: DecomposedCatalog, id: string): CatalogObject {
  const object = catalog.objects.get(id)
  if (!object) throw new Error(`Object ${id} not found`)
  return object
}

/**
 * Adds `childId` at the end of `parentId`'s `property`. A `single` field (one object, not a list) must be empty, and
 * is written back as one object on export. Refuses a link that would make a loop.
 */
export function linkObject(
  catalog: DecomposedCatalog,
  parentId: string,
  property: string,
  childId: string,
  single = false,
): DecomposedCatalog {
  const parent = get(catalog, parentId)
  get(catalog, childId)
  const ids = parent.links[property] ?? []
  if (ids.includes(childId)) return catalog
  if (single && ids.length > 0) throw new Error(`${parentId}.${property} holds one object already`)
  if (linkersOf(parentId, usesOf(catalog)).has(childId)) throw new Error(`Linking ${childId} under ${parentId} makes a loop`)
  return withLinks(catalog, parent, property, [...ids, childId], single)
}

/**
 * Creates a blank object of `dcatClass` and links it at the end of `parentId`'s `property`. Its id is
 * `<parent id>/<property>/<n>`, so it has an address like any loaded object. Its `@type` names its class, so a
 * subclass (an Organization in an Agent field) stays one after export and import.
 */
export function createLinked(
  catalog: DecomposedCatalog,
  parentId: string,
  property: string,
  dcatClass: string,
  single = false,
): { catalog: DecomposedCatalog; id: string } {
  const parent = get(catalog, parentId)
  const id = freeId(catalog.objects, `${parentId}/${property}`, parent.links[property]?.length ?? 0)
  const object: CatalogObject = { id, dcatClass, properties: { '@type': dcatClass }, links: {}, singleLinks: [] }
  const objects = new Map(catalog.objects).set(id, object)
  return { catalog: linkObject({ ...catalog, objects }, parentId, property, id, single), id }
}

/**
 * "Edit a copy for this one": copies `targetId` for `parentId`'s `property` alone, and links the copy there in its
 * place. Objects used only inside the target (its address, say) are copied too, so editing the copy never changes
 * the original; objects it shares with others stay shared.
 */
export function copyFor(
  catalog: DecomposedCatalog,
  parentId: string,
  property: string,
  targetId: string,
): { catalog: DecomposedCatalog; id: string } {
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
      if (!inside.has(id) && uses.get(id)!.every((use) => inside.has(use.parentId))) {
        inside.add(id)
        grew = true
      }
    }
  }

  const objects = new Map(catalog.objects)
  const copies = new Map<string, string>()
  const copy = (id: string, newId: string) => {
    copies.set(id, newId)
    const original = get(catalog, id)
    const links: Record<string, string[]> = {}
    for (const [link, children] of Object.entries(original.links)) {
      links[link] = children.map(
        (child) =>
          copies.get(child) ??
          (inside.has(child) ? copy(child, freeId(objects, `${newId}/${link}`, 0)) : child),
      )
    }
    objects.set(newId, { ...original, id: newId, properties: { ...original.properties }, links })
    return newId
  }
  const id = copy(targetId, freeId(objects, `${parentId}/${property}`, ids.length))
  const repointed = { ...catalog, objects }
  return {
    catalog: withLinks(repointed, objects.get(parentId)!, property, ids.map((child) => (child === targetId ? id : child)), false),
    id,
  }
}
