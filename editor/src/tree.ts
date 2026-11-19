/**
 * The catalog tree's rows (#23): the catalog, and each expanded object's children in link order. Rows follow
 * `links` by id, so an object linked from several places shows as the same object in each.
 */
import type { CatalogObject, CatalogGraph } from './catalog/types'
import * as models from './generated/models'

const LABEL_LENGTH = 200

/** Labels by object, computed once: objects don't change after loading, and rows re-render. */
const labels = new WeakMap<CatalogObject, string>()

/** Short words that stay lower case inside a class name: PeriodOfTime is "Period of Time". */
const MINOR_WORDS = new Set(['of', 'and', 'or', 'in', 'to'])

/** Display names for classes whose schema name means little to people: vCard's `Kind` is a contact. */
const CLASS_NAMES: Record<string, string> = { Kind: 'Contact' }

const classLabels = new Map<string, string>()

/**
 * A DCAT class as people read it: `PeriodOfTime` is "Period of Time", `CUIRestriction` is "CUI Restriction" (a run
 * of capitals stays one word), `Kind` is "Contact". The schema's own name stays the object's class; this is for
 * display only. Cached, since every tree row asks.
 */
export function classLabel(dcatClass: string): string {
  let label = classLabels.get(dcatClass)
  if (label === undefined) {
    const words = dcatClass.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z0-9]+/g) ?? [dcatClass]
    label =
      CLASS_NAMES[dcatClass] ??
      words.map((word, i) => (i > 0 && MINOR_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word)).join(' ')
    classLabels.set(dcatClass, label)
  }
  return label
}

/** Each property's label from the form models, built on first use. */
let fieldLabels: Map<string, string> | undefined

/**
 * A field's label as the form shows it, in sentence case: `contactPoint` is "Contact point", `accessURL` is "Access
 * URL", `fn` is "Full name". The model generator labels a property by its name alone, so every class that has the
 * property gives it the same label, and no class is needed. A property no model has reads as words the same way.
 */
export function fieldLabel(property: string): string {
  fieldLabels ??= new Map(
    Object.values(models).flatMap((model) => model.fields.map((field): [string, string] => [field.name, field.label])),
  )
  const words = property.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z0-9]+/g) ?? [property]
  return (
    fieldLabels.get(property) ??
    words.map((word, i) => (i === 0 ? word[0].toUpperCase() + word.slice(1) : /^[A-Z]+$/.test(word) ? word : word.toLowerCase())).join(' ')
  )
}

/**
 * A tree row's field and, when it says more, class: "Publisher · Organization", "Contact point · Contact", but just
 * "Dataset" for a dataset listed under Dataset.
 */
export function fieldAndClass(property: string, dcatClass: string): string {
  const field = fieldLabel(property)
  const type = classLabel(dcatClass)
  return field.toLowerCase() === type.toLowerCase() ? field : `${field} · ${type}`
}

/**
 * A short name for an object: its title, name, contact name or label, if one has visible
 * characters, cut to 200 characters. Render it in <bdi> so right-to-left overrides in it
 * cannot reorder the text around it.
 */
export function labelOf(object: CatalogObject): string {
  let label = labels.get(object)
  if (label === undefined) {
    // The first that has a visible character: one that is not a format character (\p{Cf}, such as a zero-width
    // space or a direction override), a separator (\p{Z}) or whitespace.
    const value = ['title', 'name', 'fn', 'prefLabel', 'label']
      .map((key) => object.properties[key])
      .find((text): text is string => typeof text === 'string' && /[^\p{Cf}\p{Z}\s]/u.test(text))
    // A cut that ends on the first half of a surrogate pair (\uD800-\uDBFF) drops it, so no half character shows.
    label =
      value === undefined
        ? `Untitled ${classLabel(object.dcatClass)}`
        : value.length > LABEL_LENGTH
          ? `${value.slice(0, LABEL_LENGTH).replace(/[\uD800-\uDBFF]$/, '')}…`
          : value
    labels.set(object, label)
  }
  return label
}

/**
 * A label inside a sentence, isolated (FSI … PDI) for text that can't use <bdi>, such as a notice built as one
 * string: a right-to-left override in the label then can't reverse the sentence around it.
 */
export const isolate = (label: string) => `\u2068${label}\u2069`

/** A count for people: `3,000`. */
export const count = (n: number) => n.toLocaleString('en-US')

/** One visible row of the tree, in the order the tree shows them (see {@link treeRows}). */
export interface TreeRow {
  /** Unique per row: the ids from the catalog down, so an object linked twice has a row in each place. */
  key: string
  object: CatalogObject
  /** The link property it is listed under; none for the catalog. */
  property?: string
  /** 1 for the catalog. */
  level: number
  /** Its place among its siblings, from 1, and their number (`aria-posinset`, `aria-setsize`). */
  position: number
  siblings: number
  /** Whether its children are shown; undefined when it has none to show. */
  expanded?: boolean
  /** How many children it shows when expanded. */
  childCount: number
}

/**
 * Each object's parents: `links` the other way round. Build it once per catalog; {@link ancestorIds} and
 * {@link filterTree} use it to find the objects above an object.
 *
 * @param catalog The catalog graph.
 * @returns A map from each linked object's id to the ids of the objects that link to it, in document order. The
 *   catalog, which nothing links to, has no entry.
 * @example parentsOf(catalog).get(distributionId) // [datasetId]
 */
export function parentsOf({ objects }: CatalogGraph): Map<string, string[]> {
  const parents = new Map<string, string[]>()
  for (const object of objects.values()) {
    for (const ids of Object.values(object.links)) {
      for (const id of ids) {
        const list = parents.get(id)
        if (list) list.push(object.id)
        else parents.set(id, [object.id])
      }
    }
  }
  return parents
}

/** The ids of an object's ancestors along its first parent, catalog first. */
export function ancestorIds(id: string, parents: Map<string, string[]>): string[] {
  const path: string[] = []
  for (
    let parent = parents.get(id)?.[0];
    parent !== undefined && parent !== id && !path.includes(parent); // stops where first parents loop
    parent = parents.get(parent)?.[0]
  ) {
    path.unshift(parent)
  }
  return path
}

/** Matches shown at most: thousands of rows take a few hundred milliseconds to add to the page (#23). */
export const FILTER_LIMIT = 200

/** The objects whose label contains `needle` (lower case), the first FILTER_LIMIT in document order, and every object above them. */
export function filterTree(catalog: CatalogGraph, parents: Map<string, string[]>, needle: string) {
  let matches = 0
  const shown = new Set<string>()
  const show = (id: string) => {
    if (shown.has(id)) return
    shown.add(id)
    for (const parent of parents.get(id) ?? []) show(parent)
  }
  for (const object of catalog.objects.values()) {
    if (labelOf(object).toLowerCase().includes(needle)) {
      if (++matches <= FILTER_LIMIT) show(object.id)
    }
  }
  return { matches, shown }
}

/**
 * The rows the tree shows: the catalog, then each expanded object's children in link order. While filtering, only
 * the `shown` objects, with every object above a match expanded. An object already above a row is not repeated
 * below it, so a cycle cannot recurse.
 */
export function treeRows(
  { objects, rootId }: CatalogGraph,
  expanded: ReadonlySet<string>,
  shown?: ReadonlySet<string>,
): TreeRow[] {
  const rows: TreeRow[] = []
  const path = new Set<string>()
  const add = (object: CatalogObject, key: string, level: number, position: number, siblings: number, property?: string) => {
    path.add(object.id)
    const children = Object.entries(object.links).flatMap(([link, ids]) =>
      ids.filter((id) => !path.has(id) && (!shown || shown.has(id))).map((id) => ({ link, id })),
    )
    const open = children.length > 0 && (shown !== undefined || expanded.has(object.id))
    rows.push({
      key,
      object,
      property,
      level,
      position,
      siblings,
      expanded: children.length > 0 ? open : undefined,
      childCount: children.length,
    })
    if (open) children.forEach(({ link, id }, i) =>
      add(objects.get(id)!, `${key} ${id}`, level + 1, i + 1, children.length, link),
    )
    path.delete(object.id)
  }
  add(objects.get(rootId)!, rootId, 1, 1, 1)
  return rows
}
