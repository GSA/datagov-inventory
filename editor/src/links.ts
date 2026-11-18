/**
 * Picking, creating and copying the objects a class-valued field links to (#25). Linking an existing object adds its
 * id, so every parent shows the same object (ADR 0005); nothing is copied unless the user asks for a copy. The edits
 * themselves (linkObject, createLinked, copyFor) are in catalog/edit.ts; this file holds what the field offers.
 */
import { subclasses } from './catalog/decompose'
import type { CatalogObject, CatalogGraph } from './catalog/types'
import { linkersOf } from './catalog/uses'
import { labelOf } from './tree'

/** What a field offers: "Create new" only, "Add an existing" only, or both. */
type LinkMode = 'create' | 'select' | 'both'

/** Fields whose objects belong to their parent alone: a catalog's datasets, a dataset's distributions. */
export const CREATE_ONLY_FIELDS = new Set([
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

/** The classes a field can hold: those the schema allows, and their subclasses (an Organization where an Agent is allowed). */
export const classesFor = (allowed: readonly string[]) => [...new Set(allowed.flatMap((c) => [c, ...(subclasses.get(c) ?? [])]))]

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/**
 * The objects a field can add, A to Z: those of an allowed class (an Organization where an Agent is allowed), except
 * the object itself, those already in the field, and those above it, which would make a loop.
 */
export function candidatesFor(
  catalog: CatalogGraph,
  object: CatalogObject,
  property: string,
  allowed: readonly string[],
): CatalogObject[] {
  const classes = new Set(classesFor(allowed))
  const taken = new Set(object.links[property])
  const above = linkersOf(object.id, catalog)
  const list: CatalogObject[] = []
  for (const candidate of catalog.objects.values()) {
    if (classes.has(candidate.dcatClass) && !taken.has(candidate.id) && !above.has(candidate.id)) list.push(candidate)
  }
  return list.sort((a, b) => collator.compare(labelOf(a), labelOf(b)))
}

/** Options shown at most: thousands would take long to render, and nobody scans them. */
export const PICK_LIMIT = 25

/** The first PICK_LIMIT of `pool` whose label contains every word of `query` (any case), and how many match in all. */
export function search(pool: readonly CatalogObject[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const items: CatalogObject[] = []
  let total = 0
  for (const object of pool) {
    const label = labelOf(object).toLowerCase()
    if (!words.every((word) => label.includes(word))) continue
    if (++total <= PICK_LIMIT) items.push(object)
  }
  return { items, total }
}
