import type { CatalogWorkspace } from '../catalog/types'

/** Lightweight metadata used to discover working copies without reconstructing their graphs. */
export interface SavedCatalogSummary {
  id: string
  title: string
  sourceName: string
  objectCount: number
  createdAt: number
  updatedAt: number
}

/** Persistence boundary for identified catalog working copies. */
export interface CatalogRepository {
  /** Lists saved catalog, most recently saved first. */
  listCatalogs(): Promise<SavedCatalogSummary[]>

  /**
   * Stores a newly accepted working copy and its complete graph atomically. Fails if the
   * catalog identity already exists; callers should not open the editor until this resolves.
   */
  createCatalog(catalog: CatalogWorkspace): Promise<void>

  /**
   * Persists the latest state of an existing working copy atomically. Implementations may
   * update only changed graph records, but a successful resolution means the whole supplied
   * workspace is durable. Rejects with {@link CatalogStorageError} when it cannot be saved.
   */
  saveCatalog(catalog: CatalogWorkspace): Promise<void>

  /**
   * Reconstructs one complete working copy by stable catalog identity. Returns `undefined`
   * when no matching catalog exists, and rejects when storage is unavailable or its records
   * do not form a valid graph.
   */
  loadCatalog(id: string): Promise<CatalogWorkspace | undefined>

  /** Transactionally removes the identified working copies and all of their scoped records. */
  deleteCatalogs(ids: readonly string[]): Promise<void>

  /** Transactionally removes every working copy managed by this repository. */
  deleteAllCatalogs(): Promise<void>
}

/**
 * Stable categories for browser-storage failures.
 *
 * - `unavailable`: IndexedDB is unsupported or disabled.
 * - `blocked`: another open connection prevents opening or upgrading the database.
 * - `quota`: the browser rejected a write because storage is full.
 * - `failed`: an otherwise unclassified IndexedDB request or transaction failed.
 * - `invalid-data`: stored records do not form a complete, valid catalog graph.
 */
export type CatalogStorageErrorCode = 'unavailable' | 'blocked' | 'quota' | 'failed' | 'invalid-data'

export class CatalogStorageError extends Error {
  name = 'CatalogStorageError'
  constructor(readonly code: CatalogStorageErrorCode, message: string) {
    super(message)
  }
}
