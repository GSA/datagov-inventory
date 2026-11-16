import { describe, expect, it } from 'vitest'
import { decompose } from '../catalog/decompose'
import { IndexedDbCatalogRepository } from './IndexedDbCatalogRepository'

const ids = () => {
  let next = 0
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, '0')}`
}

describe('IndexedDbCatalogRepository scaffold', () => {
  it('assigns stable ids and rewrites every object reference, including nested catalogs', async () => {
    const repository = new IndexedDbCatalogRepository(ids())
    const source = decompose(
      JSON.stringify({
        '@type': 'Catalog',
        title: 'Parent',
        dataset: [{ '@type': 'Dataset', title: 'Dataset' }],
        catalog: [{ '@type': 'Catalog', title: 'Child', dataset: [] }],
      }),
    )

    const workspace = await repository.createCatalog(source, '3.0.0')
    const root = workspace.graph.objects.get(workspace.graph.rootObjectId)!
    const datasetId = root.links.dataset[0]
    const dataset = workspace.graph.objects.get(datasetId)!
    const childCatalogId = root.links.catalog[0]
    const childCatalog = workspace.graph.objects.get(childCatalogId)!

    expect(workspace.graph.objects.size).toBe(3)
    expect(root.id).not.toBe('#')
    expect(dataset.id).not.toBe('#/dataset/0')
    expect(childCatalog.dcatClass).toBe('Catalog')
    expect(childCatalog.id).not.toBe('#/catalog/0')
    expect(root.links.catalog).toEqual([childCatalog.id])
  })

  it('does not retain workspaces while persistence is unimplemented', async () => {
    const repository = new IndexedDbCatalogRepository(ids())
    const workspace = await repository.createCatalog(decompose('{"@type":"Catalog"}'), '3.0.0')

    expect(await repository.listCatalogs()).toEqual([])
    expect(await repository.loadCatalog(workspace.id)).toBeUndefined()
    await expect(repository.saveCatalog(workspace, 1)).resolves.toBe(workspace)
    await expect(repository.deleteCatalog(workspace.id, 1)).resolves.toBeUndefined()
  })
})
