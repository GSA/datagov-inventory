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
    expect(contactField?.allowedClasses).toContain('Agent')
  })

  it('has identifier field marked as required', () => {
    const idField = DatasetModel.fields.find((f) => f.name === 'identifier')

    expect(idField).toBeDefined()
    expect(idField?.required).toBe(true)
    expect(idField?.type).toBe('string')
  })

  it('has keyword field with multiple cardinality', () => {
    const keywordField = DatasetModel.fields.find((f) => f.name === 'keyword')

    if (keywordField) {
      expect(keywordField.cardinality).toBe('multiple')
      expect(keywordField.type).toBe('string')
    }
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
