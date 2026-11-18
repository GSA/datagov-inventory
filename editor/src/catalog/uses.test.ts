import { describe, expect, it } from 'vitest'
import type { CatalogObject, CatalogGraph } from './types'
import { linkObject } from './edit'
import { linkersOf, usesOf } from './uses'

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
