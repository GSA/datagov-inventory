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

  it('includes help text for fields', () => {
    const fieldsWithHelp = CatalogModel.fields.filter((f) => f.helpText)

    expect(fieldsWithHelp.length).toBeGreaterThan(0)
  })
})
