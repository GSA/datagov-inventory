import type { IDBPDatabase, IDBPTransaction } from 'idb'

/**
 * Upgrades browser storage by one version, inside the upgrade transaction. Migration n (from 0) upgrades version n to
 * n + 1, so the database version is the number of migrations: append new ones and never change a released one. Await
 * only IndexedDB requests, since awaiting anything else lets the transaction commit early. Saved records are untrusted:
 * check each one's shape and bounds before transforming it, and throw to abort the upgrade.
 */
export type Migration = (
  database: IDBPDatabase<unknown>,
  transaction: IDBPTransaction<unknown, string[], 'versionchange'>,
) => void | Promise<void>

/** Version 1 (#28). Names are literals so later code changes can't alter a released schema. */
const createCatalogStores: Migration = (database) => {
  database.createObjectStore('catalogs', { keyPath: 'id' })
  database.createObjectStore('metadataObjects', { keyPath: ['catalogId', 'id'] }).createIndex('catalogId', 'catalogId')
  database
    .createObjectStore('objectReferences', { keyPath: ['catalogId', 'parentId', 'property', 'ordinal'] })
    .createIndex('catalogId', 'catalogId')
}

export const MIGRATIONS: readonly Migration[] = [createCatalogStores]
