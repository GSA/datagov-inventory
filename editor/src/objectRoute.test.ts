import { describe, expect, it } from 'vitest'
import type { CatalogGraph, CatalogObject } from './catalog/types'
import { catalogPath, editorAddress, editorPath, objectPath } from './objectRoute'

const CATALOG_ID = '19fa249a-84de-4fdb-89eb-c841aa9574af'
const OBJECT_ID = '6f2343ef-75d4-43a7-87b1-43fa92ce0aa2'
const OTHER_OBJECT_ID = '7920e807-426f-4422-bd38-6c997b125861'

const object = (title: string, id = OBJECT_ID): CatalogObject => ({
  id,
  dcatClass: 'Dataset',
  properties: { title },
  links: {},
  singleLinks: [],
})

describe('editor routes', () => {
  it('round trips distinct catalog and object UUIDs through a readable path', () => {
    const path = objectPath(CATALOG_ID, object('Air Quality'))
    expect(path).toBe('GfokmoTeT9uJ68hBqpV0rw/dataset/air-quality--byND73XUQ6eHsUP6ks4Kog')
    expect(editorAddress(path)).toEqual({ catalogId: CATALOG_ID, objectId: OBJECT_ID })
  })

  it('identifies a catalog root without an object', () => {
    expect(editorAddress(catalogPath(CATALOG_ID))).toEqual({ catalogId: CATALOG_ID })
  })

  it('ignores a stale label slug because the UUID token identifies the object', () => {
    const path = `${catalogPath(CATALOG_ID)}/dataset/old-title--byND73XUQ6eHsUP6ks4Kog`
    expect(editorAddress(path)).toEqual({ catalogId: CATALOG_ID, objectId: OBJECT_ID })
  })

  it.each([
    '',
    'not-a-catalog-token',
    `${catalogPath(CATALOG_ID)}/dataset/air--not-an-id`,
    `${catalogPath(CATALOG_ID)}/dataset/air--byND73XUQ6eHsUP6ks4Ko`,
    `${catalogPath(CATALOG_ID)}/extra/segments/without--identity`,
  ])('rejects malformed address %j', (path) => {
    expect(editorAddress(path)).toBeUndefined()
  })

  it('rejects non-UUID inputs when generating paths', () => {
    expect(() => catalogPath('catalog')).toThrow('Object id is not a UUID: catalog')
    expect(() => objectPath(CATALOG_ID, object('Air', 'object'))).toThrow('Object id is not a UUID: object')
  })

  it('gives duplicate labels different paths because their object UUIDs differ', () => {
    expect(objectPath(CATALOG_ID, object('Air'))).not.toBe(objectPath(CATALOG_ID, object('Air', OTHER_OBJECT_ID)))
  })

  it('uses the catalog root path only for the graph root object', () => {
    const root = object('Catalog')
    const child = object('Embedded catalog', OTHER_OBJECT_ID)
    const graph: CatalogGraph = { rootId: root.id, objects: new Map([[root.id, root], [child.id, child]]) }

    expect(editorPath(CATALOG_ID, graph, root)).toBe(catalogPath(CATALOG_ID))
    expect(editorPath(CATALOG_ID, graph, child)).toBe(objectPath(CATALOG_ID, child))
  })
})
