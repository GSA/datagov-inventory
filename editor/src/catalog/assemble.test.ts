// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fc } from 'fast-check'
import { decompose } from './decompose'
import { assemble, AssembleError, type AssembleErrorCode } from './assemble'

const json = (value: unknown) => JSON.stringify(value)
const catalog = (datasets: unknown[]) => ({ '@type': 'Catalog', dataset: datasets })
const dataset = (title: string, extra: object = {}) => ({ '@type': 'Dataset', title, ...extra })

const failure = (run: () => unknown): [AssembleErrorCode, string] => {
  try {
    run()
    return ['no-error', '']
  } catch (error) {
    if (error instanceof AssembleError) return [error.code, error.message]
    throw error
  }
}

describe('assemble: basic structure', () => {
  it('assembles minimal catalog to nested JSON', () => {
    const text = json(catalog([dataset('Test Dataset')]))
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    expect(result.output).toEqual({
      '@type': 'Catalog',
      dataset: [
        { '@type': 'Dataset', title: 'Test Dataset' }
      ]
    })
  })

  it('preserves array ordering', () => {
    const text = json(catalog([
      dataset('Dataset C'),
      dataset('Dataset A'),
      dataset('Dataset B')
    ]))
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    expect(result.output.dataset[0].title).toBe('Dataset C')
    expect(result.output.dataset[1].title).toBe('Dataset A')
    expect(result.output.dataset[2].title).toBe('Dataset B')
  })

  it('preserves unknown properties', () => {
    const text = json({
      '@type': 'Catalog',
      'x-custom': 'preserved',
      dataset: [dataset('Test', { 'x-agency': { nested: true } })]
    })
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    expect(result.output['x-custom']).toBe('preserved')
    expect(result.output.dataset[0]['x-agency']).toEqual({ nested: true })
  })

  it('uses singleLinks to output scalar vs array', () => {
    const text = json({
      '@type': 'Catalog',
      dataset: [{
        '@type': 'Dataset',
        title: 'Test',
        contactPoint: { fn: 'John' }
      }]
    })
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    expect(Array.isArray(result.output.dataset[0].contactPoint)).toBe(false)
    expect(result.output.dataset[0].contactPoint).toEqual({ fn: 'John' })
  })

  it('outputs arrays for multi-valued links', () => {
    const text = json({
      '@type': 'Catalog',
      dataset: [{
        '@type': 'Dataset',
        title: 'Test',
        distribution: [
          { '@type': 'Distribution', downloadURL: 'http://ex.gov/1.csv' },
          { '@type': 'Distribution', downloadURL: 'http://ex.gov/2.csv' }
        ]
      }]
    })
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    expect(Array.isArray(result.output.dataset[0].distribution)).toBe(true)
    expect(result.output.dataset[0].distribution.length).toBe(2)
  })
})

describe('assemble: nested objects', () => {
  it('assembles nested object hierarchy', () => {
    const text = json({
      '@type': 'Catalog',
      dataset: [{
        '@type': 'Dataset',
        title: 'Test',
        publisher: {
          '@type': 'Organization',
          name: 'EPA',
          subOrganizationOf: [{ '@type': 'Organization', name: 'Federal Gov' }]
        }
      }]
    })
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    expect(result.output.dataset[0].publisher.name).toBe('EPA')
    expect(result.output.dataset[0].publisher.subOrganizationOf[0].name).toBe('Federal Gov')
  })
})

describe('assemble: shared objects', () => {
  it('duplicates shared objects at each reference point', () => {
    const sharedOrg = { '@type': 'Organization', name: 'Shared Agency' }
    const text = json({
      '@type': 'Catalog',
      dataset: [
        { '@type': 'Dataset', title: 'Dataset 1', publisher: sharedOrg },
        { '@type': 'Dataset', title: 'Dataset 2', publisher: sharedOrg }
      ]
    })
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    expect(result.output.dataset[0].publisher).toEqual({ '@type': 'Organization', name: 'Shared Agency' })
    expect(result.output.dataset[1].publisher).toEqual({ '@type': 'Organization', name: 'Shared Agency' })

    result.output.dataset[0].publisher.name = 'Modified'
    expect(result.output.dataset[1].publisher.name).toBe('Shared Agency')
  })

  it('reports shared object IDs', () => {
    const sharedOrg = { '@type': 'Organization', name: 'Shared Agency' }
    const text = json({
      '@type': 'Catalog',
      dataset: [
        { '@type': 'Dataset', title: 'Dataset 1', publisher: sharedOrg },
        { '@type': 'Dataset', title: 'Dataset 2', publisher: sharedOrg }
      ]
    })
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    expect(result.sharedObjects.length).toBeGreaterThan(0)
  })

  it('reports no shared objects when none exist', () => {
    const text = json({
      '@type': 'Catalog',
      dataset: [
        { '@type': 'Dataset', title: 'Dataset 1', publisher: { '@type': 'Organization', name: 'Agency 1' } },
        { '@type': 'Dataset', title: 'Dataset 2', publisher: { '@type': 'Organization', name: 'Agency 2' } }
      ]
    })
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    expect(result.sharedObjects.length).toBe(0)
  })
})

describe('assemble: error handling', () => {
  it('detects circular references', () => {
    const decomposed = decompose(json({ '@type': 'Catalog', dataset: [] }))

    const catalog = decomposed.objects.get('#')!
    catalog.links.self = ['#']

    const [code, message] = failure(() => assemble(decomposed))
    expect(code).toBe('circular-reference')
    expect(message).toContain('circular reference')
    expect(message).toContain('#')
  })

  it('detects excessive depth', () => {
    const nested: Record<string, unknown> = { '@type': 'Catalog', dataset: [] }
    let current: Record<string, unknown> = nested
    for (let i = 0; i < 70; i++) {
      const newDataset = { '@type': 'Dataset', title: `Level ${i}`, distribution: [] }
      current.dataset = [newDataset]
      current = newDataset
    }

    const decomposed = decompose(json(nested))
    const [code, message] = failure(() => assemble(decomposed))
    expect(code).toBe('max-depth-exceeded')
    expect(message).toContain('64')
  })

  it('reports missing object error', () => {
    const decomposed = decompose(json({ '@type': 'Catalog', dataset: [] }))

    const catalog = decomposed.objects.get('#')!
    catalog.links.dataset = ['#/dataset/999']

    const [code, message] = failure(() => assemble(decomposed))
    expect(code).toBe('missing-object')
    expect(message).toContain('#/dataset/999')
  })
})

describe('assemble: round-trip validation', () => {
  const load = (files: Record<string, string>) =>
    Object.entries(files).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text] as const)

  const valid = load(import.meta.glob<string>('../../fixtures/catalogs/valid/*.json', { eager: true, query: '?raw', import: 'default' }))

  it.each(valid)('%s round-trips identically', (name, text) => {
    const original = decompose(text)
    const result = assemble(original)
    const roundTripped = decompose(json(result.output))

    expect(roundTripped.rootId).toBe(original.rootId)
    expect(roundTripped.objects.size).toBe(original.objects.size)

    for (const [id, obj] of original.objects) {
      const rtObj = roundTripped.objects.get(id)!
      expect(rtObj.dcatClass).toBe(obj.dcatClass)
      expect(rtObj.properties).toEqual(obj.properties)
      expect(rtObj.links).toEqual(obj.links)
      expect(rtObj.singleLinks).toEqual(obj.singleLinks)
    }
  })
})

describe('assemble: property-based ordering', () => {
  it('maintains ordering with varying child counts', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          childCount: fc.integer({ min: 0, max: 5 })
        }), { minLength: 1, maxLength: 10 }),
        (datasets) => {
          const catalog = {
            '@type': 'Catalog',
            dataset: datasets.map(({ title, childCount }) => ({
              '@type': 'Dataset',
              title,
              distribution: Array.from({ length: childCount }, (_, i) => ({
                '@type': 'Distribution',
                downloadURL: `http://example.gov/${title}/${i}.csv`
              }))
            }))
          }

          const text = json(catalog)
          const decomposed = decompose(text)
          const result = assemble(decomposed)

          const output = result.output as Record<string, unknown>
          const outputDatasets = output.dataset as Array<Record<string, unknown>>
          expect(outputDatasets.map(d => d.title)).toEqual(datasets.map(d => d.title))

          outputDatasets.forEach((ds, i: number) => {
            const distributions = ds.distribution as Array<Record<string, unknown>>
            expect(distributions.length).toBe(datasets[i].childCount)
            distributions.forEach((dist, j: number) => {
              expect(dist.downloadURL).toBe(`http://example.gov/${datasets[i].title}/${j}.csv`)
            })
          })
        }
      ),
      { seed: 42, numRuns: 50 }
    )
  })

  it('maintains ordering with empty, single, and multiple children', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(
          fc.constant([]),
          fc.array(fc.string(), { minLength: 1, maxLength: 1 }),
          fc.array(fc.string(), { minLength: 2, maxLength: 5 })
        ), { minLength: 1, maxLength: 10 }),
        (datasetKeywords) => {
          const catalog = {
            '@type': 'Catalog',
            dataset: datasetKeywords.map((keywords, i) => ({
              '@type': 'Dataset',
              title: `Dataset ${i}`,
              keyword: keywords
            }))
          }

          const text = json(catalog)
          const decomposed = decompose(text)
          const result = assemble(decomposed)

          const output = result.output as Record<string, unknown>
          const outputDatasets = output.dataset as Array<Record<string, unknown>>
          outputDatasets.forEach((ds, i: number) => {
            if (Array.isArray(ds.keyword)) {
              expect(ds.keyword).toEqual(datasetKeywords[i])
            } else if (datasetKeywords[i].length === 0) {
              expect(ds.keyword).toEqual([])
            }
          })
        }
      ),
      { seed: 123, numRuns: 50 }
    )
  })
})
