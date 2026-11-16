import type { CatalogGraph, CatalogId, WorkspaceCatalog } from '../catalog/types'
import type { CatalogRepository } from '../storage/CatalogRepository'

/** Catalog persistence use cases exposed to the presentation layer. */
export interface CatalogOperations {
  createCatalog(catalog: CatalogGraph, schemaVersion: string): Promise<WorkspaceCatalog>
  saveCatalog(workspace: WorkspaceCatalog): Promise<WorkspaceCatalog>
  restoreCatalog(id: CatalogId): Promise<WorkspaceCatalog | undefined>
}

/**
 * Application use cases for catalog persistence. React components depend on these
 * operations rather than on storage implementations or low-level repository methods.
 */
export class CatalogService implements CatalogOperations {
  constructor(private readonly repository: CatalogRepository) {}

  createCatalog = (catalog: CatalogGraph, schemaVersion: string): Promise<WorkspaceCatalog> =>
    this.repository.createCatalog(catalog, schemaVersion)

  saveCatalog = (workspace: WorkspaceCatalog): Promise<WorkspaceCatalog> => {
    return this.repository.saveCatalog(workspace, workspace.revision)
  }

  restoreCatalog = (id: CatalogId): Promise<WorkspaceCatalog | undefined> => this.repository.loadCatalog(id)
}
