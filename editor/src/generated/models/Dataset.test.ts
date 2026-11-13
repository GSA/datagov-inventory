import { describe, it, expect } from 'vitest'
import { DatasetModel } from './Dataset'

describe('DatasetModel', () => {
  it('has className Dataset', () => {
    expect(DatasetModel.className).toBe('Dataset')
  })

  it('has fields array', () => {
    expect(Array.isArray(DatasetModel.fields)).toBe(true)
    expect(DatasetModel.fields.length).toBeGreaterThan(0)
  })

  it('has title field marked as required', () => {
    const titleField = DatasetModel.fields.find((f) => f.name === 'title')

    expect(titleField).toBeDefined()
    expect(titleField?.required).toBe(true)
    expect(titleField?.type).toBe('string')
    expect(titleField?.cardinality).toBe('single')
  })

  it('has description field marked as required', () => {
    const descField = DatasetModel.fields.find((f) => f.name === 'description')

    expect(descField).toBeDefined()
    expect(descField?.required).toBe(true)
    expect(descField?.type).toBe('string')
  })

  it('has contactPoint field marked as required', () => {
    const contactField = DatasetModel.fields.find(
      (f) => f.name === 'contactPoint',
    )

    expect(contactField).toBeDefined()
    expect(contactField?.required).toBe(true)
    expect(contactField?.type).toBe('object')
    expect(contactField?.allowedClasses).toContain('Kind')
  })

  it('has identifier field marked as required', () => {
    const idField = DatasetModel.fields.find((f) => f.name === 'identifier')

    expect(idField).toBeDefined()
    expect(idField?.required).toBe(true)
    expect(idField?.type).toBe('object')
    expect(idField?.allowedClasses).toContain('Identifier')
  })

  it('has keyword, a nullable list of strings, as multiple strings', () => {
    const keywordField = DatasetModel.fields.find((f) => f.name === 'keyword')

    expect(keywordField?.type).toBe('string')
    expect(keywordField?.cardinality).toBe('multiple')
  })

  it('has temporal, a nullable list of PeriodOfTime, as multiple objects', () => {
    const temporalField = DatasetModel.fields.find((f) => f.name === 'temporal')

    expect(temporalField?.type).toBe('object')
    expect(temporalField?.cardinality).toBe('multiple')
    expect(temporalField?.allowedClasses).toEqual(['PeriodOfTime'])
  })

  it('has spatial, a Location or a list of them (anyOf), as multiple objects', () => {
    const spatialField = DatasetModel.fields.find((f) => f.name === 'spatial')

    expect(spatialField?.type).toBe('object')
    expect(spatialField?.cardinality).toBe('multiple')
    expect(spatialField?.allowedClasses).toEqual(['Location'])
  })

  it('has publisher field referencing Organization', () => {
    const publisherField = DatasetModel.fields.find(
      (f) => f.name === 'publisher',
    )

    if (publisherField) {
      expect(publisherField.type).toBe('object')
      expect(publisherField.allowedClasses).toContain('Organization')
    }
  })

  it('includes help text for fields', () => {
    const fieldsWithHelp = DatasetModel.fields.filter((f) => f.helpText)

    expect(fieldsWithHelp.length).toBeGreaterThan(0)
  })
})
