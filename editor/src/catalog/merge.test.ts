// @vitest-environment node
// Identical objects merged on import (ADR 0008, GSA/data.gov#6546), from import through an edit to export.
import { describe, expect, it } from 'vitest'
import { decompose } from './decompose'
import { identifyGraph } from './identify'
import { updateObject } from './edit'
import { usesOf } from './uses'
import { assemble } from './assemble'
import { validateDocument } from '../schema/validator'
import { largeCatalog } from '../../fixtures/largeCatalog'

const load = (files: Record<string, string>) =>
  Object.entries(files).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text] as const)
const valid = load(import.meta.glob<string>('../../fixtures/catalogs/valid/*.json', { eager: true, query: '?raw', import: 'default' }))

/** The SSA catalog James loaded, in small: the catalog and each dataset name the same publisher. */
const ssa = { '@type': 'Organization', name: 'Social Security Administration' }
const ssaCatalog = {
  '@type': 'Catalog',
  title: 'SSA data catalog',
  publisher: ssa,
  dataset: ['Disability claims', 'Retirement benefits', 'Field offices'].map((title, i) => ({
    '@type': 'Dataset',
    title,
    description: `${title}, by state.`,
    identifier: `https://www.ssa.gov/data/${i}`,
    keyword: ['social security'],
    contactPoint: { '@type': 'Kind', fn: 'Open Data Team', hasEmail: 'mailto:open.data@ssa.gov' },
    publisher: { ...ssa },
  })),
}

describe('identical objects merged on import', () => {
  it('shows an edit to the shared publisher in every place it is used', () => {
    const imported = decompose(JSON.stringify(ssaCatalog))
    expect(imported.merged).toBe(5) // 3 publishers and 2 contacts
    const catalog = identifyGraph(imported)
    const publisherId = catalog.objects.get(catalog.rootId)!.links.publisher[0]
    expect(usesOf(catalog).get(publisherId)).toHaveLength(4) // "Used in 4 places"

    const publisher = catalog.objects.get(publisherId)!
    const edited = updateObject(catalog, publisherId, { properties: { ...publisher.properties, altLabel: 'SSA' } })

    const output = assemble(edited).output as typeof ssaCatalog
    const withAltLabel = { ...ssa, altLabel: 'SSA' }
    expect(output.publisher).toEqual(withAltLabel)
    expect(output.dataset.map((dataset) => dataset.publisher)).toEqual([withAltLabel, withAltLabel, withAltLabel])
    expect(validateDocument(output), JSON.stringify(validateDocument.errors)).toBe(true)
  })

  it.each([...valid, ['largeCatalog (3,000 datasets)', JSON.stringify(largeCatalog())] as const])(
    '%s exports, unedited, as the same JSON (key order aside), still valid, and loads again the same',
    (_name, text) => {
      const imported = decompose(text)
      const { output } = assemble(imported)
      expect(output).toEqual(JSON.parse(text))
      expect(validateDocument(output), JSON.stringify(validateDocument.errors)).toBe(true)
      const reloaded = decompose(JSON.stringify(output))
      expect(reloaded.merged).toBe(imported.merged)
      expect([...reloaded.objects.keys()]).toEqual([...imported.objects.keys()])
    },
  )
})
