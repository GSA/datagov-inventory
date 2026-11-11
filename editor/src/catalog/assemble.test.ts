// @vitest-environment node
import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { decompose } from './decompose'
import { assemble, AssembleError, type AssembleErrorCode } from './assemble'

const json = (value: unknown) => JSON.stringify(value)
const catalog = (datasets: unknown[]) => ({ '@type': 'Catalog', dataset: datasets })
const dataset = (title: string, extra: object = {}) => ({ '@type': 'Dataset', title, ...extra })

const failure = (run: () => unknown): [AssembleErrorCode | 'no-error', string] => {
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

    const output = result.output as Record<string, unknown>
    const datasets = output.dataset as Array<Record<string, unknown>>
    expect(datasets[0].title).toBe('Dataset C')
    expect(datasets[1].title).toBe('Dataset A')
    expect(datasets[2].title).toBe('Dataset B')
  })

  it('preserves unknown properties', () => {
    const text = json({
      '@type': 'Catalog',
      'x-custom': 'preserved',
      dataset: [dataset('Test', { 'x-agency': { nested: true } })]
    })
    const decomposed = decompose(text)
    const result = assemble(decomposed)

    const output = result.output as Record<string, unknown>
    const datasets = output.dataset as Array<Record<string, unknown>>
    expect(output['x-custom']).toBe('preserved')
    expect(datasets[0]['x-agency']).toEqual({ nested: true })
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

    const output = result.output as Record<string, unknown>
    const datasets = output.dataset as Array<Record<string, unknown>>
    expect(Array.isArray(datasets[0].contactPoint)).toBe(false)
    expect(datasets[0].contactPoint).toEqual({ fn: 'John' })
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

    const output = result.output as Record<string, unknown>
    const datasets = output.dataset as Array<Record<string, unknown>>
    const distributions = datasets[0].distribution as Array<Record<string, unknown>>
    expect(Array.isArray(distributions)).toBe(true)
    expect(distributions.length).toBe(2)
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

    const output = result.output as Record<string, unknown>
    const datasets = output.dataset as Array<Record<string, unknown>>
    const publisher = datasets[0].publisher as Record<string, unknown>
    const subOrgs = publisher.subOrganizationOf as Array<Record<string, unknown>>
    expect(publisher.name).toBe('EPA')
    expect(subOrgs[0].name).toBe('Federal Gov')
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

    const output = result.output as Record<string, unknown>
    const datasets = output.dataset as Array<Record<string, unknown>>
    const publisher1 = datasets[0].publisher as Record<string, unknown>
    const publisher2 = datasets[1].publisher as Record<string, unknown>

    expect(publisher1).toEqual({ '@type': 'Organization', name: 'Shared Agency' })
    expect(publisher2).toEqual({ '@type': 'Organization', name: 'Shared Agency' })

    publisher1.name = 'Modified'
    expect(publisher2.name).toBe('Shared Agency')
  })

  it('reports shared object IDs', () => {
    const text = json({
      '@type': 'Catalog',
      dataset: [
        { '@type': 'Dataset', title: 'Dataset 1', publisher: { '@type': 'Organization', name: 'Agency' } }
      ]
    })
    const decomposed = decompose(text)

    const dataset2Id = '#/dataset/1'
    const dataset2 = {
      id: dataset2Id,
      dcatClass: 'Dataset',
      properties: { '@type': 'Dataset', title: 'Dataset 2' },
      links: { publisher: ['#/dataset/0/publisher'] },
      singleLinks: ['publisher']
    }
    decomposed.objects.set(dataset2Id, dataset2)

    const catalog = decomposed.objects.get('#')!
    catalog.links.dataset = ['#/dataset/0', dataset2Id]

    const result = assemble(decomposed)

    expect(result.sharedObjects.length).toBeGreaterThan(0)
    expect(result.sharedObjects).toContain('#/dataset/0/publisher')
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
    expect(message.toLowerCase()).toContain('circular reference')
    expect(message).toContain('#')
  })

  it('detects excessive depth', () => {
    const decomposed = decompose(json({ '@type': 'Catalog', dataset: [] }))

    let currentId = '#'
    for (let i = 0; i < 65; i++) {
      const nextId = `${currentId}/dataset/${i}`
      const obj = {
        id: nextId,
        dcatClass: 'Dataset',
        properties: { '@type': 'Dataset', title: `Level ${i}` },
        links: {} as Record<string, string[]>,
        singleLinks: []
      }
      decomposed.objects.set(nextId, obj)

      const parent = decomposed.objects.get(currentId)!
      parent.links.dataset = [nextId]

      currentId = nextId
    }

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

  it.each(valid)('%s round-trips identically', (_name, text) => {
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
