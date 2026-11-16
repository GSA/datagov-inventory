import { describe, it, expect } from 'vitest'
import { CatalogModel } from './Catalog'

describe('CatalogModel', () => {
  it('has className Catalog', () => {
    expect(CatalogModel.className).toBe('Catalog')
  })

  it('has fields array', () => {
    expect(Array.isArray(CatalogModel.fields)).toBe(true)
    expect(CatalogModel.fields.length).toBeGreaterThan(0)
  })

  it('has dataset field with multiple cardinality and object type', () => {
    const datasetField = CatalogModel.fields.find((f) => f.name === 'dataset')

    expect(datasetField).toBeDefined()
    expect(datasetField?.type).toBe('object')
    expect(datasetField?.cardinality).toBe('multiple')
    expect(datasetField?.allowedClasses).toContain('Dataset')
  })

  it('has catalog, a list of self-references ("$ref": "#"), holding Catalog', () => {
    const catalogField = CatalogModel.fields.find((f) => f.name === 'catalog')

    expect(catalogField?.type).toBe('object')
    expect(catalogField?.cardinality).toBe('multiple')
    expect(catalogField?.allowedClasses).toEqual(['Catalog'])
  })

  it('includes help text for fields', () => {
    const fieldsWithHelp = CatalogModel.fields.filter((f) => f.helpText)

    expect(fieldsWithHelp.length).toBeGreaterThan(0)
  })
})
