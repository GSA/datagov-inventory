import { describe, expect, it } from 'vitest'
import { validateDocument } from './validator'

const load = (files: Record<string, unknown>) =>
  Object.entries(files).map(([path, json]) => [path.slice(path.lastIndexOf('/') + 1), json] as const)

const valid = load(import.meta.glob('../../fixtures/catalogs/valid/*.json', { eager: true, import: 'default' }))
const invalid = load(import.meta.glob('../../fixtures/catalogs/invalid/*.json', { eager: true, import: 'default' }))

/** The one error each invalid fixture is meant to raise; every error must sit under `scope` (default: the error's path). */
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

describe('fixture catalogs', () => {
  it('every invalid fixture has an expected error, and there are valid ones', () => {
    expect(valid.length).toBeGreaterThan(0)
    expect(invalid.map(([name]) => name).sort()).toEqual(Object.keys(expectedErrors).sort())
  })

  it.each(valid)('%s is valid', (_name, catalog) => {
    validateDocument(catalog)
    expect(validateDocument.errors ?? []).toEqual([])
  })

  it.each(invalid)('%s fails in the expected way', (name, catalog) => {
    const { instancePath, keyword, scope = instancePath } = expectedErrors[name]
    expect(validateDocument(catalog)).toBe(false)
    const errors = validateDocument.errors ?? []
    expect(errors).toContainEqual(expect.objectContaining({ instancePath, keyword }))
    expect(errors.filter((e) => !e.instancePath.startsWith(scope))).toEqual([])
  })
})
