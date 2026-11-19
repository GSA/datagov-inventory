import { describe, expect, it } from 'vitest'
import type { CatalogObject, CatalogWorkspace } from './catalog/types'
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

const root = object('Catalog')
const child = object('Embedded catalog', OTHER_OBJECT_ID)
const workspace: CatalogWorkspace = {
  id: CATALOG_ID,
  sourceName: 'catalog.json',
  catalog: { rootId: root.id, objects: new Map([[root.id, root], [child.id, child]]) },
}

describe('editor routes', () => {
  it('round trips distinct catalog and object UUIDs with the object type', () => {
    const path = objectPath(CATALOG_ID, object('Air Quality'))
    expect(path).toBe('GfokmoTeT9uJ68hBqpV0rw/dataset/byND73XUQ6eHsUP6ks4Kog')
    expect(editorAddress(path)).toEqual({ catalogId: CATALOG_ID, objectId: OBJECT_ID, objectType: 'dataset' })
  })

  it('builds a path for a newly identified object before it is in the catalog graph', () => {
    expect(editorPath(workspace, { id: OTHER_OBJECT_ID, dcatClass: 'Distribution' }))
      .toBe('GfokmoTeT9uJ68hBqpV0rw/distribution/eSDoB0JvRCK9OGyZexJYYQ')
  })

  it('identifies a catalog root without an object', () => {
    expect(editorAddress(catalogPath(CATALOG_ID))).toEqual({ catalogId: CATALOG_ID })
  })

  it.each([
    '',
    'not-a-catalog-token',
    `${catalogPath(CATALOG_ID)}/dataset/not-an-id`,
    `${catalogPath(CATALOG_ID)}/Dataset/byND73XUQ6eHsUP6ks4Kog`,
    `${catalogPath(CATALOG_ID)}/dataset/byND73XUQ6eHsUP6ks4Ko`,
    `${catalogPath(CATALOG_ID)}/extra/segments/without/identity`,
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

  it('uses the catalog path for the root, regardless of its DCAT class', () => {
    expect(editorPath(workspace, root)).toBe(catalogPath(workspace.id))
  })

  it('uses an object path for a nested Catalog object', () => {
    expect(editorPath(workspace, child)).toBe(objectPath(workspace.id, child))
  })

})
