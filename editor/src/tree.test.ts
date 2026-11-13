import { describe, expect, it } from 'vitest'
import { decompose, type CatalogObject, type DecomposedCatalog } from './catalog/decompose'
import { FILTER_LIMIT, ancestorIds, filterTree, labelOf, parentsOf, treeRows, type TreeRow } from './tree'
import { largeCatalog } from '../fixtures/largeCatalog'

// Built once and shared: 3,000 datasets, each with a contact, a publisher and three distributions.
const big = decompose(JSON.stringify(largeCatalog()))
const bigParents = parentsOf(big)
const summary = (rows: TreeRow[]) => rows.map((row) => `${row.level} ${row.object.id}`)

describe('the tree of a 3,000-dataset catalog', () => {
  it('shows the catalog and its datasets, each closed, in order', () => {
    const rows = treeRows(big, new Set(['#']))
    expect(rows).toHaveLength(3_001)
    expect(rows[0]).toMatchObject({ key: '#', level: 1, position: 1, siblings: 1, expanded: true, property: undefined })
    expect(rows[3_000]).toMatchObject({ level: 2, position: 3_000, siblings: 3_000, expanded: false, property: 'dataset' })
    expect(rows.slice(1).map((row) => row.object.id)).toEqual(Array.from({ length: 3_000 }, (_, i) => `#/dataset/${i}`))
  })

  it('shows nothing below a closed catalog', () => {
    expect(treeRows(big, new Set())).toMatchObject([{ key: '#', expanded: false }])
  })

  it("expands an object to its children in link order, under the property that links them", () => {
    const rows = treeRows(big, new Set(['#', '#/dataset/7']))
    const at = rows.findIndex((row) => row.object.id === '#/dataset/7')
    expect(rows[at].expanded).toBe(true)
    expect(rows.slice(at + 1, at + 6).map((row) => [row.property, row.object.id, row.level, row.position])).toEqual([
      ['contactPoint', '#/dataset/7/contactPoint', 3, 1],
      ['publisher', '#/dataset/7/publisher', 3, 2],
      ['distribution', '#/dataset/7/distribution/0', 3, 3],
      ['distribution', '#/dataset/7/distribution/1', 3, 4],
      ['distribution', '#/dataset/7/distribution/2', 3, 5],
    ])
    expect(rows[at + 1].expanded).toBeUndefined() // no children
    expect(rows[at + 6].object.id).toBe('#/dataset/8')
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })

  it('finds the objects above any object', () => {
    expect(ancestorIds('#/dataset/2999/distribution/2', bigParents)).toEqual(['#', '#/dataset/2999'])
    expect(ancestorIds('#', bigParents)).toEqual([])
  })

  it('filters by title or name, showing each match with the objects above it', () => {
    const found = filterTree(big, bigParents, 'water use 2995')
    expect(found.matches).toBe(1)
    // Closed objects above a match open while filtering.
    expect(summary(treeRows(big, new Set(), found.shown))).toEqual(['1 #', '2 #/dataset/2995'])

    const contacts = filterTree(big, bigParents, 'data team 49')
    expect(contacts.matches).toBe(60) // every 50th dataset's contact
    expect(summary(treeRows(big, new Set(), contacts.shown)).slice(0, 5)).toEqual([
      '1 #',
      '2 #/dataset/49',
      '3 #/dataset/49/contactPoint',
      '2 #/dataset/99',
      '3 #/dataset/99/contactPoint',
    ])
  })

  it('shows the first matches only when thousands match, and still counts them all', () => {
    const found = filterTree(big, bigParents, 'json download')
    expect(found.matches).toBe(3_000)
    const rows = treeRows(big, new Set(), found.shown)
    const matches = rows.filter((row) => labelOf(row.object) === 'JSON download')
    expect(matches).toHaveLength(FILTER_LIMIT)
    expect(rows).toHaveLength(1 + FILTER_LIMIT * 2) // the catalog, and each match under its dataset
  })

  it('matches no object for text no label holds', () => {
    expect(filterTree(big, bigParents, 'no such thing')).toEqual({ matches: 0, shown: new Set() })
  })
})

describe('an object linked from more than one place', () => {
  const object = (id: string, dcatClass: string, title: string, links: Record<string, string[]> = {}): CatalogObject => ({
    id,
    dcatClass,
    properties: { title },
    links,
    singleLinks: [],
  })
  // Decompose never links one object twice; editing (#25) will. A cycle must not recurse either.
  const shared: DecomposedCatalog = {
    rootId: '#',
    objects: new Map(
      [
        object('#', 'Catalog', 'Catalog', { dataset: ['#/dataset/0', '#/dataset/1'] }),
        object('#/dataset/0', 'Dataset', 'First', { contactPoint: ['#/contact'] }),
        object('#/dataset/1', 'Dataset', 'Second', { contactPoint: ['#/contact'] }),
        object('#/contact', 'Kind', 'Shared contact', { hasPart: ['#/dataset/0'] }),
      ].map((o) => [o.id, o]),
    ),
  }

  it('shows the same object in each place, each with its own row', () => {
    const rows = treeRows(shared, new Set(['#', '#/dataset/0', '#/dataset/1']))
    const contacts = rows.filter((row) => row.object.id === '#/contact')
    expect(contacts.map((row) => row.key)).toEqual(['# #/dataset/0 #/contact', '# #/dataset/1 #/contact'])
    expect(contacts[0].object).toBe(contacts[1].object)
    expect(filterTree(shared, parentsOf(shared), 'shared').shown).toEqual(
      new Set(['#/contact', '#/dataset/0', '#/dataset/1', '#']),
    )
  })

  it('does not repeat an object below itself', () => {
    const rows = treeRows(shared, new Set(['#', '#/dataset/0', '#/dataset/1', '#/contact']))
    expect(summary(rows)).toEqual([
      '1 #',
      '2 #/dataset/0',
      '3 #/contact', // links back to dataset 0, which is above it
      '2 #/dataset/1',
      '3 #/contact',
      '4 #/dataset/0',
    ])
    expect(rows[2].expanded).toBeUndefined()
  })
})
