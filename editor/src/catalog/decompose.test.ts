// @vitest-environment node
// Runs without a DOM, which proves decompose needs none (it must also run in a worker).
import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS, DecomposeError, checkSize, decompose, type DecomposedCatalog } from './decompose'
import { largeCatalog } from '../../fixtures/largeCatalog'

const load = (files: Record<string, string>) =>
  Object.entries(files).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text] as const)
const valid = load(import.meta.glob<string>('../../fixtures/catalogs/valid/*.json', { eager: true, query: '?raw', import: 'default' }))
const invalid = load(import.meta.glob<string>('../../fixtures/catalogs/invalid/*.json', { eager: true, query: '?raw', import: 'default' }))

const countByClass = ({ objects }: DecomposedCatalog) => {
  const counts: Record<string, number> = {}
  for (const { dcatClass } of objects.values()) counts[dcatClass] = (counts[dcatClass] ?? 0) + 1
  return counts
}
const json = (value: unknown) => JSON.stringify(value)
/** The code and message decompose fails with. */
const failure = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    if (error instanceof DecomposeError) return [error.code, error.message]
    throw error
  }
  return ['no error']
}

/** The plain JSON form of a decomposed catalog, as stored in fixtures/decomposed for other implementations to share. */
const plainForm = ({ rootId, objects }: DecomposedCatalog) => ({
  rootId,
  objects: [...objects.values()].map((o) => ({ ...o, properties: { ...o.properties }, links: { ...o.links } })),
})

describe('decompose: fixture catalogs', () => {
  // Byte for byte, so ids, classes, scalars, link order and singleLinks are all part of the contract.
  // Regenerate with `npx vitest run -u` and review the diff.
  it.each(valid)('%s decomposes exactly as fixtures/decomposed records', async (name, text) => {
    await expect(`${JSON.stringify(plainForm(decompose(text)), null, 2)}\n`).toMatchFileSnapshot(
      `../../fixtures/decomposed/${name}`,
    )
  })

  it('has a golden file for each valid fixture and no others', () => {
    const golden = Object.keys(import.meta.glob('../../fixtures/decomposed/*.json')).map((path) => path.slice(path.lastIndexOf('/') + 1))
    expect(golden.sort()).toEqual(valid.map(([name]) => name).sort())
  })

  // Schema errors never stop a document loading.
  const invalidCounts: Record<string, Record<string, number>> = {
    'contact-email-not-mailto.json': { Catalog: 1, Dataset: 1, Kind: 1 },
    'dataset-missing-title.json': { Catalog: 1, Dataset: 1, Kind: 1 },
    'dataset-not-an-array.json': { Catalog: 1, Dataset: 1, Kind: 1 },
    'distribution-download-url-not-an-iri.json': { Catalog: 1, Dataset: 1, Kind: 1, Distribution: 1 },
    'issued-not-a-date.json': { Catalog: 1, Dataset: 1, Kind: 1 },
    'missing-dataset.json': { Catalog: 1 },
    'modified-date-time-without-t.json': { Catalog: 1, Dataset: 1, Kind: 1 },
    'unknown-accrual-periodicity.json': { Catalog: 1, Dataset: 1, Kind: 1 },
  }
  it.each(invalid)('%s, which has schema errors, still decomposes', (name, text) => {
    const catalog = decompose(text)
    expect(catalog.objects.get(catalog.rootId)?.dcatClass).toBe('Catalog')
    expect(countByClass(catalog)).toEqual(invalidCounts[name])
  })

  it('links a single dataset where the schema requires an array, and records it as single', () => {
    const [, text] = invalid.find(([name]) => name === 'dataset-not-an-array.json')!
    const catalog = decompose(text).objects.get('#')!
    expect(catalog.links).toEqual({ dataset: ['#/dataset'] })
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
    expect(Object.keys(objects.get('#/dataset/0')!.properties)).toEqual(['@type', 'title', 'toString', 'hasOwnProperty', '__proto__'])
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

  it('takes the class from the schema, or a subclass @type, and keeps the @type', () => {
    const { objects } = decompose(
      json({
        '@type': 'Catalog',
        publisher: { '@type': 'Organization', name: 'A', subOrganizationOf: [{ name: 'Parent' }] },
        creator: { name: 'An agent' },
        contactPoint: [{ '@type': 'vcard:Kind' }],
        dataset: [{ '@type': 'Catalog', dataset: [{}] }],
      }),
    )
    // The schema allows an Agent; an Organization is one, so its own links are followed.
    expect(objects.get('#/publisher')!.dcatClass).toBe('Organization')
    expect(objects.get('#/publisher/subOrganizationOf/0')!.dcatClass).toBe('Organization')
    expect(objects.get('#/creator')!.dcatClass).toBe('Agent')
    expect(objects.get('#/contactPoint/0')!.dcatClass).toBe('Kind')
    // A Catalog in a dataset slot is decomposed as the Dataset the schema expects: its "dataset" is unknown to Dataset.
    expect(objects.get('#/dataset/0')!.dcatClass).toBe('Dataset')
    expect(objects.get('#/dataset/0')!.properties.dataset).toEqual([{}])
    expect(objects.size).toBe(6)
  })

  it('follows a class into itself ("$ref": "#") and ids it by JSON Pointer', () => {
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
  const notJson = /^This is not valid JSON: /
  const noClass = /^No DCAT-US 3\.0 class found: .*"@type": "Catalog"/
  const empty = /^This document is empty\.$/
  const v11 = /^No DCAT-US 3\.0 class found: this looks like a DCAT-US 1\.1 data\.json file\. The editor reads DCAT-US 3\.0 only\.$/
  it.each([
    ['truncated JSON', '{"@type": "Catalog", "dataset": [', 'invalid-json', notJson],
    ['not JSON', 'Catalog', 'invalid-json', notJson],
    ['empty input', '', 'invalid-json', empty],
    ['blank input', ' \n\t', 'invalid-json', empty],
    ['a lone byte order mark', '\uFEFF', 'invalid-json', empty],
    ['a JSON array', '[{"@type": "Catalog"}]', 'no-dcat-class', noClass],
    ['JSON null', 'null', 'no-dcat-class', noClass],
    ['a JSON number', '42', 'no-dcat-class', noClass],
    ['a JSON string', '"Catalog"', 'no-dcat-class', noClass],
    ['an empty object', '{}', 'no-dcat-class', noClass],
    ['an object with no DCAT properties', '{"name": "x"}', 'no-dcat-class', noClass],
    ['an object with only an @id', '{"@id": "https://example.gov/catalog"}', 'no-dcat-class', noClass],
    ['an unknown @type', '{"@type": "Spreadsheet", "dataset": []}', 'no-dcat-class', noClass],
    ['an inherited name as @type', '{"@type": "constructor", "dataset": []}', 'no-dcat-class', noClass],
    ['a non-string @type', '{"@type": ["Catalog"], "dataset": []}', 'no-dcat-class', noClass],
    [
      'a DCAT-US 1.1 data.json file',
      '{"@type": "dcat:Catalog", "conformsTo": "https://project-open-data.cio.gov/v1.1/schema", "dataset": []}',
      'no-dcat-class',
      v11,
    ],
    // 1.1 requires only conformsTo and dataset: with no @type it must not load as a 3.0 Catalog.
    [
      'a DCAT-US 1.1 data.json file with no @type',
      '{"conformsTo": "https://project-open-data.cio.gov/v1.1/schema", "dataset": [{"title": "A"}]}',
      'no-dcat-class',
      v11,
    ],
  ])('refuses %s with a clear error', (_case, text, code, message) => {
    expect(failure(() => decompose(text))).toEqual([code, expect.stringMatching(message)])
  })
})

describe('decompose: limits', () => {
  const nested = (levels: number) => `{"@type":"Catalog","x":${'['.repeat(levels - 1)}${']'.repeat(levels - 1)}}`

  it('refuses input over maxBytes, counting UTF-8 bytes, and names the limit', () => {
    const text = json({ '@type': 'Catalog', title: 'é'.repeat(60) }) // 90 characters, 150 bytes
    expect(text.length).toBeLessThan(100)
    expect(failure(() => decompose(text, { maxBytes: 100 }))).toEqual([
      'too-large',
      'This document is over the size limit of 100 bytes (it is 150 bytes).',
    ])
    expect(failure(() => decompose(text, { maxBytes: 150 }))).toEqual(['no error'])
    // Far over the limit, it is refused by its length without being encoded.
    expect(failure(() => decompose('x'.repeat(1_000), { maxBytes: 100 }))[1]).toBe(
      'This document is over the size limit of 100 bytes.',
    )
  })

  it('checks a file size before it is read, naming the default limit', () => {
    expect(failure(() => checkSize(30_200_000))).toEqual([
      'too-large',
      'This document is over the size limit of 25 MB (it is 30,200,000 bytes).',
    ])
    expect(failure(() => checkSize(DEFAULT_LIMITS.maxBytes))).toEqual(['no error'])
  })

  it('refuses nesting deeper than maxDepth before parsing, and names the limit', () => {
    expect(failure(() => decompose(nested(5), { maxDepth: 5 }))).toEqual(['no error'])
    expect(failure(() => decompose(nested(6), { maxDepth: 5 }))).toEqual([
      'too-deep',
      'This document is nested more than 5 levels deep, the limit.',
    ])
    // Checked on the raw text, so a bomb that is also invalid JSON is still refused as too deep.
    expect(failure(() => decompose('['.repeat(100_000)))[0]).toBe('too-deep')
    // Brackets inside strings, including after escaped quotes, do not count.
    expect(failure(() => decompose(json({ '@type': 'Catalog', title: '[[[[[[{{{{{{\\"[[[[' }), { maxDepth: 2 }))).toEqual([
      'no error',
    ])
  })

  it('refuses more than maxContainers JSON objects and arrays, DCAT or not, before parsing, and names the limit', () => {
    const text = json({ '@type': 'Catalog', dataset: [{ title: 'A' }, { title: 'B' }] }) // 3 objects, 1 array
    expect(failure(() => decompose(text, { maxContainers: 4 }))).toEqual(['no error'])
    expect(failure(() => decompose(text, { maxContainers: 3 }))).toEqual([
      'too-many-containers',
      'This document has more than 3 JSON objects and arrays, the limit.',
    ])
    const mixed = json({ '@type': 'Catalog', dataset: ['x', {}, {}] }) // kept as a property, still counted
    expect(failure(() => decompose(mixed, { maxContainers: 3 }))[0]).toBe('too-many-containers')
    // Empty arrays count too: a file of them would otherwise parse into a heap many times its size.
    expect(failure(() => decompose(`{"x":[${'[],'.repeat(9)}[]]}`, { maxContainers: 10 }))[0]).toBe('too-many-containers')
    // Refused before parsing: this is not valid JSON either.
    expect(failure(() => decompose('{"a":{},'.repeat(10), { maxContainers: 5 }))[0]).toBe('too-many-containers')
  })

  it('fits 3,000 rich datasets within the default limits', () => {
    expect(decompose(json(largeCatalog())).objects.size).toBe(1 + 3_000 * 6)
  })
})
