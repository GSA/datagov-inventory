// @vitest-environment node
// Runs without a DOM, which proves validation needs none (it runs in a worker).
import { describe, it, expect } from 'vitest'
import { decompose, type DecomposedCatalog } from '../catalog/decompose'
import { validateDocument as runtimeValidator } from '../schema/validator'
import { validateDocument as precompiledValidator } from '../generated/validateDocument'
import { pointersOf, validateCatalog } from './validator'

const load = (files: Record<string, string>) =>
  Object.entries(files).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text] as const)
const valid = load(import.meta.glob<string>('../../fixtures/catalogs/valid/*.json', { eager: true, query: '?raw', import: 'default' }))
const invalid = load(import.meta.glob<string>('../../fixtures/catalogs/invalid/*.json', { eager: true, query: '?raw', import: 'default' }))
const fixture = (name: string) => [...valid, ...invalid].find(([file]) => file === name)![1]

const resultFor = (catalog: DecomposedCatalog, objectId: string) =>
  validateCatalog(catalog).objectResults.find((r) => r.objectId === objectId)!

describe('precompiled validator', () => {
  it.each([...valid, ...invalid])('agrees with the runtime validator on %s (run npm run generate:validator if not)', (_name, text) => {
    const document = JSON.parse(text)
    const errorsOf = (validate: typeof runtimeValidator) => {
      validate(document)
      return (validate.errors ?? []).map(({ instancePath, keyword }) => `${instancePath} ${keyword}`)
    }
    expect(errorsOf(precompiledValidator)).toEqual(errorsOf(runtimeValidator))
  })
})

describe('validateCatalog', () => {
  it.each(valid)('finds no errors in %s', (_name, text) => {
    const result = validateCatalog(decompose(text))

    expect(result.valid).toBe(true)
    expect(result.totalErrors).toBe(0)
    expect(result.errorSummary).toEqual({})
    expect(result.objectResults.every((r) => r.valid)).toBe(true)
  })

  it('gives a missing required property to the object that lacks it', () => {
    const result = resultFor(decompose(fixture('dataset-missing-title.json')), '#/dataset/0')

    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ type: 'required', field: 'Title', message: 'Title is required', instancePath: '' }),
    )
  })

  it('gives errors to the deepest object, with paths relative to it', () => {
    const catalog = decompose(fixture('contact-email-not-mailto.json'))
    const result = validateCatalog(catalog)

    expect(resultFor(catalog, '#/dataset/0/contactPoint').errors).toContainEqual(
      expect.objectContaining({ type: 'pattern', instancePath: '/hasEmail' }),
    )
    expect(resultFor(catalog, '#/dataset/0').errors.every((e) => e.instancePath.startsWith('/contactPoint'))).toBe(true)
    expect(result.errorSummary.Kind).toBeGreaterThan(0)
  })

  it('gives errors at the top level to the root object', () => {
    const result = resultFor(decompose(fixture('missing-dataset.json')), '#')

    expect(result.errors).toContainEqual(expect.objectContaining({ type: 'required', field: 'Dataset' }))
  })

  it('locates objects where they are after edits, not where they were loaded from', () => {
    const catalog = decompose(fixture('dataset-with-distributions.json'))
    const dataset = catalog.objects.get('#/dataset/0')!
    const second = catalog.objects.get('#/dataset/0/distribution/1')!
    const objects = new Map(catalog.objects)
    objects.set(dataset.id, { ...dataset, links: { ...dataset.links, distribution: [second.id] } })
    objects.set(second.id, { ...second, properties: { ...second.properties, accessURL: 'not a url' } })
    const edited = { ...catalog, objects }

    expect(pointersOf(edited).get('/dataset/0/distribution/0')).toBe(second.id)
    expect(resultFor(edited, second.id).errors).toContainEqual(
      expect.objectContaining({ field: 'Access URL', instancePath: '/accessURL' }),
    )
  })

  it('reports a value that fits no anyOf branch once, not once per branch', () => {
    const catalog = decompose(fixture('issued-not-a-date.json'))

    expect(resultFor(catalog, '#/dataset/0').errors).toEqual([
      expect.objectContaining({ type: 'anyOf', field: 'Issued', message: 'is not in an accepted form', instancePath: '/issued' }),
    ])
  })

  it('counts errors by class so the summary adds up to the total', () => {
    const result = validateCatalog(decompose(fixture('contact-email-not-mailto.json')))
    const summed = Object.values(result.errorSummary).reduce((sum, count) => sum + count, 0)

    expect(result.valid).toBe(false)
    expect(summed).toBe(result.totalErrors)
  })
})
