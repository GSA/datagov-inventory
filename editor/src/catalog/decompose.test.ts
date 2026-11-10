// @vitest-environment node
// Runs without a DOM, which proves decompose needs none (it must also run in a worker).
import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS, DecomposeError, checkSize, decompose, type DecomposedCatalog } from './decompose'

const load = (files: Record<string, string>) =>
  Object.entries(files).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text] as const)
const valid = load(import.meta.glob<string>('../../fixtures/catalogs/valid/*.json', { eager: true, query: '?raw', import: 'default' }))
const invalid = load(import.meta.glob<string>('../../fixtures/catalogs/invalid/*.json', { eager: true, query: '?raw', import: 'default' }))
const fixture = (name: string) => [...valid, ...invalid].find(([n]) => n === name)![1]

const countByClass = ({ objects }: DecomposedCatalog) => {
  const counts: Record<string, number> = {}
  for (const { dcatClass } of objects.values()) counts[dcatClass] = (counts[dcatClass] ?? 0) + 1
  return counts
}
const json = (value: unknown) => JSON.stringify(value)
const plain = (record: object) => ({ ...record })

/** Objects per class each fixture decomposes into. Schema errors never stop a fixture loading. */
const expectedCounts: Record<string, Record<string, number>> = {
  'dataset-with-distributions.json': {
    Catalog: 1, Organization: 2, Dataset: 1, Kind: 1, PeriodOfTime: 1, Distribution: 2, Checksum: 1,
  },
  'minimal-catalog.json': { Catalog: 1, Dataset: 1, Kind: 1 },
  'nullable-optional-properties.json': { Catalog: 1, Dataset: 1, Kind: 1 },
  'contact-email-not-mailto.json': { Catalog: 1, Dataset: 1, Kind: 1 },
  'dataset-missing-title.json': { Catalog: 1, Dataset: 1, Kind: 1 },
  'dataset-not-an-array.json': { Catalog: 1, Dataset: 1, Kind: 1 },
  'distribution-download-url-not-an-iri.json': { Catalog: 1, Dataset: 1, Kind: 1, Distribution: 1 },
  'issued-not-a-date.json': { Catalog: 1, Dataset: 1, Kind: 1 },
  'missing-dataset.json': { Catalog: 1 },
  'modified-date-time-without-t.json': { Catalog: 1, Dataset: 1, Kind: 1 },
  'unknown-accrual-periodicity.json': { Catalog: 1, Dataset: 1, Kind: 1 },
}

describe('decompose: fixture catalogs', () => {
  it('has an expected count for every fixture', () => {
    expect([...valid, ...invalid].map(([name]) => name).sort()).toEqual(Object.keys(expectedCounts).sort())
  })

  it.each([...valid, ...invalid])('%s decomposes into the expected objects', (name, text) => {
    const catalog = decompose(text)
    expect(catalog.rootId).toBe('#')
    expect(catalog.objects.get('#')?.dcatClass).toBe('Catalog')
    expect(countByClass(catalog)).toEqual(expectedCounts[name])
  })

  it('splits a dataset into its own scalars and ordered links, by the schema', () => {
    const { objects } = decompose(fixture('dataset-with-distributions.json'))
    expect([...objects.keys()]).toEqual([
      '#',
      '#/publisher',
      '#/dataset/0',
      '#/dataset/0/contactPoint/0',
      '#/dataset/0/publisher',
      '#/dataset/0/temporal/0',
      '#/dataset/0/distribution/0',
      '#/dataset/0/distribution/0/checksum',
      '#/dataset/0/distribution/1',
    ])
    const dataset = objects.get('#/dataset/0')!
    expect(dataset.dcatClass).toBe('Dataset')
    expect(plain(dataset.properties)).toEqual({
      '@id': 'https://example.gov/datasets/qualité-de-l-air',
      '@type': 'Dataset',
      title: 'Air quality readings',
      description: 'Hourly readings from example monitoring stations.',
      identifier: 'example-air-quality',
      keyword: ['air quality', 'monitoring'],
      // theme holds Concepts, but a Concept may be a plain string: it stays a scalar.
      theme: ['Environment'],
      issued: '2024-01-15',
      modified: '2025-06-30T12:00:00Z',
      accrualPeriodicity: 'daily',
      language: ['en'],
    })
    expect(plain(dataset.links)).toEqual({
      contactPoint: ['#/dataset/0/contactPoint/0'],
      publisher: ['#/dataset/0/publisher'],
      temporal: ['#/dataset/0/temporal/0'],
      distribution: ['#/dataset/0/distribution/0', '#/dataset/0/distribution/1'],
    })
    expect(dataset.singleLinks).toEqual(['publisher'])
    expect(plain(objects.get('#/dataset/0/distribution/0')!.links)).toEqual({
      checksum: ['#/dataset/0/distribution/0/checksum'],
    })
    expect(plain(objects.get('#/dataset/0/distribution/0/checksum')!.properties)).toEqual({
      '@type': 'Checksum',
      algorithm: 'SHA-256',
      checksumValue: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    })
  })

  it('takes the class from the schema when an object has no @type', () => {
    const { objects } = decompose(fixture('minimal-catalog.json'))
    expect(objects.get('#/dataset/0/contactPoint')).toEqual(
      expect.objectContaining({ dcatClass: 'Kind', singleLinks: [] }),
    )
    expect(objects.get('#/dataset/0')!.singleLinks).toEqual(['contactPoint'])
  })

  it('keeps null class-valued properties as properties', () => {
    const dataset = decompose(fixture('nullable-optional-properties.json')).objects.get('#/dataset/0')!
    expect(dataset.properties).toEqual(expect.objectContaining({ publisher: null, distribution: null, keyword: null }))
    expect(Object.keys(dataset.links)).toEqual(['contactPoint'])
  })

  it('loads a document with schema errors: a single dataset where an array is required', () => {
    const catalog = decompose(fixture('dataset-not-an-array.json')).objects.get('#')!
    expect(plain(catalog.links)).toEqual({ dataset: ['#/dataset'] })
    expect(catalog.singleLinks).toEqual(['dataset'])
  })
})

describe('decompose: shape rules', () => {
  const catalogOf = (datasets: unknown[], extra: object = {}) => json({ '@type': 'Catalog', ...extra, dataset: datasets })
  const dataset = (title: string, extra: object = {}) => ({ '@type': 'Dataset', title, ...extra })

  it('keeps array order in links and in scalar arrays', () => {
    const { objects } = decompose(
      catalogOf([dataset('C', { keyword: ['z', 'a', 'm'] }), dataset('A'), dataset('B')]),
    )
    const titles = objects.get('#')!.links.dataset.map((id) => objects.get(id)!.properties.title)
    expect(titles).toEqual(['C', 'A', 'B'])
    expect(objects.get('#/dataset/0')!.properties.keyword).toEqual(['z', 'a', 'm'])
  })

  it('keeps identical objects separate, even with the same @id', () => {
    const twin = dataset('Twin', { '@id': 'https://example.gov/same', publisher: { name: 'Agency' } })
    const { objects } = decompose(catalogOf([twin, twin]))
    expect(countByClass({ rootId: '#', objects })).toEqual({ Catalog: 1, Dataset: 2, Organization: 2 })
    expect(objects.get('#')!.links.dataset).toEqual(['#/dataset/0', '#/dataset/1'])
  })

  it('keeps unknown properties unchanged, including nested objects, and does not decompose them', () => {
    const unknown = { nested: [1, { '@type': 'Dataset', title: 'not a link' }], flag: true }
    const { objects } = decompose(catalogOf([dataset('A', { 'x-agency': unknown, rank: 3 })], { 'x-extra': 'kept' }))
    expect(objects.get('#')!.properties['x-extra']).toBe('kept')
    expect(objects.get('#/dataset/0')!.properties).toEqual(expect.objectContaining({ 'x-agency': unknown, rank: 3 }))
    expect(objects.size).toBe(2)
  })

  it('keeps __proto__, constructor and prototype keys as plain data without polluting prototypes', () => {
    const text =
      '{"@type":"Catalog","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},' +
      '"dataset":[{"@type":"Dataset","title":"A","toString":"x","hasOwnProperty":1,"__proto__":{"@type":"Dataset"}}]}'
    const { objects } = decompose(text)
    const root = objects.get('#')!
    expect(Object.getPrototypeOf(root.properties)).toBeNull()
    expect(Object.getPrototypeOf(root.links)).toBeNull()
    expect(Object.keys(root.properties)).toEqual(['@type', '__proto__', 'constructor'])
    expect(root.properties['__proto__']).toEqual({ polluted: true })
    expect(root.properties['constructor']).toEqual({ prototype: { polluted: true } })
    expect(Object.keys(objects.get('#/dataset/0')!.properties)).toEqual([
      '@type', 'title', 'toString', 'hasOwnProperty', '__proto__',
    ])
    expect(objects.size).toBe(2)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('keeps a class-valued property as written when it is not an object or a list of objects', () => {
    const mixed = ['Environment', { '@type': 'Concept', prefLabel: 'Air' }]
    const dataset0 = decompose(catalogOf([dataset('A', { theme: mixed, distribution: [] })])).objects.get('#/dataset/0')!
    expect(dataset0.properties).toEqual(expect.objectContaining({ theme: mixed, distribution: [] }))
    expect(Object.keys(dataset0.links)).toEqual([])
  })

  it('uses a recognised @type over the schema, and the schema for an unknown @type', () => {
    const { objects } = decompose(
      json({ '@type': 'Catalog', publisher: { '@type': 'Organization', name: 'A' }, contactPoint: [{ '@type': 'vcard:Kind' }] }),
    )
    expect(objects.get('#/publisher')!.dcatClass).toBe('Organization') // the schema says Agent
    expect(objects.get('#/contactPoint/0')!.dcatClass).toBe('Kind')
  })

  it('follows a class into itself ("$ref": "#") and escapes ids as JSON Pointers', () => {
    const { objects } = decompose(json({ '@type': 'Catalog', catalog: [{ '@type': 'Catalog', dataset: [dataset('A')] }] }))
    expect([...objects.keys()]).toEqual(['#', '#/catalog/0', '#/catalog/0/dataset/0'])
  })

  it('treats a top level with no @type but Catalog properties as a Catalog, and accepts any DCAT class at the top', () => {
    expect(decompose(json({ dataset: [] })).objects.get('#')!.dcatClass).toBe('Catalog')
    expect(decompose(json({ '@type': 'Dataset', title: 'A' })).objects.get('#')!.dcatClass).toBe('Dataset')
  })

  it('ignores a UTF-8 byte order mark and keeps unicode as written', () => {
    const { objects } = decompose(`\uFEFF${catalogOf([dataset('Qualité 🌫️ \u202Etxt.exe')])}`)
    expect(objects.get('#/dataset/0')!.properties.title).toBe('Qualité 🌫️ \u202Etxt.exe')
  })
})

describe('decompose: bad input', () => {
  it.each([
    ['empty input', '', 'invalid-json'],
    ['truncated JSON', '{"@type": "Catalog", "dataset": [', 'invalid-json'],
    ['not JSON', 'Catalog', 'invalid-json'],
    ['a JSON array', '[{"@type": "Catalog"}]', 'no-dcat-class'],
    ['JSON null', 'null', 'no-dcat-class'],
    ['a JSON number', '42', 'no-dcat-class'],
    ['a JSON string', '"Catalog"', 'no-dcat-class'],
    ['an empty object', '{}', 'no-dcat-class'],
    ['an object with no DCAT properties', '{"name": "x"}', 'no-dcat-class'],
    ['an unknown @type', '{"@type": "Spreadsheet", "dataset": []}', 'no-dcat-class'],
    ['an inherited name as @type', '{"@type": "constructor", "dataset": []}', 'no-dcat-class'],
    ['a non-string @type', '{"@type": ["Catalog"], "dataset": []}', 'no-dcat-class'],
  ])('refuses %s with a clear error', (_case, text, code) => {
    expect(() => decompose(text)).toThrow(DecomposeError)
    expect(() => decompose(text)).toThrow(
      code === 'invalid-json' ? /^This is not valid JSON: / : /^No DCAT-US 3\.0 class found: .*"@type": "Catalog"/,
    )
    try {
      decompose(text)
    } catch (error) {
      expect((error as DecomposeError).code).toBe(code)
    }
  })
})

it('names DCAT-US 1.1 when a data.json file is given', () => {
  expect(() => decompose('{"@type": "dcat:Catalog", "conformsTo": "https://project-open-data.cio.gov/v1.1/schema", "dataset": []}')).toThrow(
    'No DCAT-US 3.0 class found: this looks like a DCAT-US 1.1 data.json file. The editor reads DCAT-US 3.0 only.',
  )
})

describe('decompose: limits', () => {
  const nested = (levels: number) => `{"@type":"Catalog","x":${'['.repeat(levels - 1)}${']'.repeat(levels - 1)}}`
  const codeOf = (run: () => unknown) => {
    try {
      run()
    } catch (error) {
      return [(error as DecomposeError).code, (error as Error).message]
    }
    return ['none', '']
  }

  it('refuses input over maxBytes, counting UTF-8 bytes, and names the limit', () => {
    const text = json({ '@type': 'Catalog', title: 'é'.repeat(60) }) // 90 characters, 150 bytes
    expect(text.length).toBeLessThan(100)
    expect(codeOf(() => decompose(text, { maxBytes: 100 }))).toEqual([
      'too-large',
      'This document is 150 bytes, over the 100 bytes size limit.',
    ])
    expect(() => decompose(text, { maxBytes: 150 })).not.toThrow()
    // Far over the limit, it is refused by its length without being encoded.
    expect(codeOf(() => decompose('x'.repeat(1_000), { maxBytes: 100 }))[1]).toBe(
      'This document is 1,000 bytes, over the 100 bytes size limit.',
    )
  })

  it('checks a file size before it is read, naming the default limit', () => {
    expect(codeOf(() => checkSize(30_200_000))).toEqual([
      'too-large',
      'This document is 30,200,000 bytes, over the 25 MB size limit.',
    ])
    expect(() => checkSize(DEFAULT_LIMITS.maxBytes)).not.toThrow()
  })

  it('refuses nesting deeper than maxDepth before parsing, and names the limit', () => {
    expect(() => decompose(nested(5), { maxDepth: 5 })).not.toThrow()
    expect(codeOf(() => decompose(nested(6), { maxDepth: 5 }))).toEqual([
      'too-deep',
      'This document is nested more than 5 levels deep, the limit.',
    ])
    // Checked on the raw text, so a bomb that is also invalid JSON is still refused as too deep.
    expect(codeOf(() => decompose('['.repeat(100_000)))[0]).toBe('too-deep')
  })

  it('does not count brackets inside strings, including after escaped quotes', () => {
    expect(() => decompose(json({ '@type': 'Catalog', title: '[[[[[[{{{{{{\\"[[[[' }), { maxDepth: 2 })).not.toThrow()
  })

  it('refuses more than maxObjects objects and names the limit', () => {
    const text = json({ '@type': 'Catalog', dataset: [{ title: 'A' }, { title: 'B' }] })
    expect(() => decompose(text, { maxObjects: 3 })).not.toThrow()
    expect(codeOf(() => decompose(text, { maxObjects: 2 }))).toEqual([
      'too-many-objects',
      'This document has more than 2 objects, the limit.',
    ])
  })

  it('fits 3,000 rich datasets within the default limits', () => {
    const datasets = Array.from({ length: 3_000 }, (_, i) => ({
      '@type': 'Dataset',
      title: `Dataset ${i}`,
      description: 'A generated dataset with the usual recommended properties filled in. '.repeat(4),
      identifier: `https://example.gov/datasets/${i}`,
      keyword: ['one', 'two', 'three'],
      contactPoint: { '@type': 'Kind', fn: 'Data Team', hasEmail: 'mailto:data@example.gov' },
      publisher: { '@type': 'Organization', name: 'Example Agency' },
      distribution: [1, 2, 3].map((n) => ({ '@type': 'Distribution', downloadURL: `https://example.gov/${i}/${n}.csv` })),
    }))
    const text = json({ '@type': 'Catalog', dataset: datasets })
    expect(decompose(text).objects.size).toBe(1 + 3_000 * 6)
  })
})
