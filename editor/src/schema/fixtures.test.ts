import { describe, expect, it } from 'vitest'
import { validateClass, validateDocument } from './validator'

const fixtures = (files: Record<string, unknown>) =>
  Object.entries(files).map(([path, json]) => [path.slice(path.lastIndexOf('/') + 1), json] as const)

const valid = fixtures(
  import.meta.glob('../../fixtures/catalogs/valid/*.json', { eager: true, import: 'default' }),
)
const invalid = fixtures(
  import.meta.glob('../../fixtures/catalogs/invalid/*.json', { eager: true, import: 'default' }),
)

/**
 * The one way each invalid fixture is invalid: an error with this keyword at this
 * path, and no errors outside `scope` (defaults to the error's path).
 */
const expectedErrors: Record<string, { instancePath: string; keyword: string; scope?: string }> = {
  'missing-dataset.json': { instancePath: '', keyword: 'required' },
  'dataset-not-an-array.json': { instancePath: '/dataset', keyword: 'type' },
  'dataset-missing-title.json': { instancePath: '/dataset/0', keyword: 'required' },
  'contact-email-not-mailto.json': {
    instancePath: '/dataset/0/contactPoint/hasEmail',
    keyword: 'pattern',
    scope: '/dataset/0/contactPoint',
  },
  'issued-not-a-date.json': { instancePath: '/dataset/0/issued', keyword: 'format' },
  'unknown-accrual-periodicity.json': { instancePath: '/dataset/0/accrualPeriodicity', keyword: 'enum' },
  'distribution-download-url-not-an-iri.json': {
    instancePath: '/dataset/0/distribution/0/downloadURL',
    keyword: 'format',
  },
}

describe('valid fixture catalogs', () => {
  it('exist', () => {
    expect(valid.length).toBeGreaterThan(0)
  })

  it.each(valid)('%s is a valid DCAT-US 3.0 document', (_name, catalog) => {
    expect(validateDocument(catalog).errors).toEqual([])
  })
})

describe('invalid fixture catalogs', () => {
  it('each have a recorded expected error', () => {
    expect(invalid.map(([name]) => name).sort()).toEqual(Object.keys(expectedErrors).sort())
  })

  it.each(invalid)('%s fails in the expected way', (name, catalog) => {
    const expected = expectedErrors[name]
    const scope = expected.scope ?? expected.instancePath
    const { valid, errors } = validateDocument(catalog)
    expect(valid).toBe(false)
    expect(errors).toContainEqual(
      expect.objectContaining({ instancePath: expected.instancePath, keyword: expected.keyword }),
    )
    for (const error of errors) {
      expect(error.instancePath.startsWith(scope)).toBe(true)
    }
  })
})

// Upstream's own good and bad examples, read as data. Agreement with them shows
// this validator (formats included) reads the definitions as upstream does.
const upstreamExamples = Object.entries(
  import.meta.glob('../../schema/dcat-us/jsonschema/examples/*/*/*.json', { eager: true, import: 'default' }),
).flatMap(([path, json]) => {
  const [className, expectation, file] = path.split('/').slice(-3)
  return expectation === 'good' || expectation === 'bad' ? [[`${className}/${expectation}/${file}`, className, expectation, json] as const] : []
})

describe('upstream examples', () => {
  it('exist', () => {
    expect(upstreamExamples.length).toBeGreaterThan(0)
  })

  it.each(upstreamExamples)('%s', (_label, className, expectation, example) => {
    expect(validateClass(className, example).valid).toBe(expectation === 'good')
  })
})
