/// <reference types="vite/client" />

import type { CatalogObject, CatalogWorkspace } from '../../src/catalog/types'
import { decompose } from '../../src/catalog/decompose'
import { identifyGraph } from '../../src/catalog/identify'
import { IndexedDbCatalogRepository } from '../../src/storage/IndexedDbCatalogRepository'
import fixture from '../../fixtures/catalogs/valid/dataset-with-distributions.json?raw'

export interface SerializableCatalogWorkspace {
  id: string
  sourceName: string
  rootId: string
  objects: CatalogObject[]
}

const storage = new IndexedDbCatalogRepository()
const identifiedFixture = (): CatalogWorkspace => {
  let next = 0
  const catalog = identifyGraph(
    decompose(fixture),
    () => `00000000-0000-4000-8000-${String(++next).padStart(12, '0')}`,
  )
  return { id: '00000000-0000-4000-8000-999999999999', sourceName: 'dataset-with-distributions.json', catalog }
}
const fromSerializable = ({ id, sourceName, rootId, objects }: SerializableCatalogWorkspace): CatalogWorkspace => ({
  id,
  sourceName,
  catalog: { rootId, objects: new Map(objects.map((object) => [object.id, object])) },
})
const toSerializable = ({ id, sourceName, catalog }: CatalogWorkspace): SerializableCatalogWorkspace => ({
  id,
  sourceName,
  rootId: catalog.rootId,
  objects: Array.from(catalog.objects.values()),
})

globalThis.catalogRepository = {
  fixture: () => toSerializable(identifiedFixture()),
  create: (catalog) => storage.createCatalog(fromSerializable(catalog)),
  load: async (id) => {
    const catalog = await storage.loadCatalog(id)
    return catalog ? toSerializable(catalog) : undefined
  },
  save: (catalog) => storage.saveCatalog(fromSerializable(catalog)),
}

declare global {
  var catalogRepository: {
    fixture(): SerializableCatalogWorkspace
    create(catalog: SerializableCatalogWorkspace): Promise<void>
    load(id: string): Promise<SerializableCatalogWorkspace | undefined>
    save(catalog: SerializableCatalogWorkspace): Promise<void>
  }
}
