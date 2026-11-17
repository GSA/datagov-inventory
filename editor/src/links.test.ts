import { describe, expect, it } from 'vitest'
import type { CatalogObject, CatalogGraph } from './catalog/types'
import { classSchemas, getClassProperties } from './schema'
import {
  CATALOG_MEMBERS,
  CREATE_ONLY_CLASSES,
  CREATE_ONLY_FIELDS,
  PICK_LIMIT,
  candidatesFor,
  copyFor,
  createLinked,
  linkModeOf,
  linkObject,
  linkersOf,
  search,
  usesOf,
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

/** A catalog with two datasets that share one contact, which has its own address. */
const shared = () =>
  catalogOf(
    object('#', 'Catalog', { title: 'Catalog' }, { dataset: ['#/dataset/0', '#/dataset/1'] }),
    object('#/dataset/0', 'Dataset', { title: 'Water' }, { contactPoint: ['#/dataset/0/contactPoint/0'] }),
    object('#/dataset/1', 'Dataset', { title: 'Air' }, { contactPoint: ['#/dataset/0/contactPoint/0'] }),
    object('#/dataset/0/contactPoint/0', 'Kind', { fn: 'Help desk' }, { address: ['#/dataset/0/contactPoint/0/address/0'] }),
    object('#/dataset/0/contactPoint/0/address/0', 'Address', { locality: 'Springfield' }),
  )

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

describe('usesOf', () => {
  it('lists every place an object is used, with the field', () => {
    const uses = usesOf(shared())
    expect(uses.get('#/dataset/0/contactPoint/0')).toEqual([
      { parentId: '#/dataset/0', property: 'contactPoint' },
      { parentId: '#/dataset/1', property: 'contactPoint' },
    ])
    expect(uses.get('#')).toBeUndefined()
  })

  it('is built once per version of the catalog', () => {
    const catalog = shared()
    expect(usesOf(catalog)).toBe(usesOf({ ...catalog }))
    expect(usesOf(linkObject(catalog, '#', 'contactPoint', '#/dataset/0/contactPoint/0'))).not.toBe(usesOf(catalog))
  })

  it('counts only places in the catalog, not objects removed from their field', () => {
    const catalog = catalogOf(
      object('#', 'Catalog', {}, { dataset: ['#/d1'] }),
      object('#/d1', 'Dataset', {}, { publisher: ['#/o'] }),
      object('#/d5', 'Dataset', {}, { publisher: ['#/o'] }), // removed from the catalog, kept for Undo
      object('#/o', 'Organization'),
    )
    expect(usesOf(catalog).get('#/o')).toEqual([{ parentId: '#/d1', property: 'publisher' }])
    expect(usesOf(catalog).get('#/d5')).toBeUndefined()
  })

  it('still finds loops through removed objects', () => {
    const catalog = catalogOf(
      object('#', 'Catalog', {}, { dataset: ['#/d'] }),
      object('#/d', 'Dataset', {}, { publisher: ['#/o'] }),
      object('#/o', 'Organization'),
      object('#/parent', 'Organization', {}, { subOrganizationOf: ['#/o'] }), // removed
    )
    expect(linkersOf('#/o', catalog).has('#/parent')).toBe(true)
    expect(() => linkObject(catalog, '#/o', 'subOrganizationOf', '#/parent')).toThrow(/loop/)
  })
})

describe('linkersOf', () => {
  it('finds the object and everything above it, and stops at loops', () => {
    const catalog = catalogOf(
      object('#', 'Catalog', {}, { hasPart: ['#/a'] }),
      object('#/a', 'Catalog', {}, { hasPart: ['#/b'] }),
      object('#/b', 'Catalog', {}, { hasPart: ['#/a'] }),
    )
    expect(linkersOf('#/b', catalog)).toEqual(new Set(['#/b', '#/a', '#']))
  })
})

describe('candidatesFor', () => {
  it('offers objects of the allowed classes A to Z, with Organizations where Agents are allowed', () => {
    const catalog = catalogOf(
      object('#', 'Catalog', {}, { dataset: ['#/d'] }),
      object('#/d', 'Dataset'),
      object('#/o2', 'Organization', { name: 'Office 10' }),
      object('#/o1', 'Organization', { name: 'office 9' }),
      object('#/a', 'Agent', { name: 'Agent' }),
      object('#/k', 'Kind', { fn: 'A contact' }),
    )
    const labels = (list: CatalogObject[]) => list.map((o) => o.id)
    expect(labels(candidatesFor(catalog, catalog.objects.get('#/d')!, 'publisher', ['Agent']))).toEqual(['#/a', '#/o1', '#/o2'])
    expect(labels(candidatesFor(catalog, catalog.objects.get('#/d')!, 'rightsHolder', ['Organization']))).toEqual(['#/o1', '#/o2'])
  })

  it('leaves out the object itself, what the field holds, and what is above it', () => {
    const catalog = catalogOf(
      object('#', 'Catalog', {}, { hasPart: ['#/a', '#/c'] }),
      object('#/a', 'Catalog', {}, { hasPart: ['#/b'] }),
      object('#/b', 'Catalog'),
      object('#/c', 'Catalog'),
      object('#/d', 'Catalog'),
    )
    const offered = candidatesFor(catalog, catalog.objects.get('#/b')!, 'hasPart', ['Catalog']).map((o) => o.id)
    expect(offered).toEqual(['#/c', '#/d'])
    expect(candidatesFor(catalog, catalog.objects.get('#')!, 'hasPart', ['Catalog']).map((o) => o.id)).toEqual(['#/b', '#/d'])
  })
})

describe('search', () => {
  const pool = Array.from({ length: 30 }, (_, i) => object(`#/k/${i}`, 'Kind', { fn: `Contact ${i}` }))

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

describe('linkObject', () => {
  it('adds the same object, so both parents show it', () => {
    const catalog = linkObject(shared(), '#', 'contactPoint', '#/dataset/0/contactPoint/0')
    expect(catalog.objects.get('#')!.links.contactPoint).toEqual(['#/dataset/0/contactPoint/0'])
    expect(usesOf(catalog).get('#/dataset/0/contactPoint/0')).toHaveLength(3)
    expect(catalog.objects.size).toBe(shared().objects.size)
  })

  it('writes a single field back as one object', () => {
    const catalog = linkObject(shared(), '#', 'publisher', '#/dataset/0/contactPoint/0', true)
    expect(catalog.objects.get('#')!.singleLinks).toEqual(['publisher'])
    expect(() => linkObject(catalog, '#', 'publisher', '#/dataset/0', true)).toThrow(/holds one/)
  })

  it('refuses a loop and ignores a link that is already there', () => {
    const catalog = shared()
    expect(() => linkObject(catalog, '#/dataset/0', 'x', '#')).toThrow(/loop/)
    expect(() => linkObject(catalog, '#/dataset/0', 'x', '#/dataset/0')).toThrow(/loop/)
    expect(linkObject(catalog, '#/dataset/0', 'contactPoint', '#/dataset/0/contactPoint/0')).toBe(catalog)
  })
})

describe('createLinked', () => {
  it('creates a blank object with an address under its parent, and links it', () => {
    const { catalog, id } = createLinked(shared(), '#/dataset/0', 'contactPoint', 'Kind')
    expect(id).toBe('#/dataset/0/contactPoint/1')
    expect(catalog.objects.get(id)).toEqual(object(id, 'Kind', { '@type': 'Kind' }))
    expect(catalog.objects.get('#/dataset/0')!.links.contactPoint).toEqual(['#/dataset/0/contactPoint/0', id])
  })

  it('skips ids that are taken, and starts a field that was empty', () => {
    const start = shared()
    start.objects.set('#/dataset/1/contactPoint/1', object('#/dataset/1/contactPoint/1', 'Kind'))
    expect(createLinked(start, '#/dataset/1', 'contactPoint', 'Kind').id).toBe('#/dataset/1/contactPoint/2')
    const { catalog, id } = createLinked(start, '#', 'publisher', 'Organization', true)
    expect(id).toBe('#/publisher/0')
    expect(catalog.objects.get('#')!.singleLinks).toEqual(['publisher'])
  })

  it('turns a list field read as one object into a list at two, and an empty list as written gives way to the links', () => {
    const start = catalogOf(
      object('#', 'Catalog', {}, { dataset: ['#/d'] }),
      { ...object('#/d', 'Dataset', { sample: [] }, { distribution: ['#/d/distribution'] }), singleLinks: ['distribution'] },
      object('#/d/distribution', 'Distribution', { title: 'one' }),
    )
    const { catalog } = createLinked(start, '#/d', 'distribution', 'Distribution')
    expect(catalog.objects.get('#/d')!.singleLinks).toEqual([])
    const withSample = createLinked(catalog, '#/d', 'sample', 'Distribution').catalog
    expect(withSample.objects.get('#/d')!.properties).toEqual({})
    expect(withSample.objects.get('#/d')!.links.sample).toHaveLength(1)
  })
})

describe('copyFor', () => {
  it('copies a shared object and what only it uses, for one place only', () => {
    const before = shared()
    const { catalog, id } = copyFor(before, '#/dataset/1', 'contactPoint', '#/dataset/0/contactPoint/0')
    expect(id).toBe('#/dataset/1/contactPoint/1')
    expect(catalog.objects.get('#/dataset/1')!.links.contactPoint).toEqual([id])
    expect(catalog.objects.get('#/dataset/0')!.links.contactPoint).toEqual(['#/dataset/0/contactPoint/0'])

    const copy = catalog.objects.get(id)!
    expect(copy.properties).toEqual({ fn: 'Help desk' })
    expect(copy.links.address).toEqual([`${id}/address/0`])
    expect(catalog.objects.get(`${id}/address/0`)!.properties).toEqual({ locality: 'Springfield' })
    expect(usesOf(catalog).get('#/dataset/0/contactPoint/0')).toHaveLength(1)
    // The original catalog is unchanged.
    expect(before.objects.size).toBe(5)
  })

  it('leaves the @id out of the copies, so they are not the same node as the originals', () => {
    const start = shared()
    const contact = start.objects.get('#/dataset/0/contactPoint/0')!
    start.objects.set(contact.id, { ...contact, properties: { '@id': 'https://example.gov/help', fn: 'Help desk' } })
    const { catalog, id } = copyFor(start, '#/dataset/1', 'contactPoint', contact.id)
    expect(catalog.objects.get(id)!.properties).toEqual({ fn: 'Help desk' })
    expect(catalog.objects.get(contact.id)!.properties['@id']).toBe('https://example.gov/help')
  })

  it('keeps links to objects shared with others', () => {
    const start = linkObject(shared(), '#', 'contactPoint', '#/dataset/0/contactPoint/0/address/0')
    const { catalog, id } = copyFor(start, '#/dataset/1', 'contactPoint', '#/dataset/0/contactPoint/0')
    expect(catalog.objects.get(id)!.links.address).toEqual(['#/dataset/0/contactPoint/0/address/0'])
  })

  it('copies a loop inside the object as a loop', () => {
    const start = catalogOf(
      object('#', 'Catalog', {}, { hasPart: ['#/a'], catalog: ['#/a'] }),
      object('#/a', 'Catalog', {}, { hasPart: ['#/a/b'] }),
      object('#/a/b', 'Catalog', {}, { hasPart: ['#/a'] }),
    )
    const { catalog, id } = copyFor(start, '#', 'catalog', '#/a')
    const inner = catalog.objects.get(id)!.links.hasPart[0]
    expect(inner).toBe(`${id}/hasPart/0`)
    expect(catalog.objects.get(inner)!.links.hasPart).toEqual([id])
  })

  it('refuses an object that is not in the field', () => {
    expect(() => copyFor(shared(), '#', 'contactPoint', '#/dataset/0')).toThrow(/not in/)
  })
})
