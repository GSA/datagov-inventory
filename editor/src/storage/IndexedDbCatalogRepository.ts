import type { CatalogGraph, CatalogId, CatalogObject, CatalogRevision, WorkspaceCatalog } from '../catalog/types'
import type {
  CatalogRepository,
  CatalogSummary,
} from './CatalogRepository'

type CreateId = () => string

/**
 * Temporary repository scaffold. It performs the one-time conversion to durable graph
 * identifiers, but does not open IndexedDB or retain anything between calls yet.
 */
export class IndexedDbCatalogRepository implements CatalogRepository {
  constructor(private readonly createId: CreateId = () => crypto.randomUUID()) {}

  async listCatalogs(): Promise<CatalogSummary[]> {
    return []
  }

  async loadCatalog(id: CatalogId): Promise<WorkspaceCatalog | undefined> {
    void id
    return undefined
  }

  async createCatalog(catalog: CatalogGraph, schemaVersion: string): Promise<WorkspaceCatalog> {
    const objectIds = new Map([...catalog.objects.keys()].map((id) => [id, this.createId()]))
    const objects = new Map<string, CatalogObject>()

    for (const object of catalog.objects.values()) {
      const links: Record<string, string[]> = Object.create(null)
      for (const [property, childIds] of Object.entries(object.links)) {
        links[property] = childIds.map((childId) => requiredId(objectIds, childId))
      }

      const id = requiredId(objectIds, object.id)
      const workspaceObject: CatalogObject = {
        ...object,
        id,
        links,
      }
      objects.set(id, workspaceObject)
    }

    return {
      id: this.createId(),
      schemaVersion,
      revision: 1,
      graph: {
        rootObjectId: requiredId(objectIds, catalog.rootObjectId),
        objects,
      },
    }
  }

  async saveCatalog(workspace: WorkspaceCatalog, expectedRevision: CatalogRevision): Promise<WorkspaceCatalog> {
    void expectedRevision
    return workspace
  }

  async deleteCatalog(id: CatalogId, expectedRevision: number): Promise<void> {
    void id
    void expectedRevision
  }
}

function requiredId<T>(ids: ReadonlyMap<string, T>, sourceId: string): T {
  const id = ids.get(sourceId)
  if (id === undefined) throw new Error(`Catalog object ${sourceId} is not reachable from the root.`)
  return id
}
