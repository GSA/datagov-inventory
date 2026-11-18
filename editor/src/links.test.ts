import { describe, expect, it } from 'vitest'
import type { CatalogObject, CatalogGraph } from './catalog/types'
import { classSchemas, getClassProperties } from './schema'
import {
  CATALOG_MEMBERS,
  CREATE_ONLY_CLASSES,
  CREATE_ONLY_FIELDS,
  PICK_LIMIT,
  candidatesFor,
  linkModeOf,
  search,
} from './links'

const object = (id: string, dcatClass: string, properties: Record<string, unknown> = {}, links: Record<string, string[]> = {}): CatalogObject => ({
  id,
  dcatClass,
  properties,
  links,
  singleLinks: [],
})
const catalogOf = (...objects: CatalogObject[]): CatalogGraph => ({
  rootId: objects[0].id,
  objects: new Map(objects.map((o) => [o.id, o])),
})
const ids = (...values: string[]) => {
  let index = 0
  return () => values[index++]
}
const UUID_1 = '00000000-0000-4000-8000-000000000001'
const UUID_2 = '00000000-0000-4000-8000-000000000002'

describe('linkModeOf', () => {
  it('offers only Create new for objects that belong to their parent', () => {
    expect(linkModeOf('Catalog', 'dataset', ['Dataset'])).toBe('create')
    expect(linkModeOf('Dataset', 'distribution', ['Distribution'])).toBe('create')
    expect(linkModeOf('Dataset', 'temporal', ['PeriodOfTime'])).toBe('create')
  })

  it('offers only Add an existing for the catalog\'s own datasets, series and services elsewhere', () => {
    expect(linkModeOf('Dataset', 'inSeries', ['DatasetSeries'])).toBe('select')
    expect(linkModeOf('Distribution', 'accessService', ['DataService'])).toBe('select')
  })

  it('offers both for objects worth sharing', () => {
    expect(linkModeOf('Dataset', 'contactPoint', ['Kind'])).toBe('both')
    expect(linkModeOf('Catalog', 'publisher', ['Agent', 'Organization'])).toBe('both')
  })

  it('names only classes and properties the schema has', () => {
    for (const name of [...CREATE_ONLY_CLASSES, ...CATALOG_MEMBERS]) expect(classSchemas.has(name), name).toBe(true)
    for (const field of CREATE_ONLY_FIELDS) {
      const [cls, prop] = field.split('.')
      expect(getClassProperties(cls).get(prop)?.length, field).toBeGreaterThan(0)
    }
  })
})

describe('candidatesFor', () => {
  it('offers objects of the allowed classes A to Z, with Organizations where Agents are allowed', () => {
    const catalog = catalogOf(
      object('catalog-root', 'Catalog', {}, { dataset: ['catalog-d'] }),
      object('catalog-d', 'Dataset'),
      object('organization-ten', 'Organization', { name: 'Office 10' }),
      object('organization-nine', 'Organization', { name: 'office 9' }),
      object('catalog-a', 'Agent', { name: 'Agent' }),
      object('contact', 'Kind', { fn: 'A contact' }),
    )
    const labels = (list: CatalogObject[]) => list.map((o) => o.id)
    expect(labels(candidatesFor(catalog, catalog.objects.get('catalog-d')!, 'publisher', ['Agent']))).toEqual(['catalog-a', 'organization-nine', 'organization-ten'])
    expect(labels(candidatesFor(catalog, catalog.objects.get('catalog-d')!, 'rightsHolder', ['Organization']))).toEqual(['organization-nine', 'organization-ten'])
  })

  it('leaves out the object itself, what the field holds, and what is above it', () => {
    const catalog = catalogOf(
      object('catalog-root', 'Catalog', {}, { hasPart: ['catalog-a', 'catalog-c'] }),
      object('catalog-a', 'Catalog', {}, { hasPart: ['catalog-b'] }),
      object('catalog-b', 'Catalog'),
      object('catalog-c', 'Catalog'),
      object('catalog-d', 'Catalog'),
    )
    const offered = candidatesFor(catalog, catalog.objects.get('catalog-b')!, 'hasPart', ['Catalog']).map((o) => o.id)
    expect(offered).toEqual(['catalog-c', 'catalog-d'])
    expect(candidatesFor(catalog, catalog.objects.get('catalog-root')!, 'hasPart', ['Catalog']).map((o) => o.id)).toEqual(['catalog-b', 'catalog-d'])
  })
})

describe('search', () => {
  const pool = Array.from({ length: 30 }, (_, i) => object(`contact-${i}`, 'Kind', { fn: `Contact ${i}` }))

  it('shows the first matches and counts them all', () => {
    expect(search(pool, '')).toMatchObject({ total: 30 })
    expect(search(pool, '').items).toHaveLength(PICK_LIMIT)
    const { items, total } = search(pool, ' CONTACT 2')
    expect(total).toBe(12) // 2, 12 and 20-29
    expect(items.map((o) => o.properties.fn)[0]).toBe('Contact 2')
  })

  it('matches every word, in any order', () => {
    expect(search(pool, '1 contact').total).toBe(12)
    expect(search(pool, 'contact 2 1').items.map((o) => o.properties.fn)).toEqual(['Contact 12', 'Contact 21'])
    expect(search(pool, 'contact x').total).toBe(0)
  })
})
