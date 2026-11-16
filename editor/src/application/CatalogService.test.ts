import { describe, expect, it, vi } from 'vitest'
import type { CatalogGraph, WorkspaceCatalog } from '../catalog/types'
import type { CatalogRepository } from '../storage/CatalogRepository'
import { CatalogService } from './CatalogService'

const decomposed: CatalogGraph = { rootObjectId: '#', objects: new Map() }
const workspace: WorkspaceCatalog = {
  id: 'catalog-id',
  schemaVersion: '3.0.0',
  revision: 1,
  graph: { rootObjectId: 'root-id', objects: new Map() },
}

function repository() {
  return {
    listCatalogs: vi.fn(),
    loadCatalog: vi.fn(),
    createCatalog: vi.fn(),
    saveCatalog: vi.fn(),
    deleteCatalog: vi.fn(),
  } satisfies CatalogRepository
}

describe('CatalogService', () => {
  it('creates a catalog through the repository', async () => {
    const storage = repository()
    storage.createCatalog.mockResolvedValue(workspace)
    const service = new CatalogService(storage)

    const { createCatalog } = service
    await expect(createCatalog(decomposed, '3.0.0')).resolves.toBe(workspace)
    expect(storage.createCatalog).toHaveBeenCalledWith(decomposed, '3.0.0')
  })

  it('saves a catalog with its expected revisions', async () => {
    const storage = repository()
    storage.saveCatalog.mockResolvedValue(workspace)
    const service = new CatalogService(storage)

    await expect(service.saveCatalog(workspace)).resolves.toBe(workspace)
    expect(storage.saveCatalog).toHaveBeenCalledWith(workspace, 1)
  })

  it('restores a catalog through the repository', async () => {
    const storage = repository()
    storage.loadCatalog.mockResolvedValue(workspace)
    const service = new CatalogService(storage)

    await expect(service.restoreCatalog('catalog-id')).resolves.toBe(workspace)
    expect(storage.loadCatalog).toHaveBeenCalledWith('catalog-id')
  })
})
