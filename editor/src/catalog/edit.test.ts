import { describe, it, expect } from 'vitest'
import type { CatalogObject, CatalogGraph } from './types'
import { removeLink, deleteObject, undoRemoval, findParentLinks, updateObject, copyFor, createLinked, linkObject } from './edit'
import { usesOf } from './uses'

const createObject = (
  id: string,
  dcatClass: string,
  properties: Record<string, unknown> = {},
  links: Record<string, string[]> = {},
): CatalogObject => ({
  id,
  dcatClass,
  properties,
  links,
  singleLinks: [],
})

const createCatalog = (objects: CatalogObject[]): CatalogGraph => ({
  rootId: objects[0].id,
  objects: new Map(objects.map(obj => [obj.id, obj])),
})

describe('updateObject', () => {
  it('updates properties without mutating the input graph', () => {
    const catalog = createCatalog([createObject('#', 'Catalog', { title: 'Before', description: 'Kept' })])

    const result = updateObject(catalog, '#', { properties: { title: 'After' } })

    expect(result.objects.get('#')?.properties).toEqual({ title: 'After', description: 'Kept' })
    expect(catalog.objects.get('#')?.properties.title).toBe('Before')
  })
})

describe('removeLink', () => {
  it('removes a link from parent property array', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', { title: 'Test' }, {
        dataset: ['#/dataset/0', '#/dataset/1']
      }),
      createObject('#/dataset/0', 'Dataset', { title: 'Dataset 0' }),
      createObject('#/dataset/1', 'Dataset', { title: 'Dataset 1' }),
    ])

    const result = removeLink(catalog, '#', 'dataset', '#/dataset/0')

    expect(result.catalog.objects.get('#')?.links.dataset).toEqual(['#/dataset/1'])
    expect(result.catalog.objects.has('#/dataset/0')).toBe(true)
  })

  it('removes property entirely when removing last link', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0'] }),
      createObject('#/dataset/0', 'Dataset', { title: 'Dataset 0' }),
    ])

    const result = removeLink(catalog, '#', 'dataset', '#/dataset/0')

    expect(result.catalog.objects.get('#')?.links.dataset).toBeUndefined()
  })

  it('preserves singleLinks when removing from array', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0', '#/dataset/1'] }),
      createObject('#/dataset/0', 'Dataset', { title: 'Dataset 0' }),
      createObject('#/dataset/1', 'Dataset', { title: 'Dataset 1' }),
    ])
    catalog.objects.get('#')!.singleLinks = ['publisher']

    const result = removeLink(catalog, '#', 'dataset', '#/dataset/0')

    expect(result.catalog.objects.get('#')?.singleLinks).toEqual(['publisher'])
  })

  it('removes property from singleLinks when removing last link', () => {
    const parent = createObject('#/dataset/0', 'Dataset', {}, { publisher: ['#/org/0'] })
    parent.singleLinks = ['publisher']
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0'] }),
      parent,
      createObject('#/org/0', 'Organization', { name: 'Org' }),
    ])

    const result = removeLink(catalog, '#/dataset/0', 'publisher', '#/org/0')

    expect(result.catalog.objects.get('#/dataset/0')?.singleLinks).toEqual([])
  })

  it('returns removal record for undo', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0', '#/dataset/1'] }),
      createObject('#/dataset/0', 'Dataset', { title: 'Dataset 0' }),
      createObject('#/dataset/1', 'Dataset', { title: 'Dataset 1' }),
    ])

    const { undoRecord } = removeLink(catalog, '#', 'dataset', '#/dataset/0')

    expect(undoRecord).toMatchObject({
      type: 'link',
      parentId: '#',
      property: 'dataset',
      childId: '#/dataset/0',
      position: 0,
    })
  })
})

describe('deleteObject', () => {
  it('removes object from catalog', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0'] }),
      createObject('#/dataset/0', 'Dataset', { title: 'Dataset 0' }),
    ])

    const result = deleteObject(catalog, '#/dataset/0')

    expect(result.catalog.objects.has('#/dataset/0')).toBe(false)
  })

  it('removes all links to object from all parents', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0', '#/dataset/1'] }),
      createObject('#/dataset/0', 'Dataset', { title: 'First' }, {
        contactPoint: ['#/contact']
      }),
      createObject('#/dataset/1', 'Dataset', { title: 'Second' }, {
        contactPoint: ['#/contact']
      }),
      createObject('#/contact', 'Kind', { fn: 'Shared Contact' }),
    ])

    const result = deleteObject(catalog, '#/contact')

    expect(result.catalog.objects.has('#/contact')).toBe(false)
    expect(result.catalog.objects.get('#/dataset/0')?.links.contactPoint).toBeUndefined()
    expect(result.catalog.objects.get('#/dataset/1')?.links.contactPoint).toBeUndefined()
  })

  it('recursively deletes child objects when parent deleted', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0'] }),
      createObject('#/dataset/0', 'Dataset', { title: 'Dataset' }, {
        distribution: ['#/dataset/0/distribution/0', '#/dataset/0/distribution/1']
      }),
      createObject('#/dataset/0/distribution/0', 'Distribution', { title: 'Dist 0' }),
      createObject('#/dataset/0/distribution/1', 'Distribution', { title: 'Dist 1' }),
    ])

    const result = deleteObject(catalog, '#/dataset/0')

    expect(result.catalog.objects.has('#/dataset/0')).toBe(false)
    expect(result.catalog.objects.has('#/dataset/0/distribution/0')).toBe(false)
    expect(result.catalog.objects.has('#/dataset/0/distribution/1')).toBe(false)
  })

  it('does not delete shared child objects', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0', '#/dataset/1'] }),
      createObject('#/dataset/0', 'Dataset', {}, { publisher: ['#/org'] }),
      createObject('#/dataset/1', 'Dataset', {}, { publisher: ['#/org'] }),
      createObject('#/org', 'Organization', { name: 'Shared Org' }),
    ])

    const result = deleteObject(catalog, '#/dataset/0')

    expect(result.catalog.objects.has('#/dataset/0')).toBe(false)
    expect(result.catalog.objects.has('#/org')).toBe(true)
    expect(result.catalog.objects.get('#/dataset/1')?.links.publisher).toEqual(['#/org'])
  })

  it('returns undo record with object data and all parent links', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0', '#/dataset/1'] }),
      createObject('#/dataset/0', 'Dataset', { title: 'First' }, {
        contactPoint: ['#/contact']
      }),
      createObject('#/dataset/1', 'Dataset', { title: 'Second' }, {
        contactPoint: ['#/contact']
      }),
      createObject('#/contact', 'Kind', { fn: 'Shared Contact' }),
    ])

    const { undoRecord } = deleteObject(catalog, '#/contact')

    expect(undoRecord.type).toBe('object')
    expect(undoRecord.object).toMatchObject({
      id: '#/contact',
      dcatClass: 'Kind',
      properties: { fn: 'Shared Contact' },
    })
    expect(undoRecord.parentLinks).toEqual([
      { parentId: '#/dataset/0', property: 'contactPoint', position: 0 },
      { parentId: '#/dataset/1', property: 'contactPoint', position: 0 },
    ])
  })
})

describe('undoRemoval', () => {
  it('restores removed link to parent at original position', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/1'] }),
      createObject('#/dataset/0', 'Dataset', { title: 'Dataset 0' }),
      createObject('#/dataset/1', 'Dataset', { title: 'Dataset 1' }),
    ])

    const undoRecord = {
      type: 'link' as const,
      parentId: '#',
      property: 'dataset',
      childId: '#/dataset/0',
      position: 0,
      wasSingleLink: false,
    }

    const result = undoRemoval(catalog, undoRecord)

    expect(result.objects.get('#')?.links.dataset).toEqual([
      '#/dataset/0',
      '#/dataset/1'
    ])
  })

  it('restores singleLinks when undoing single-link removal', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0'] }),
      createObject('#/dataset/0', 'Dataset', {}, {}),
      createObject('#/org/0', 'Organization', { name: 'Org' }),
    ])

    const undoRecord = {
      type: 'link' as const,
      parentId: '#/dataset/0',
      property: 'publisher',
      childId: '#/org/0',
      position: 0,
      wasSingleLink: true,
    }

    const result = undoRemoval(catalog, undoRecord)

    expect(result.objects.get('#/dataset/0')?.links.publisher).toEqual(['#/org/0'])
    expect(result.objects.get('#/dataset/0')?.singleLinks).toContain('publisher')
  })

  it('restores deleted object and all parent links', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0', '#/dataset/1'] }),
      createObject('#/dataset/0', 'Dataset', {}, { contactPoint: [] }),
      createObject('#/dataset/1', 'Dataset', {}, { contactPoint: [] }),
    ])

    const undoRecord = {
      type: 'object' as const,
      object: createObject('#/contact', 'Kind', { fn: 'Shared Contact' }),
      children: [],
      parentLinks: [
        { parentId: '#/dataset/0', property: 'contactPoint', position: 0 },
        { parentId: '#/dataset/1', property: 'contactPoint', position: 0 },
      ],
    }

    const result = undoRemoval(catalog, undoRecord)

    expect(result.objects.has('#/contact')).toBe(true)
    expect(result.objects.get('#/contact')).toMatchObject({
      id: '#/contact',
      dcatClass: 'Kind',
      properties: { fn: 'Shared Contact' },
    })
    expect(result.objects.get('#/dataset/0')?.links.contactPoint).toEqual(['#/contact'])
    expect(result.objects.get('#/dataset/1')?.links.contactPoint).toEqual(['#/contact'])
  })

  it('restores deleted object with its children', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: [] }),
    ])

    const deletedDataset = createObject('#/dataset/0', 'Dataset', { title: 'Dataset' }, {
      distribution: ['#/dataset/0/distribution/0']
    })
    const deletedDist = createObject('#/dataset/0/distribution/0', 'Distribution', { title: 'Dist' })

    const undoRecord = {
      type: 'object' as const,
      object: deletedDataset,
      children: [deletedDist],
      parentLinks: [
        { parentId: '#', property: 'dataset', position: 0 },
      ],
    }

    const result = undoRemoval(catalog, undoRecord)

    expect(result.objects.has('#/dataset/0')).toBe(true)
    expect(result.objects.has('#/dataset/0/distribution/0')).toBe(true)
    expect(result.objects.get('#')?.links.dataset).toEqual(['#/dataset/0'])
  })
})

describe('findParentLinks', () => {
  it('finds all parent objects linking to target', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0', '#/dataset/1'] }),
      createObject('#/dataset/0', 'Dataset', {}, { contactPoint: ['#/contact'] }),
      createObject('#/dataset/1', 'Dataset', {}, { contactPoint: ['#/contact'] }),
      createObject('#/contact', 'Kind', { fn: 'Contact' }),
    ])

    const parents = findParentLinks(catalog, '#/contact')

    expect(parents).toEqual([
      { parentId: '#/dataset/0', property: 'contactPoint', position: 0 },
      { parentId: '#/dataset/1', property: 'contactPoint', position: 0 },
    ])
  })

  it('returns empty array for unlinked object', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, { dataset: ['#/dataset/0'] }),
      createObject('#/dataset/0', 'Dataset', {}, {}),
      createObject('#/orphan', 'Kind', { fn: 'Orphan' }),
    ])

    const parents = findParentLinks(catalog, '#/orphan')

    expect(parents).toEqual([])
  })

  it('finds multiple links from same parent', () => {
    const catalog = createCatalog([
      createObject('#', 'Catalog', {}, {
        dataset: ['#/dataset/0'],
        service: ['#/dataset/0']
      }),
      createObject('#/dataset/0', 'Dataset', { title: 'Dataset' }),
    ])

    const parents = findParentLinks(catalog, '#/dataset/0')

    expect(parents).toHaveLength(2)
    expect(parents).toContainEqual({ parentId: '#', property: 'dataset', position: 0 })
    expect(parents).toContainEqual({ parentId: '#', property: 'service', position: 0 })
  })
})

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
