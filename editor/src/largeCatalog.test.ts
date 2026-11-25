// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { largeCatalog } from '../fixtures/largeCatalog'
import { validateDocument } from './generated/validateDocument'

// The generator behind the perf specs and `npm run generate:catalogs` (#29).
describe('largeCatalog', () => {
  it.each([300, 1_000, 3_000, 6_000])('generates %i datasets, each with a contact, the publisher and 3 distributions', (datasets) => {
    const catalog = largeCatalog(datasets)
    expect(catalog.title).toBe(`Generated catalog of ${datasets.toLocaleString('en-US')} datasets`)
    expect(catalog.dataset).toHaveLength(datasets)
    for (const dataset of catalog.dataset) {
      expect(dataset.contactPoint['@type']).toBe('Kind')
      expect(dataset.publisher).toEqual({ '@type': 'Organization', name: 'Example Agency' })
      expect(dataset.distribution).toHaveLength(3)
    }
    // Unique identifiers and contacts, so only the shared publisher merges on import.
    expect(new Set(catalog.dataset.map((d) => d.identifier)).size).toBe(datasets)
    expect(new Set(catalog.dataset.map((d) => d.contactPoint.hasEmail)).size).toBe(datasets)
  })

  it('generates the same catalog each time', () => {
    expect(JSON.stringify(largeCatalog(1_000))).toBe(JSON.stringify(largeCatalog(1_000)))
  })

  it('generates a valid DCAT-US 3.0 catalog', () => {
    expect(validateDocument(largeCatalog(300)), JSON.stringify(validateDocument.errors)).toBe(true)
  })
})
