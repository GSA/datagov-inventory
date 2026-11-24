/// <reference types="vite/client" />

import { openDB } from 'idb'
import type { CatalogObject, CatalogWorkspace } from '../../src/catalog/types'
import { decompose } from '../../src/catalog/decompose'
import { identifyGraph } from '../../src/catalog/identify'
import { CatalogStorageError } from '../../src/storage/CatalogRepository'
import { IndexedDbCatalogRepository } from '../../src/storage/IndexedDbCatalogRepository'
import { MIGRATIONS, type Migration } from '../../src/storage/migrations'
import fixture from '../../fixtures/catalogs/valid/dataset-with-distributions.json?raw'

export interface SerializableCatalogWorkspace {
  id: string
  sourceName: string
  rootId: string
  objects: CatalogObject[]
}

const DATABASE = 'catalog-repository-test'
const migrationLog: string[] = []

/** Schema versions after the app's, so a test can upgrade a database the app saved. */
const testMigrations: Record<string, Migration> = {
  indexObjectsByClass: (_database, transaction) => {
    transaction.objectStore('metadataObjects').createIndex('dcatClass', 'dcatClass')
  },
  stampCatalogs: async (_database, transaction) => {
    for (let cursor = await transaction.objectStore('catalogs').openCursor(); cursor; cursor = await cursor.continue()) {
      await cursor.update({ ...(cursor.value as object), migrated: true })
    }
  },
  requireRootIds: async (_database, transaction) => {
    for (let cursor = await transaction.objectStore('catalogs').openCursor(); cursor; cursor = await cursor.continue()) {
      const { rootId } = cursor.value as { rootId: unknown }
      if (typeof rootId !== 'string' || rootId.length > 36) throw new Error('Invalid catalog record')
      await cursor.update({ ...(cursor.value as object), rootIdChecked: true })
    }
  },
}

const logged =
  (name: string): Migration =>
  (database, transaction) => {
    migrationLog.push(name)
    return testMigrations[name](database, transaction)
  }

/** `?migrations=a,b` opens the database at the app's version plus these test versions, in order. */
const laterMigrations = new URLSearchParams(location.search).get('migrations')?.split(',') ?? []
const storage = new IndexedDbCatalogRepository(DATABASE, [...MIGRATIONS, ...laterMigrations.map(logged)])

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

interface StorageErrorData {
  code?: string
  message: string
}

const storageError = (error: unknown): StorageErrorData =>
  error instanceof CatalogStorageError ? { code: error.code, message: error.message } : { message: String(error) }

/** A connection that never closes for an upgrade, like a tab running a build without a `versionchange` handler. */
let olderConnection: Awaited<ReturnType<typeof openDB>> | undefined

/** Opens the stored database as it is, without the repository or an upgrade. */
async function readDatabase<T>(read: (database: Awaited<ReturnType<typeof openDB>>) => Promise<T> | T): Promise<T> {
  const database = await openDB(DATABASE)
  try {
    return await read(database)
  } finally {
    database.close()
  }
}

globalThis.catalogRepository = {
  fixture: () => toSerializable(identifiedFixture()),
  create: (catalog) => storage.createCatalog(fromSerializable(catalog)),
  load: async (id) => {
    const catalog = await storage.loadCatalog(id)
    return catalog ? toSerializable(catalog) : undefined
  },
  save: (catalog) => storage.saveCatalog(fromSerializable(catalog)),
  loadError: (id) => storage.loadCatalog(id).then(() => undefined, storageError),
  migrationLog,
  databaseSchema: () =>
    readDatabase((database) => ({
      version: database.version,
      objectIndexes: [...database.transaction('metadataObjects').store.indexNames],
    })),
  storedCatalogRecord: (id) => readDatabase((database) => database.get('catalogs', id)),
  putStoredCatalogRecord: (record) => readDatabase(async (database) => void (await database.put('catalogs', record))),
  holdOlderConnection: async () => void (olderConnection = await openDB(DATABASE)),
  readOlderConnection: async (id) => ({
    version: olderConnection!.version,
    catalog: await olderConnection!.get('catalogs', id),
  }),
  releaseOlderConnection: () => olderConnection?.close(),
}

declare global {
  var catalogRepository: {
    fixture(): SerializableCatalogWorkspace
    create(catalog: SerializableCatalogWorkspace): Promise<void>
    load(id: string): Promise<SerializableCatalogWorkspace | undefined>
    save(catalog: SerializableCatalogWorkspace): Promise<void>
    /** Why `load` rejects, as plain data that survives `page.evaluate`; `undefined` if it resolves. */
    loadError(id: string): Promise<StorageErrorData | undefined>
    /** The test migrations run by this page, in the order they ran. */
    migrationLog: string[]
    databaseSchema(): Promise<{ version: number; objectIndexes: string[] }>
    storedCatalogRecord(id: string): Promise<unknown>
    /** Writes a raw `catalogs` record, as if saved by a faulty or tampered build. */
    putStoredCatalogRecord(record: unknown): Promise<void>
    holdOlderConnection(): Promise<void>
    /** Reads through the held connection, which doesn't wait behind a pending upgrade as a new one would. */
    readOlderConnection(id: string): Promise<{ version: number; catalog: unknown }>
    releaseOlderConnection(): void
  }
}
