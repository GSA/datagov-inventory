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
    object('catalog-root', 'Catalog', { title: 'Catalog' }, { dataset: ['water-dataset', 'air-dataset'] }),
    object('water-dataset', 'Dataset', { title: 'Water' }, { contactPoint: ['shared-contact'] }),
    object('air-dataset', 'Dataset', { title: 'Air' }, { contactPoint: ['shared-contact'] }),
    object('shared-contact', 'Kind', { fn: 'Help desk' }, { address: ['contact-address'] }),
    object('contact-address', 'Address', { locality: 'Springfield' }),
  )

describe('usesOf', () => {
  it('lists every place an object is used, with the field', () => {
    const uses = usesOf(shared())
    expect(uses.get('shared-contact')).toEqual([
      { parentId: 'water-dataset', property: 'contactPoint' },
      { parentId: 'air-dataset', property: 'contactPoint' },
    ])
    expect(uses.get('catalog-root')).toBeUndefined()
  })

  it('is built once per version of the catalog', () => {
    const catalog = shared()
    expect(usesOf(catalog)).toBe(usesOf({ ...catalog }))
    expect(usesOf(linkObject(catalog, 'catalog-root', 'contactPoint', 'shared-contact'))).not.toBe(usesOf(catalog))
  })

  it('counts only places in the catalog, not objects removed from their field', () => {
    const catalog = catalogOf(
      object('catalog-root', 'Catalog', {}, { dataset: ['active-dataset'] }),
      object('active-dataset', 'Dataset', {}, { publisher: ['organization'] }),
      object('removed-dataset', 'Dataset', {}, { publisher: ['organization'] }), // removed from the catalog, kept for Undo
      object('organization', 'Organization'),
    )
    expect(usesOf(catalog).get('organization')).toEqual([{ parentId: 'active-dataset', property: 'publisher' }])
    expect(usesOf(catalog).get('removed-dataset')).toBeUndefined()
  })

  it('still finds loops through removed objects', () => {
    const catalog = catalogOf(
      object('catalog-root', 'Catalog', {}, { dataset: ['catalog-d'] }),
      object('catalog-d', 'Dataset', {}, { publisher: ['organization'] }),
      object('organization', 'Organization'),
      object('removed-parent', 'Organization', {}, { subOrganizationOf: ['organization'] }), // removed
    )
    expect(linkersOf('organization', catalog).has('removed-parent')).toBe(true)
    expect(() => linkObject(catalog, 'organization', 'subOrganizationOf', 'removed-parent')).toThrow(/loop/)
  })
})

describe('linkersOf', () => {
  it('finds the object and everything above it, and stops at loops', () => {
    const catalog = catalogOf(
      object('catalog-root', 'Catalog', {}, { hasPart: ['catalog-a'] }),
      object('catalog-a', 'Catalog', {}, { hasPart: ['catalog-b'] }),
      object('catalog-b', 'Catalog', {}, { hasPart: ['catalog-a'] }),
    )
    expect(linkersOf('catalog-b', catalog)).toEqual(new Set(['catalog-b', 'catalog-a', 'catalog-root']))
  })
})