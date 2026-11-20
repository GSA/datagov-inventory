import { describe, expect, it } from 'vitest'
import * as models from './generated/models'
import { classLabel, fieldAndClass, fieldLabel } from './labels'

describe('classLabel', () => {
  it('splits a class name into words, keeping runs of capitals together', () => {
    expect(classLabel('Dataset')).toBe('Dataset')
    expect(classLabel('PeriodOfTime')).toBe('Period of Time')
    expect(classLabel('DatasetSeries')).toBe('Dataset Series')
    expect(classLabel('CUIRestriction')).toBe('CUI Restriction')
  })

  it("names vCard's Kind a contact", () => {
    expect(classLabel('Kind')).toBe('Contact')
  })
})

describe('fieldLabel', () => {
  it('reads a property name as words, in sentence case', () => {
    expect(fieldLabel('contactPoint')).toBe('Contact point')
    expect(fieldLabel('dataset')).toBe('Dataset')
    expect(fieldLabel('accessURL')).toBe('Access URL')
    expect(fieldLabel('cuiRestriction')).toBe('CUI restriction')
    expect(fieldLabel('legacyIdField')).toBe('Legacy ID field')
    expect(fieldLabel('someLegacyURLField')).toBe('Some legacy URL field')
    expect(fieldLabel('family-name')).toBe('Family name')
  })

  it('gives terse names readable labels, and keeps JSON-LD keys and empty names as written', () => {
    expect(fieldLabel('fn')).toBe('Full name')
    expect(fieldLabel('@id')).toBe('@id')
    expect(fieldLabel('')).toBe('')
    expect(fieldLabel('--')).toBe('--')
  })

  // The generator writes each field's label with fieldLabel, so a stale model or a hand edit fails here.
  it('gives every model field its label, so a property reads the same in every class', () => {
    const byProperty = new Map<string, Set<string>>()
    for (const model of Object.values(models)) {
      for (const field of model.fields) {
        expect(field.label, `${model.className}.${field.name}`).toBe(fieldLabel(field.name))
        byProperty.set(field.name, (byProperty.get(field.name) ?? new Set()).add(field.label))
      }
    }
    expect([...byProperty].filter(([, labels]) => labels.size > 1)).toEqual([])
  })
})

describe('fieldAndClass', () => {
  it('adds the class only when it says more than the field', () => {
    expect(fieldAndClass('dataset', 'Dataset')).toBe('Dataset')
    expect(fieldAndClass('distribution', 'Distribution')).toBe('Distribution')
    expect(fieldAndClass('publisher', 'Organization')).toBe('Publisher · Organization')
    expect(fieldAndClass('contactPoint', 'Kind')).toBe('Contact point · Contact')
    expect(fieldAndClass('temporal', 'PeriodOfTime')).toBe('Temporal · Period of Time')
  })

  it('ignores case when comparing the two', () => {
    expect(fieldAndClass('cuiRestriction', 'CUIRestriction')).toBe('CUI restriction')
    expect(fieldAndClass('datasetSeries', 'DatasetSeries')).toBe('Dataset series')
  })
})
