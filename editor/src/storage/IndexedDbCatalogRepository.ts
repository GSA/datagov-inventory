import { openDB, type DBSchema, type IDBPDatabase, type IDBPObjectStore } from 'idb'
import type { CatalogObject, CatalogWorkspace } from '../catalog/types'
import { CatalogStorageError, type CatalogRepository } from './CatalogRepository'
import { MIGRATIONS, type Migration } from './migrations'

const DATABASE = 'datagov-inventory-editor'
const CATALOGS = 'catalogs'
const OBJECTS = 'metadataObjects'
const REFERENCES = 'objectReferences'
const CATALOG_ID = 'catalogId'

interface CatalogRecord {
  id: string
  sourceName: string
  rootId: string
  createdAt: number
  updatedAt: number
}

type LinkShape = 'single' | 'array'

interface ObjectRecord {
  catalogId: string
  id: string
  /** Preserves CatalogGraph.objects Map iteration order. */
  ordinal: number
  dcatClass: string
  /** Structured cloning preserves the in-memory properties record's iteration order. */
  properties: Record<string, unknown>
  /**
   * Maps each link property to its source JSON shape. Key iteration order preserves
   * the in-memory links record's order, including links whose child array is empty.
   */
  linkShapes: Record<string, LinkShape>
}

interface ReferenceRecord {
  catalogId: string
  parentId: string
  property: string
  /** Preserves child order within this link property's in-memory array. */
  ordinal: number
  childId: string
}

interface CatalogDatabase extends DBSchema {
  catalogs: { key: string; value: CatalogRecord }
  metadataObjects: {
    key: [string, string]
    value: ObjectRecord
    indexes: { catalogId: string }
  }
  objectReferences: {
    key: [string, string, string, number]
    value: ReferenceRecord
    indexes: { catalogId: string }
  }
}

type WritableObjectStore = IDBPObjectStore<
  CatalogDatabase,
  ['catalogs', 'metadataObjects', 'objectReferences'],
  'metadataObjects',
  'readwrite'
>
type WritableReferenceStore = IDBPObjectStore<
  CatalogDatabase,
  ['catalogs', 'metadataObjects', 'objectReferences'],
  'objectReferences',
  'readwrite'
>

/** Stores one record per metadata object and one per ordered graph edge. */
export class IndexedDbCatalogRepository implements CatalogRepository {
  private database?: Promise<IDBPDatabase<CatalogDatabase>>

  constructor(
    private readonly databaseName = DATABASE,
    private readonly migrations: readonly Migration[] = MIGRATIONS,
  ) {}

  async createCatalog(catalog: CatalogWorkspace): Promise<void> {
    await withStorageErrors(async () => {
      const database = await this.databaseConnection()
      const transaction = database.transaction([CATALOGS, OBJECTS, REFERENCES], 'readwrite')
      const now = Date.now()
      await transaction.objectStore(CATALOGS).add(catalogRecord(catalog, now, now))
      await writeWholeGraph(transaction.objectStore(OBJECTS), transaction.objectStore(REFERENCES), catalog)
      await transaction.done
    })
  }

  async saveCatalog(catalog: CatalogWorkspace): Promise<void> {
    await withStorageErrors(async () => {
      const database = await this.databaseConnection()
      const transaction = database.transaction([CATALOGS, OBJECTS, REFERENCES], 'readwrite')
      const catalogs = transaction.objectStore(CATALOGS)
      const objects = transaction.objectStore(OBJECTS)
      const references = transaction.objectStore(REFERENCES)
      const [storedCatalog, storedObjects, storedReferences] = await Promise.all([
        catalogs.get(catalog.id),
        objects.index(CATALOG_ID).getAll(catalog.id),
        references.index(CATALOG_ID).getAll(catalog.id),
      ])
      const now = Date.now()
      await catalogs.put(catalogRecord(catalog, storedCatalog?.createdAt ?? now, now))
      await Promise.all([
        updateObjects(objects, catalog, storedObjects),
        updateReferences(references, catalog, storedReferences),
      ])
      await transaction.done
    })
  }

  async loadCatalog(id: string): Promise<CatalogWorkspace | undefined> {
    return withStorageErrors(async () => {
      const database = await this.databaseConnection()
      const transaction = database.transaction([CATALOGS, OBJECTS, REFERENCES], 'readonly')
      const catalogs = transaction.objectStore(CATALOGS)
      const objectStore = transaction.objectStore(OBJECTS)
      const referenceStore = transaction.objectStore(REFERENCES)
      const [catalog, objects, references] = await Promise.all([
        catalogs.get(id),
        objectStore.index(CATALOG_ID).getAll(id),
        referenceStore.index(CATALOG_ID).getAll(id),
      ])
      await transaction.done
      if (!catalog) return undefined

      const graphObjects = new Map<string, CatalogObject>()
      for (const object of objects.sort((a, b) => a.ordinal - b.ordinal)) {
        graphObjects.set(object.id, {
          id: object.id,
          dcatClass: object.dcatClass,
          properties: nullRecord(object.properties),
          links: nullRecord(Object.fromEntries(Object.keys(object.linkShapes).map((property) => [property, []]))),
          singleLinks: Object.entries(object.linkShapes)
            .filter(([, shape]) => shape === 'single')
            .map(([property]) => property),
        })
      }
      for (const reference of references.sort(compareReferences)) {
        const parent = graphObjects.get(reference.parentId)
        if (!parent) throw invalidData('The saved catalog contains a reference from a missing object.')
        if (!graphObjects.has(reference.childId)) {
          throw invalidData('The saved catalog contains a reference to a missing object.')
        }
        ;(parent.links[reference.property] ??= []).push(reference.childId)
      }
      if (!graphObjects.has(catalog.rootId)) throw invalidData('The saved catalog root object is missing.')
      return { id: catalog.id, sourceName: catalog.sourceName, catalog: { rootId: catalog.rootId, objects: graphObjects } }
    })
  }

  private databaseConnection(): Promise<IDBPDatabase<CatalogDatabase>> {
    if (!globalThis.indexedDB) throw new CatalogStorageError('unavailable', 'Browser storage is unavailable.')
    return (this.database ??= this.open().catch((error: unknown) => {
      this.database = undefined
      throw error
    }))
  }

  /**
   * Closes this connection when another tab upgrades, so it doesn't block it; the next operation then fails as
   * `outdated`. Rejects as soon as another connection blocks the upgrade. The request stays queued, so the upgrade still runs once
   * that connection closes; that late connection is closed, and the next operation opens a fresh one.
   */
  private open(): Promise<IDBPDatabase<CatalogDatabase>> {
    const migrations = this.migrations
    let migrated = Promise.resolve(true)
    let blocked = false
    const upgradeFailed = () => new CatalogStorageError('upgrade-failed', UPGRADE_FAILED)
    return new Promise((resolve, reject) => {
      openDB<CatalogDatabase>(this.databaseName, migrations.length, {
        upgrade(database, oldVersion, _newVersion, transaction) {
          migrated = (async () => {
            let version = oldVersion
            try {
              for (const migrate of migrations.slice(oldVersion)) {
                await migrate(database as unknown as Parameters<Migration>[0], transaction as unknown as Parameters<Migration>[1])
                version++
              }
              return true
            } catch (error) {
              console.error(`Browser storage upgrade to version ${version + 1} failed: ${errorName(error)}`)
              abortQuietly(transaction)
              return false
            }
          })()
        },
        blocked() {
          blocked = true
          reject(new CatalogStorageError('blocked', BLOCKED))
        },
        blocking: (_currentVersion, _blockedVersion, event) => {
          ;(event.target as IDBDatabase).close()
          this.database = undefined
        },
      }).then(
        async (database) => {
          const succeeded = await migrated
          if (succeeded && !blocked) return resolve(database)
          database.close()
          if (!succeeded) reject(upgradeFailed())
        },
        async (error: unknown) => reject((await migrated) ? error : upgradeFailed()),
      )
    })
  }
}

const BLOCKED =
  'Another tab with the Inventory editor open is blocking an update to browser storage. Close or reload that tab, ' +
  'then reload this page. Your saved catalogs have not been changed.'
const OUTDATED =
  'Browser storage was updated by a newer version of the editor, perhaps in another tab. Export any open catalog to ' +
  'keep your latest changes, then reload this page.'
const UPGRADE_FAILED =
  "The catalogs saved in this browser could not be upgraded for this version of the editor. They have not been " +
  "changed or deleted. Reload the page to try again. If it still fails, don't clear this site's data, which deletes " +
  'them, and work from your last exported catalog file.'

/** Only the error's name, since its message may quote saved catalog data. */
const errorName = (error: unknown) => (error instanceof Error ? error.name : typeof error)

/** Aborts an upgrade unless a failed request already has. */
function abortQuietly(transaction: { abort(): void }) {
  try {
    transaction.abort()
  } catch {
    // Already aborted: InvalidStateError.
  }
}

const catalogRecord = (
  { id, sourceName, catalog }: CatalogWorkspace,
  createdAt: number,
  updatedAt: number,
): CatalogRecord => ({
  id,
  sourceName,
  rootId: catalog.rootId,
  createdAt,
  updatedAt,
})

function objectRecords(catalog: CatalogWorkspace): ObjectRecord[] {
  return Array.from(catalog.catalog.objects.values(), (object, ordinal) => ({
    catalogId: catalog.id,
    id: object.id,
    ordinal,
    dcatClass: object.dcatClass,
    properties: object.properties,
    linkShapes: linkShapes(object),
  }))
}

function referenceRecords(catalog: CatalogWorkspace): ReferenceRecord[] {
  return Array.from(catalog.catalog.objects.values()).flatMap((object) =>
    Object.entries(object.links).flatMap(([property, childIds]) =>
      childIds.map((childId, ordinal) => ({
        catalogId: catalog.id,
        parentId: object.id,
        property,
        ordinal,
        childId,
      })),
    ),
  )
}

async function writeWholeGraph(
  objects: WritableObjectStore,
  references: WritableReferenceStore,
  catalog: CatalogWorkspace,
): Promise<void> {
  await Promise.all([
    ...objectRecords(catalog).map((object) => objects.add(object)),
    ...referenceRecords(catalog).map((reference) => references.add(reference)),
  ])
}

async function updateObjects(store: WritableObjectStore, catalog: CatalogWorkspace, stored: ObjectRecord[]): Promise<void> {
  const next = new Map(objectRecords(catalog).map((object) => [object.id, object]))
  const writes: Promise<unknown>[] = []
  for (const previous of stored) {
    const current = next.get(previous.id)
    if (!current) writes.push(store.delete([catalog.id, previous.id]))
    else {
      if (!recordsEqual(previous, current)) writes.push(store.put(current))
      next.delete(previous.id)
    }
  }
  for (const object of next.values()) writes.push(store.put(object))
  await Promise.all(writes)
}

async function updateReferences(
  store: WritableReferenceStore,
  catalog: CatalogWorkspace,
  stored: ReferenceRecord[],
): Promise<void> {
  const previousByParent = groupReferences(stored)
  const currentByParent = groupReferences(referenceRecords(catalog))
  const writes: Promise<unknown>[] = []
  for (const parentId of new Set([...previousByParent.keys(), ...currentByParent.keys()])) {
    const previous = previousByParent.get(parentId) ?? []
    const current = currentByParent.get(parentId) ?? []
    if (recordsEqual(previous, current)) continue
    for (const reference of previous) writes.push(store.delete(referenceKey(reference)))
    for (const reference of current) writes.push(store.put(reference))
  }
  await Promise.all(writes)
}

function groupReferences(records: ReferenceRecord[]): Map<string, ReferenceRecord[]> {
  const grouped = new Map<string, ReferenceRecord[]>()
  for (const record of records.sort(compareReferences)) {
    const list = grouped.get(record.parentId)
    if (list) list.push(record)
    else grouped.set(record.parentId, [record])
  }
  return grouped
}

const compareReferences = (a: ReferenceRecord, b: ReferenceRecord) =>
  a.parentId.localeCompare(b.parentId) || a.property.localeCompare(b.property) || a.ordinal - b.ordinal
function linkShapes(object: CatalogObject): Record<string, LinkShape> {
  const singleLinks = new Set(object.singleLinks)
  return nullRecord(
    Object.fromEntries(
      Object.keys(object.links).map((property) => [property, singleLinks.has(property) ? 'single' : 'array']),
    ),
  )
}

const referenceKey = ({ catalogId, parentId, property, ordinal }: ReferenceRecord): [string, string, string, number] =>
  [catalogId, parentId, property, ordinal]
const recordsEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const nullRecord = <T>(record: Record<string, T>): Record<string, T> => Object.assign(Object.create(null), record)
const invalidData = (message: string) => new CatalogStorageError('invalid-data', message)

async function withStorageErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof CatalogStorageError) throw error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new CatalogStorageError('quota', 'Browser storage is full.')
    }
    if (error instanceof DOMException && error.name === 'VersionError') throw new CatalogStorageError('outdated', OUTDATED)
    throw new CatalogStorageError('failed', 'Browser storage failed.')
  }
}
