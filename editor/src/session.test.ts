import { describe, it, expect } from 'vitest'
import type { CatalogObject, CatalogGraph } from './catalog/types'
import { removeLink, deleteObject, undoRemoval, findParentLinks } from './session'

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
