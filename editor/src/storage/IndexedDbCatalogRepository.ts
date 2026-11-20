import type { CatalogObject, CatalogWorkspace } from '../catalog/types'
import { CatalogStorageError, type CatalogRepository } from './CatalogRepository'

const DATABASE = 'datagov-inventory-editor'
const VERSION = 1
const CATALOGS = 'catalogs'
const OBJECTS = 'metadataObjects'
const REFERENCES = 'objectReferences'
const CATALOG_ID = 'catalogId'

interface CatalogRecord {
  id: string
  sourceName: string
  rootId: string
}

interface ObjectRecord {
  catalogId: string
  id: string
  ordinal: number
  dcatClass: string
  properties: Record<string, unknown>
  singleLinks: string[]
}

interface ReferenceRecord {
  catalogId: string
  parentId: string
  property: string
  propertyOrdinal: number
  ordinal: number
  childId: string
}

/** Stores one record per metadata object and one per ordered graph edge. */
export class IndexedDbCatalogRepository implements CatalogRepository {
  private readonly openDatabase: () => Promise<IDBDatabase>
  private database?: Promise<IDBDatabase>

  constructor(databaseName = DATABASE) {
    this.openDatabase = () => openCatalogDatabase(databaseName)
  }

  private databaseConnection(): Promise<IDBDatabase> {
    return (this.database ??= this.openDatabase())
  }

  async createCatalog(catalog: CatalogWorkspace): Promise<void> {
    const database = await this.databaseConnection()
    const transaction = database.transaction([CATALOGS, OBJECTS, REFERENCES], 'readwrite')
    const finished = transactionDone(transaction)
    transaction.objectStore(CATALOGS).add(catalogRecord(catalog))
    writeWholeGraph(transaction, catalog)
    await finished
  }

  async saveCatalog(catalog: CatalogWorkspace): Promise<void> {
    const database = await this.databaseConnection()
    const reading = database.transaction([OBJECTS, REFERENCES], 'readonly')
    const read = transactionDone(reading)
    const [storedObjects, storedReferences] = await Promise.all([
      request<ObjectRecord[]>(reading.objectStore(OBJECTS).index(CATALOG_ID).getAll(catalog.id)),
      request<ReferenceRecord[]>(reading.objectStore(REFERENCES).index(CATALOG_ID).getAll(catalog.id)),
    ])
    await read

    const writing = database.transaction([CATALOGS, OBJECTS, REFERENCES], 'readwrite')
    const finished = transactionDone(writing)
    writing.objectStore(CATALOGS).put(catalogRecord(catalog))
    const objects = writing.objectStore(OBJECTS)
    const references = writing.objectStore(REFERENCES)
    updateObjects(objects, catalog, storedObjects)
    updateReferences(references, catalog, storedReferences)
    await finished
  }

  async loadCatalog(id: string): Promise<CatalogWorkspace | undefined> {
    const database = await this.databaseConnection()
    const transaction = database.transaction([CATALOGS, OBJECTS, REFERENCES], 'readonly')
    const read = transactionDone(transaction)
    const [catalog, objects, references] = await Promise.all([
      request<CatalogRecord | undefined>(transaction.objectStore(CATALOGS).get(id)),
      request<ObjectRecord[]>(transaction.objectStore(OBJECTS).index(CATALOG_ID).getAll(id)),
      request<ReferenceRecord[]>(transaction.objectStore(REFERENCES).index(CATALOG_ID).getAll(id)),
    ])
    await read
    if (!catalog) return undefined

    const graphObjects = new Map<string, CatalogObject>()
    for (const object of objects.sort((a, b) => a.ordinal - b.ordinal)) {
      graphObjects.set(object.id, {
        id: object.id,
        dcatClass: object.dcatClass,
        properties: nullRecord(object.properties),
        links: Object.create(null),
        singleLinks: object.singleLinks,
      })
    }
    for (const reference of references.sort(compareReferences)) {
      const parent = graphObjects.get(reference.parentId)
      if (!parent) throw new CatalogStorageError('invalid-data', 'The saved catalog contains a reference from a missing object.')
      if (!graphObjects.has(reference.childId)) {
        throw new CatalogStorageError('invalid-data', 'The saved catalog contains a reference to a missing object.')
      }
      ;(parent.links[reference.property] ??= []).push(reference.childId)
    }
    if (!graphObjects.has(catalog.rootId)) throw new CatalogStorageError('invalid-data', 'The saved catalog root object is missing.')
    return { id: catalog.id, sourceName: catalog.sourceName, catalog: { rootId: catalog.rootId, objects: graphObjects } }
  }
}

async function openCatalogDatabase(name: string): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new CatalogStorageError('unavailable', 'Browser storage is unavailable.')
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(name, VERSION)
    opening.onupgradeneeded = () => {
      const database = opening.result
      database.createObjectStore(CATALOGS, { keyPath: 'id' })
      const objects = database.createObjectStore(OBJECTS, { keyPath: ['catalogId', 'id'] })
      objects.createIndex(CATALOG_ID, CATALOG_ID)
      const references = database.createObjectStore(REFERENCES, {
        keyPath: ['catalogId', 'parentId', 'property', 'ordinal'],
      })
      references.createIndex(CATALOG_ID, CATALOG_ID)
    }
    opening.onsuccess = () => {
      opening.result.onversionchange = () => opening.result.close()
      resolve(opening.result)
    }
    opening.onerror = () => reject(storageError(opening.error))
    opening.onblocked = () => reject(new CatalogStorageError('blocked', 'Browser storage is blocked by another open page.'))
  })
}

const catalogRecord = ({ id, sourceName, catalog }: CatalogWorkspace): CatalogRecord => ({
  id,
  sourceName,
  rootId: catalog.rootId,
})

function objectRecords(catalog: CatalogWorkspace): ObjectRecord[] {
  return Array.from(catalog.catalog.objects.values(), (object, ordinal) => ({
    catalogId: catalog.id,
    id: object.id,
    ordinal,
    dcatClass: object.dcatClass,
    properties: object.properties,
    singleLinks: object.singleLinks,
  }))
}

function referenceRecords(catalog: CatalogWorkspace): ReferenceRecord[] {
  return Array.from(catalog.catalog.objects.values()).flatMap((object) =>
    Object.entries(object.links).flatMap(([property, childIds], propertyOrdinal) =>
      childIds.map((childId, ordinal) => ({
        catalogId: catalog.id,
        parentId: object.id,
        property,
        propertyOrdinal,
        ordinal,
        childId,
      })),
    ),
  )
}

function writeWholeGraph(transaction: IDBTransaction, catalog: CatalogWorkspace): void {
  const objects = transaction.objectStore(OBJECTS)
  const references = transaction.objectStore(REFERENCES)
  for (const object of objectRecords(catalog)) objects.add(object)
  for (const reference of referenceRecords(catalog)) references.add(reference)
}

function updateObjects(store: IDBObjectStore, catalog: CatalogWorkspace, stored: ObjectRecord[]): void {
  const next = new Map(objectRecords(catalog).map((object) => [object.id, object]))
  for (const previous of stored) {
    const current = next.get(previous.id)
    if (!current) store.delete([catalog.id, previous.id])
    else {
      if (!recordsEqual(previous, current)) store.put(current)
      next.delete(previous.id)
    }
  }
  for (const object of next.values()) store.put(object)
}

function updateReferences(store: IDBObjectStore, catalog: CatalogWorkspace, stored: ReferenceRecord[]): void {
  const current = referenceRecords(catalog)
  const previousByParent = groupReferences(stored)
  const currentByParent = groupReferences(current)
  const changedParents = new Set([...previousByParent.keys(), ...currentByParent.keys()])
  for (const parentId of changedParents) {
    const previous = previousByParent.get(parentId) ?? []
    const next = currentByParent.get(parentId) ?? []
    if (recordsEqual(previous, next)) continue
    for (const reference of previous) store.delete(referenceKey(reference))
    for (const reference of next) store.put(reference)
  }
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
  a.parentId.localeCompare(b.parentId) || a.propertyOrdinal - b.propertyOrdinal || a.ordinal - b.ordinal

const referenceKey = ({ catalogId, parentId, property, ordinal }: ReferenceRecord): IDBValidKey =>
  [catalogId, parentId, property, ordinal]

const recordsEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const nullRecord = <T>(record: Record<string, T>): Record<string, T> => Object.assign(Object.create(null), record)

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result)
    value.onerror = () => reject(storageError(value.error))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = transaction.onerror = () => reject(storageError(transaction.error))
  })
}

function storageError(error: DOMException | null): CatalogStorageError {
  return error?.name === 'QuotaExceededError'
    ? new CatalogStorageError('quota', 'Browser storage is full.')
    : new CatalogStorageError('failed', 'Browser storage failed.')
}
