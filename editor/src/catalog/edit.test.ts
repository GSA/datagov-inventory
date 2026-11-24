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
const uuids = (...values: string[]) => {
  let index = 0
  return () => values[index++]
}
const UUID_1 = '00000000-0000-4000-8000-000000000001'
const UUID_2 = '00000000-0000-4000-8000-000000000002'

describe('updateObject', () => {
  it('updates properties without mutating the input graph', () => {
    const catalog = createCatalog([createObject('catalog-root', 'Catalog', { title: 'Before', description: 'Kept' })])

    const result = updateObject(catalog, 'catalog-root', { properties: { title: 'After' } })

    expect(result.objects.get('catalog-root')?.properties).toEqual({ title: 'After', description: 'Kept' })
    expect(catalog.objects.get('catalog-root')?.properties.title).toBe('Before')
  })

  it('returns the same graph when the values are already there', () => {
    const catalog = createCatalog([createObject('catalog-root', 'Catalog', { title: 'Same' })])

    expect(updateObject(catalog, 'catalog-root', { properties: { title: 'Same' } })).toBe(catalog)
    expect(updateObject(catalog, 'catalog-root', { properties: { title: 'Other' } })).not.toBe(catalog)
  })
})

describe('removeLink', () => {
  it('removes a link from parent property array', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', { title: 'Test' }, {
        dataset: ['dataset-zero', 'dataset-one']
      }),
      createObject('dataset-zero', 'Dataset', { title: 'Dataset 0' }),
      createObject('dataset-one', 'Dataset', { title: 'Dataset 1' }),
    ])

    const result = removeLink(catalog, 'catalog-root', 'dataset', 'dataset-zero')

    expect(result.catalog.objects.get('catalog-root')?.links.dataset).toEqual(['dataset-one'])
    expect(result.catalog.objects.has('dataset-zero')).toBe(true)
  })

  it('removes property entirely when removing last link', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero'] }),
      createObject('dataset-zero', 'Dataset', { title: 'Dataset 0' }),
    ])

    const result = removeLink(catalog, 'catalog-root', 'dataset', 'dataset-zero')

    expect(result.catalog.objects.get('catalog-root')?.links.dataset).toBeUndefined()
  })

  it('preserves singleLinks when removing from array', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero', 'dataset-one'] }),
      createObject('dataset-zero', 'Dataset', { title: 'Dataset 0' }),
      createObject('dataset-one', 'Dataset', { title: 'Dataset 1' }),
    ])
    catalog.objects.get('catalog-root')!.singleLinks = ['publisher']

    const result = removeLink(catalog, 'catalog-root', 'dataset', 'dataset-zero')

    expect(result.catalog.objects.get('catalog-root')?.singleLinks).toEqual(['publisher'])
  })

  it('removes property from singleLinks when removing last link', () => {
    const parent = createObject('dataset-zero', 'Dataset', {}, { publisher: ['organization-zero'] })
    parent.singleLinks = ['publisher']
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero'] }),
      parent,
      createObject('organization-zero', 'Organization', { name: 'Org' }),
    ])

    const result = removeLink(catalog, 'dataset-zero', 'publisher', 'organization-zero')

    expect(result.catalog.objects.get('dataset-zero')?.singleLinks).toEqual([])
  })

  it('returns removal record for undo', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero', 'dataset-one'] }),
      createObject('dataset-zero', 'Dataset', { title: 'Dataset 0' }),
      createObject('dataset-one', 'Dataset', { title: 'Dataset 1' }),
    ])

    const { undoRecord } = removeLink(catalog, 'catalog-root', 'dataset', 'dataset-zero')

    expect(undoRecord).toMatchObject({
      type: 'link',
      parentId: 'catalog-root',
      property: 'dataset',
      childId: 'dataset-zero',
      position: 0,
    })
  })
})

describe('deleteObject', () => {
  it('removes object from catalog', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero'] }),
      createObject('dataset-zero', 'Dataset', { title: 'Dataset 0' }),
    ])

    const result = deleteObject(catalog, 'dataset-zero')

    expect(result.catalog.objects.has('dataset-zero')).toBe(false)
  })

  it('removes all links to object from all parents', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero', 'dataset-one'] }),
      createObject('dataset-zero', 'Dataset', { title: 'First' }, {
        contactPoint: ['shared-contact']
      }),
      createObject('dataset-one', 'Dataset', { title: 'Second' }, {
        contactPoint: ['shared-contact']
      }),
      createObject('shared-contact', 'Kind', { fn: 'Shared Contact' }),
    ])

    const result = deleteObject(catalog, 'shared-contact')

    expect(result.catalog.objects.has('shared-contact')).toBe(false)
    expect(result.catalog.objects.get('dataset-zero')?.links.contactPoint).toBeUndefined()
    expect(result.catalog.objects.get('dataset-one')?.links.contactPoint).toBeUndefined()
  })

  it('recursively deletes child objects when parent deleted', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero'] }),
      createObject('dataset-zero', 'Dataset', { title: 'Dataset' }, {
        distribution: ['distribution-zero', 'distribution-one']
      }),
      createObject('distribution-zero', 'Distribution', { title: 'Dist 0' }),
      createObject('distribution-one', 'Distribution', { title: 'Dist 1' }),
    ])

    const result = deleteObject(catalog, 'dataset-zero')

    expect(result.catalog.objects.has('dataset-zero')).toBe(false)
    expect(result.catalog.objects.has('distribution-zero')).toBe(false)
    expect(result.catalog.objects.has('distribution-one')).toBe(false)
  })

  it('does not delete shared child objects', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero', 'dataset-one'] }),
      createObject('dataset-zero', 'Dataset', {}, { publisher: ['shared-organization'] }),
      createObject('dataset-one', 'Dataset', {}, { publisher: ['shared-organization'] }),
      createObject('shared-organization', 'Organization', { name: 'Shared Org' }),
    ])

    const result = deleteObject(catalog, 'dataset-zero')

    expect(result.catalog.objects.has('dataset-zero')).toBe(false)
    expect(result.catalog.objects.has('shared-organization')).toBe(true)
    expect(result.catalog.objects.get('dataset-one')?.links.publisher).toEqual(['shared-organization'])
  })

  it('returns undo record with object data and all parent links', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero', 'dataset-one'] }),
      createObject('dataset-zero', 'Dataset', { title: 'First' }, {
        contactPoint: ['shared-contact']
      }),
      createObject('dataset-one', 'Dataset', { title: 'Second' }, {
        contactPoint: ['shared-contact']
      }),
      createObject('shared-contact', 'Kind', { fn: 'Shared Contact' }),
    ])

    const { undoRecord } = deleteObject(catalog, 'shared-contact')

    expect(undoRecord.type).toBe('object')
    expect(undoRecord.object).toMatchObject({
      id: 'shared-contact',
      dcatClass: 'Kind',
      properties: { fn: 'Shared Contact' },
    })
    expect(undoRecord.parentLinks).toEqual([
      { parentId: 'dataset-zero', property: 'contactPoint', position: 0 },
      { parentId: 'dataset-one', property: 'contactPoint', position: 0 },
    ])
  })
})

describe('undoRemoval', () => {
  it('restores removed link to parent at original position', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-one'] }),
      createObject('dataset-zero', 'Dataset', { title: 'Dataset 0' }),
      createObject('dataset-one', 'Dataset', { title: 'Dataset 1' }),
    ])

    const undoRecord = {
      type: 'link' as const,
      parentId: 'catalog-root',
      property: 'dataset',
      childId: 'dataset-zero',
      position: 0,
      wasSingleLink: false,
    }

    const result = undoRemoval(catalog, undoRecord)

    expect(result.objects.get('catalog-root')?.links.dataset).toEqual([
      'dataset-zero',
      'dataset-one'
    ])
  })

  it('restores singleLinks when undoing single-link removal', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero'] }),
      createObject('dataset-zero', 'Dataset', {}, {}),
      createObject('organization-zero', 'Organization', { name: 'Org' }),
    ])

    const undoRecord = {
      type: 'link' as const,
      parentId: 'dataset-zero',
      property: 'publisher',
      childId: 'organization-zero',
      position: 0,
      wasSingleLink: true,
    }

    const result = undoRemoval(catalog, undoRecord)

    expect(result.objects.get('dataset-zero')?.links.publisher).toEqual(['organization-zero'])
    expect(result.objects.get('dataset-zero')?.singleLinks).toContain('publisher')
  })

  it('restores deleted object and all parent links', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero', 'dataset-one'] }),
      createObject('dataset-zero', 'Dataset', {}, { contactPoint: [] }),
      createObject('dataset-one', 'Dataset', {}, { contactPoint: [] }),
    ])

    const undoRecord = {
      type: 'object' as const,
      object: createObject('shared-contact', 'Kind', { fn: 'Shared Contact' }),
      children: [],
      parentLinks: [
        { parentId: 'dataset-zero', property: 'contactPoint', position: 0 },
        { parentId: 'dataset-one', property: 'contactPoint', position: 0 },
      ],
    }

    const result = undoRemoval(catalog, undoRecord)

    expect(result.objects.has('shared-contact')).toBe(true)
    expect(result.objects.get('shared-contact')).toMatchObject({
      id: 'shared-contact',
      dcatClass: 'Kind',
      properties: { fn: 'Shared Contact' },
    })
    expect(result.objects.get('dataset-zero')?.links.contactPoint).toEqual(['shared-contact'])
    expect(result.objects.get('dataset-one')?.links.contactPoint).toEqual(['shared-contact'])
  })

  it('restores deleted object with its children', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: [] }),
    ])

    const deletedDataset = createObject('dataset-zero', 'Dataset', { title: 'Dataset' }, {
      distribution: ['distribution-zero']
    })
    const deletedDist = createObject('distribution-zero', 'Distribution', { title: 'Dist' })

    const undoRecord = {
      type: 'object' as const,
      object: deletedDataset,
      children: [deletedDist],
      parentLinks: [
        { parentId: 'catalog-root', property: 'dataset', position: 0 },
      ],
    }

    const result = undoRemoval(catalog, undoRecord)

    expect(result.objects.has('dataset-zero')).toBe(true)
    expect(result.objects.has('distribution-zero')).toBe(true)
    expect(result.objects.get('catalog-root')?.links.dataset).toEqual(['dataset-zero'])
  })
})

describe('findParentLinks', () => {
  it('finds all parent objects linking to target', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero', 'dataset-one'] }),
      createObject('dataset-zero', 'Dataset', {}, { contactPoint: ['shared-contact'] }),
      createObject('dataset-one', 'Dataset', {}, { contactPoint: ['shared-contact'] }),
      createObject('shared-contact', 'Kind', { fn: 'Contact' }),
    ])

    const parents = findParentLinks(catalog, 'shared-contact')

    expect(parents).toEqual([
      { parentId: 'dataset-zero', property: 'contactPoint', position: 0 },
      { parentId: 'dataset-one', property: 'contactPoint', position: 0 },
    ])
  })

  it('returns empty array for unlinked object', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, { dataset: ['dataset-zero'] }),
      createObject('dataset-zero', 'Dataset', {}, {}),
      createObject('orphan-contact', 'Kind', { fn: 'Orphan' }),
    ])

    const parents = findParentLinks(catalog, 'orphan-contact')

    expect(parents).toEqual([])
  })

  it('finds multiple links from same parent', () => {
    const catalog = createCatalog([
      createObject('catalog-root', 'Catalog', {}, {
        dataset: ['dataset-zero'],
        service: ['dataset-zero']
      }),
      createObject('dataset-zero', 'Dataset', { title: 'Dataset' }),
    ])

    const parents = findParentLinks(catalog, 'dataset-zero')

    expect(parents).toHaveLength(2)
    expect(parents).toContainEqual({ parentId: 'catalog-root', property: 'dataset', position: 0 })
    expect(parents).toContainEqual({ parentId: 'catalog-root', property: 'service', position: 0 })
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
    object('catalog-root', 'Catalog', { title: 'Catalog' }, { dataset: ['water-dataset', 'air-dataset'] }),
    object('water-dataset', 'Dataset', { title: 'Water' }, { contactPoint: ['shared-contact'] }),
    object('air-dataset', 'Dataset', { title: 'Air' }, { contactPoint: ['shared-contact'] }),
    object('shared-contact', 'Kind', { fn: 'Help desk' }, { address: ['contact-address'] }),
    object('contact-address', 'Address', { locality: 'Springfield' }),
  )

describe('linkObject', () => {
  it('adds the same object, so both parents show it', () => {
    const catalog = linkObject(shared(), 'catalog-root', 'contactPoint', 'shared-contact')
    expect(catalog.objects.get('catalog-root')!.links.contactPoint).toEqual(['shared-contact'])
    expect(usesOf(catalog).get('shared-contact')).toHaveLength(3)
    expect(catalog.objects.size).toBe(shared().objects.size)
  })

  it('writes a single field back as one object', () => {
    const catalog = linkObject(shared(), 'catalog-root', 'publisher', 'shared-contact', true)
    expect(catalog.objects.get('catalog-root')!.singleLinks).toEqual(['publisher'])
    expect(() => linkObject(catalog, 'catalog-root', 'publisher', 'water-dataset', true)).toThrow(/holds one/)
  })

  it('refuses a loop and ignores a link that is already there', () => {
    const catalog = shared()
    expect(() => linkObject(catalog, 'water-dataset', 'x', 'catalog-root')).toThrow(/loop/)
    expect(() => linkObject(catalog, 'water-dataset', 'x', 'water-dataset')).toThrow(/loop/)
    expect(linkObject(catalog, 'water-dataset', 'contactPoint', 'shared-contact')).toBe(catalog)
  })
})

describe('createLinked', () => {
  it('creates a blank object with a UUID and links it', () => {
    const { catalog, id } = createLinked(shared(), 'water-dataset', 'contactPoint', 'Kind', false, uuids(UUID_1))
    expect(id).toBe(UUID_1)
    expect(catalog.objects.get(id)).toEqual(object(id, 'Kind', { '@type': 'Kind' }))
    expect(catalog.objects.get('water-dataset')!.links.contactPoint).toEqual(['shared-contact', id])
  })

  it('starts a field that was empty', () => {
    const start = shared()
    const { catalog, id } = createLinked(start, 'catalog-root', 'publisher', 'Organization', true, uuids(UUID_1))
    expect(id).toBe(UUID_1)
    expect(catalog.objects.get('catalog-root')!.singleLinks).toEqual(['publisher'])
  })

  it('turns a list field read as one object into a list at two, and an empty list as written gives way to the links', () => {
    const start = catalogOf(
      object('catalog-root', 'Catalog', {}, { dataset: ['dataset'] }),
      { ...object('dataset', 'Dataset', { sample: [] }, { distribution: ['distribution-one'] }), singleLinks: ['distribution'] },
      object('distribution-one', 'Distribution', { title: 'one' }),
    )
    const { catalog } = createLinked(start, 'dataset', 'distribution', 'Distribution', false, uuids(UUID_1))
    expect(catalog.objects.get('dataset')!.singleLinks).toEqual([])
    const withSample = createLinked(catalog, 'dataset', 'sample', 'Distribution', false, uuids(UUID_2)).catalog
    expect(withSample.objects.get('dataset')!.properties).toEqual({})
    expect(withSample.objects.get('dataset')!.links.sample).toEqual([UUID_2])
  })
})

describe('copyFor', () => {
  it('copies a shared object and what only it uses, for one place only', () => {
    const before = shared()
    const { catalog, id } = copyFor(before, 'air-dataset', 'contactPoint', 'shared-contact', uuids(UUID_1, UUID_2))
    expect(id).toBe(UUID_1)
    expect(catalog.objects.get('air-dataset')!.links.contactPoint).toEqual([id])
    expect(catalog.objects.get('water-dataset')!.links.contactPoint).toEqual(['shared-contact'])

    const copy = catalog.objects.get(id)!
    expect(copy.properties).toEqual({ fn: 'Help desk' })
    expect(copy.links.address).toEqual([UUID_2])
    expect(catalog.objects.get(UUID_2)!.properties).toEqual({ locality: 'Springfield' })
    expect(usesOf(catalog).get('shared-contact')).toHaveLength(1)
    // The original catalog is unchanged.
    expect(before.objects.size).toBe(5)
  })

  it('leaves the @id out of the copies, so they are not the same node as the originals', () => {
    const start = shared()
    const contact = start.objects.get('shared-contact')!
    start.objects.set(contact.id, { ...contact, properties: { '@id': 'https://example.gov/help', fn: 'Help desk' } })
    const { catalog, id } = copyFor(start, 'air-dataset', 'contactPoint', contact.id, uuids(UUID_1, UUID_2))
    expect(catalog.objects.get(id)!.properties).toEqual({ fn: 'Help desk' })
    expect(catalog.objects.get(contact.id)!.properties['@id']).toBe('https://example.gov/help')
  })

  it('keeps links to objects shared with others', () => {
    const start = linkObject(shared(), 'catalog-root', 'contactPoint', 'contact-address')
    const { catalog, id } = copyFor(start, 'air-dataset', 'contactPoint', 'shared-contact', uuids(UUID_1))
    expect(catalog.objects.get(id)!.links.address).toEqual(['contact-address'])
  })

  it('copies a loop inside the object as a loop', () => {
    const start = catalogOf(
      object('catalog-root', 'Catalog', {}, { hasPart: ['catalog-a'], catalog: ['catalog-a'] }),
      object('catalog-a', 'Catalog', {}, { hasPart: ['catalog-b'] }),
      object('catalog-b', 'Catalog', {}, { hasPart: ['catalog-a'] }),
    )
    const { catalog, id } = copyFor(start, 'catalog-root', 'catalog', 'catalog-a', uuids(UUID_1, UUID_2))
    const inner = catalog.objects.get(id)!.links.hasPart[0]
    expect(inner).toBe(UUID_2)
    expect(catalog.objects.get(inner)!.links.hasPart).toEqual([id])
  })

  it('refuses an object that is not in the field', () => {
    expect(() => copyFor(shared(), 'catalog-root', 'contactPoint', 'dataset-zero')).toThrow(/not in/)
  })
})
