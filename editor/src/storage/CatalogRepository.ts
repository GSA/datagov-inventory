import type { CatalogGraph, CatalogId, CatalogRevision, WorkspaceCatalog } from '../catalog/types'

/** Enough persistence metadata to offer a saved catalog without loading its object graph. */
export interface CatalogSummary {
  id: CatalogId
  schemaVersion: string
  revision: CatalogRevision
  createdAt: Date
  updatedAt: Date
  /** The catalog's DCAT title, when it has one. */
  title?: string
}

/** Persistence boundary for phase 1 catalog graphs. */
export interface CatalogRepository {
  /** Lists saved catalogs without materializing their object graphs. */
  listCatalogs(): Promise<CatalogSummary[]>

  /** Loads one catalog and its reachable embedded catalogs as one consistent workspace. */
  loadCatalog(id: CatalogId): Promise<WorkspaceCatalog | undefined>

  /**
   * Persists a newly decomposed document in one transaction and returns its editable workspace.
   * The implementation generates a catalog UUID and object UUIDs, then rewrites the
   * decomposer's JSON-Pointer ids and references. Nested Catalog objects remain ordinary
   * linked objects in this initial contract.
   */
  createCatalog(catalog: CatalogGraph, schemaVersion: string): Promise<WorkspaceCatalog>

  /**
   * Atomically saves a graph and advances each changed catalog's revision. Throws
   * RevisionConflictError rather than overwriting a catalog whose revision has changed.
   */
  saveCatalog(workspace: WorkspaceCatalog, expectedRevision: CatalogRevision): Promise<WorkspaceCatalog>

  /** Atomically deletes a catalog's scoped objects and edges if its revision still matches. */
  deleteCatalog(id: CatalogId, expectedRevision: CatalogRevision): Promise<void>
}

/** Base class for failures callers can present as browser-storage errors. */
export class CatalogRepositoryError extends Error {
  name = 'CatalogRepositoryError'
}

/** Another tab or operation saved this catalog after the caller loaded it. */
export class RevisionConflictError extends CatalogRepositoryError {
  name = 'RevisionConflictError'

  constructor(
    readonly catalogId: CatalogId,
    readonly expectedRevision: CatalogRevision,
    readonly actualRevision: CatalogRevision | undefined,
  ) {
    super(`Catalog ${catalogId} has revision ${String(actualRevision)}, not expected revision ${expectedRevision}.`)
  }
}

/** Browser storage is blocked, unsupported, or otherwise unavailable. */
export class StorageUnavailableError extends CatalogRepositoryError {
  name = 'StorageUnavailableError'
}

/** The browser refused a write because this origin has insufficient storage space. */
export class StorageQuotaError extends CatalogRepositoryError {
  name = 'StorageQuotaError'
}

/** The repository could not safely migrate an older IndexedDB schema. */
export class StorageMigrationError extends CatalogRepositoryError {
  name = 'StorageMigrationError'

  constructor(
    readonly fromVersion: number,
    readonly toVersion: number,
    message = `Could not migrate browser storage from version ${fromVersion} to version ${toVersion}.`,
  ) {
    super(message)
  }
}
